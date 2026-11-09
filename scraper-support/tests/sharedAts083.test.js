import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
globalThis.fetch = async () => { throw new Error('OFFLINE_FETCH_TRIPWIRE') }
const { getScraperCatalog, createCatalogScraper, hydrateProviderCatalogEntry } = await import('../providers/index.js')
const { createPublishingGapAtsScraper } = await import('../utils/publishingGapAts.js')
const { readInventoryEvidence, isFreshCompleteInventoryEvidence } = await import('../utils/inventoryEvidence.js')
const { identifyPublicAtsBoard, hasMatchingPublicAtsBinding } = await import('../utils/publicAtsIdentity.js')
const { analyzePublishableJobs } = await import('../utils/publishableJobMetrics.js')
const { createPublicAtsAuditCapture } = await import('../../scripts/catalogExtractionPublicAtsCapture.js')
import os from 'node:os'
import path from 'node:path'
const { hasSourceDescription } = await import('../../src/utils/jobSourceContent.js')

const fixtures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/sharedAts083.json.gz', import.meta.url))))
const catalog = getScraperCatalog()
assert.equal(Object.keys(fixtures).length, 22)
// Ebury now reconciles live native HTML pages and details in scraper/ebury/native.test.js.
// Checkout.com current corporate proxy/native reconciliation is covered in scraper/checkoutcom/native.test.js.
// These unchanged one-response fixtures and their original descriptors exercise
// the historical shared API contract. Current source readers require separate
// corporate/board/role HTTP evidence; this suite does not qualify them as current.
const legacyDescriptors = JSON.parse(fs.readFileSync(new URL('../providers/providerExtensions/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-verified-discovery-adapters-00083.json', import.meta.url)))
// Their original native captures use lowercase boards. Current providers bind
// exact-case native canonical boards using separate current employer evidence.
// Pin the original descriptors rather than rewriting either native HTTP body.
const archivedDescriptors = JSON.parse(fs.readFileSync(new URL('./fixtures/sharedAts083ArchivedDescriptors.json', import.meta.url)))
const archivedBySource = new Map(archivedDescriptors.map(row => [row.source, row]))
const legacyCatalog = new Map(legacyDescriptors.map(row => [row.source,
  hydrateProviderCatalogEntry(archivedBySource.get(row.source) || row)]))
const ids = Object.keys(fixtures).filter(source => !['ebury', 'checkoutcom'].includes(source)).sort()
const unresolvedScopes = new Set(['checkoutcom', 'clearco', 'cohere', 'datafold', 'doximity', 'dutchie', 'ebury', 'elationhealth', 'eqtcorporation', 'financialtimes'])

test('archived Close and Coalesce metadata retains the literal original board identities', () => {
  for (const source of ['close', 'coalesce']) {
    const archived = legacyCatalog.get(source)
    assert.equal(archived.boardToken, source)
    assert.deepEqual(archived.bindingEvidence.matchedLinks, ['https://jobs.ashbyhq.com/' + source])
    assert.equal(archived.bindingEvidence.nativeBoardCanonicalEvidence, undefined)
    assert.equal(archived.runtimeInventoryVerification, undefined)
    assert.notEqual(catalog.find(row => row.source === source).boardToken, archived.boardToken)
    assert.ok(fixtures[source].jobs.every(job => identifyPublicAtsBoard(job.jobUrl)?.boardToken === archived.boardToken))
  }
})

test('archived country scope distinguishes explicit US records and unlocated prospect communities', () => {
  assert.ok(fixtures.characterai.jobs.every(job => job.address.postalAddress.addressCountry === 'United States'))
  const unlocated = fixtures.eqtab.jobs.filter(job => ['Global', 'Europe (Region)'].includes(job.location.name))
  assert.equal(unlocated.length, 2)
  assert.ok(unlocated.every(job => job.internal_job_id === null && /Community/i.test(job.title)))
})

test('cohere: registered identity-bound native reader clears historical static verification', () => {
  const provider = catalog.find(row => row.source === 'cohere')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.verifiedOn, null);assert.equal(provider.verifiedAt, null)
  assert.equal(provider.verifiedPublicJobCount, null);assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false);assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.parser, 'cohere-native-public-scope-reconciliation')
})

test('checkoutcom: current native script reconciles details instead of the legacy one-response adapter', async () => {
  const { transport } = await import('../../scraper/checkoutcom/native.fixtures.js')
  const provider = catalog.find(row => row.source === 'checkoutcom')
  const jobs = await createCatalogScraper(provider).run(transport('checkoutcom'))
  assert.equal(jobs.length, 1)
  assert.match(jobs[0].jobDescription, /5\+ years building C\+\+/)
  assert.equal(jobs[0].closingDate, '2026-11-30T23:59:00.000Z')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const source of ids) test(`${source}: historical shared API adapter and direct factory retain archived zero-match evidence`, async () => {
  const provider = legacyCatalog.get(source)
  assert.equal(provider.adapter, 'publicAts')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(hasMatchingPublicAtsBinding(provider), true)
  let calls = 0
  const jobs = await createCatalogScraper(provider).run({ fetchJson: async url => {
    calls++
    assert.equal(url, provider.atsPlatform === 'ashby'
      ? `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(provider.boardToken)}`
      : `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(provider.boardToken)}/jobs?content=true`)
    return structuredClone(fixtures[source])
  } })
  assert.equal(calls, 1)
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, fixtures[source].jobs.length)
  assert.equal(evidence.indiaFacetCount, unresolvedScopes.has(source) ? null : 0)
  if (unresolvedScopes.has(source)) assert.match(evidence.reason, /native-location-scope-unresolved/)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
  assert.match(evidence.reason, /provider-source-scope-unresolved/)
  const direct = createPublishingGapAtsScraper(provider)
  const directJobs = await direct.run({ fetchJson: async () => structuredClone(fixtures[source]) })
  assert.equal(directJobs.length, 0)
  assert.equal(readInventoryEvidence(directJobs).status, 'discovery-only')
})

test('company-advertised Europe-hosted Greenhouse boards match their exact tokens', () => {
  for (const host of ['boards.eu.greenhouse.io', 'job-boards.eu.greenhouse.io']) {
    for (const url of [`https://${host}/financialtimes33/`, `https://${host}/embed/job_board?for=financialtimes33`]) {
      assert.deepEqual(identifyPublicAtsBoard(url), { atsPlatform: 'greenhouse', boardToken: 'financialtimes33' })
    }
  }
  for (const host of ['job-boards.eu.greenhouse.io.evil.test', 'unrelated.greenhouse.io', 'boards-eu.greenhouse.io']) assert.equal(identifyPublicAtsBoard(`https://${host}/financialtimes33`), null)
  assert.equal(hasMatchingPublicAtsBinding({ atsPlatform: 'greenhouse', boardToken: 'other', bindingEvidence: { verified: true, matchedLinks: ['https://boards.eu.greenhouse.io/financialtimes33'] } }), false)
})

test('synthetic future India, missing descriptions, truncation and failures exercise each historical shared API contract', async () => {
  for (const source of ids) {
    const provider = legacyCatalog.get(source)
    assert.equal(provider.adapter, 'publicAts')
    const date = new Date().toISOString()
    // Synthetic future fixtures only; these are never counted as actual openings.
    const record = provider.atsPlatform === 'ashby' ? {
      id: 'fixture-083', title: 'Software Engineer', isListed: true, location: 'Bengaluru, India',
      address: { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } },
      jobUrl: `https://jobs.ashbyhq.com/${provider.boardToken}/fixture-083`,
      applyUrl: `https://jobs.ashbyhq.com/${provider.boardToken}/fixture-083/application`,
      publishedAt: date, descriptionHtml: '<p>Build production software services and maintain reliable systems.</p>', descriptionPlain: '',
    } : {
      id: 83083083, title: 'Software Engineer', location: { name: 'Bengaluru, India' },
      absolute_url: `https://job-boards.greenhouse.io/${provider.boardToken}/jobs/83083083`, first_published: date,
      content: '<p>Build production software services and maintain reliable systems.</p>',
    }
    const payload = provider.atsPlatform === 'ashby' ? { apiVersion: '1', jobs: [record] } : { jobs: [record], meta: { total: 1 } }
    const run = value => createCatalogScraper(provider).run({ fetchJson: async () => structuredClone(value) })
    const positive = await run(payload)
    assert.equal(positive.length, 1, source)
    assert.equal(analyzePublishableJobs(positive).eligibleJobs.length, 1, source)
    assert.equal(positive[0].sourceListingComplete, false)
    assert.equal(positive[0].lifecycleCleanupAllowed, false)
    assert.equal(positive[0].applyUrl, record.applyUrl || record.absolute_url)
    const missing = structuredClone(payload)
    Object.assign(missing.jobs[0], { descriptionHtml: '', descriptionPlain: '', content: '' })
    const missingJobs = await run(missing)
    assert.equal(missingJobs.length, 1, source)
    assert.equal(analyzePublishableJobs(missingJobs).eligibleJobs.length, 1, source)
    assert.ok(missingJobs.every(job => !hasSourceDescription(job) && !job.jobDescription && !job.sourceDescription), source)
    assert.ok(missingJobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false), source)
    const missingEvidence = readInventoryEvidence(missingJobs)
    assert.equal(missingEvidence.listingComplete, false, source)
    assert.match(missingEvidence.reason, /selected-role-description-unavailable/, source)
    assert.equal(isFreshCompleteInventoryEvidence(missingEvidence), false, source)
    await assert.rejects(run({ ...payload, total: 2, meta: { total: 2 } }), /Incomplete/, source)
    await assert.rejects(createCatalogScraper(provider).run({ fetchJson: async () => { throw new Error('HTTP503') } }), /503/, source)
  }
})

test('public JSON capture accepts a complete native-size feed larger than2MiB within a bounded8MiB default', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ats083-large-json-'))
  try {
    const payload = fixtures.checkoutcom
    const body = Buffer.from(JSON.stringify(payload))
    assert.ok(body.length > 2 * 1024 * 1024 && body.length < 8 * 1024 * 1024)
    const capture = createPublicAtsAuditCapture({ source: 'checkoutcom', adapter: 'publicAts', atsPlatform: 'ashby', boardToken: 'checkout.com' },
      { outputDirectory: directory, fetchImpl: async () => new Response(body) })
    const result = await capture.fetchJson('https://api.ashbyhq.com/posting-api/job-board/checkout.com')
    assert.equal(result.jobs.length, payload.jobs.length)
    assert.equal(capture.evidence[0].bodyComplete, true)
    assert.equal(capture.evidence[0].bodyBytes, body.length)
    assert.deepEqual(fs.readFileSync(path.join(directory, capture.evidence[0].body)), body)
    const limited = createPublicAtsAuditCapture({ source: 'checkoutcom', adapter: 'publicAts', atsPlatform: 'ashby', boardToken: 'checkout.com' },
      { outputDirectory: directory, fetchImpl: async () => new Response('x'.repeat(8 * 1024 * 1024 + 1)) })
    await assert.rejects(limited.fetchJson('https://api.ashbyhq.com/posting-api/job-board/checkout.com'), /limit/)
    assert.equal(limited.evidence[0].bodyComplete, false)
    assert.equal(limited.evidence[0].verifiedZeroInventory, false)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
