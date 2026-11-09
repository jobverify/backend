import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { CAREERS, parseAquaListing, parseAquaDetail, runNativeAqua } from './native.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/current-20261029')
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'))
const records = new Map(manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(path.join(fixtureDir, receipt.filename)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return [receipt.url, { ...receipt, body, bodyComplete: true }]
}))
const listingHTML = records.get(CAREERS).body.toString()
const listing = parseAquaListing(listingHTML)
const indiaRows = listing.records.filter(row => row.locationSlug.endsWith('-india'))
const roleHTML = row => records.get(row.url).body.toString()
const transport = overrides => async (url, { signal }) => {
  signal?.throwIfAborted()
  assert.ok(records.has(url), `Uncaptured URL must not be fetched: ${url}`)
  const response = structuredClone(records.get(url))
  return overrides ? overrides(response, url) : response
}

test('captured Aqua native listing has nine distinct identities and three explicitly located India roles', () => {
  assert.equal(listing.records.length, 9)
  assert.deepEqual(indiaRows.map(row => row.id), ['56.37B', 'AB.27D', 'D4.279'])
  assert.equal(listing.reportedTotal, null)
  assert.ok(indiaRows.every(row => row.locations[0] === 'Hyderabad, India'))
})

test('the production catalog executes the native extractor and retains full original job descriptions', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'aquasecurity')
  assert.equal(provider.atsPlatform, 'comeet')
  assert.equal(provider.backfillMode, 'live-parser')
  const jobs = await createCatalogScraper(provider).run({ transport: transport() })
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map(job => job.jobId), ['56.37B', 'AB.27D', 'D4.279'])
  for (const job of jobs) {
    assert.equal(job.company, 'Aqua Security')
    assert.equal(job.source, 'aquasecurity')
    assert.equal(job.country, 'India')
    assert.equal(job.city, 'Hyderabad')
    assert.ok(job.jobDescription.length > 5000)
    assert.ok(job.jobDescription.includes('Requirements'))
    assert.equal(job.nativeFacts.nativeCompanyUID, '91.001')
    assert.equal(job.nativeFacts.nativeJobPosting.hiringOrganization.name, 'Aqua Security')
    assert.equal(job.applyUrl, job.sourceUrl)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('a missing or changed native account cannot become an empty success', () => {
  for (const html of [listingHTML.replace('"comeet_uid":"91.001"', '"comeet_uid":"99.999"'),
    listingHTML.replace('id="comeet_script-js-extra"', 'id="inert-old-config"'),
    listingHTML.replace('id="comeet_script-js-extra"', 'type="application/json" id="comeet_script-js-extra"')]) {
    assert.notEqual(html, listingHTML)
    assert.throws(() => parseAquaListing(html), /account|configuration/)
  }
})

test('duplicate or nonenumerable native listings retain a coverage gap', () => {
  const card = listingHTML.match(/<a href="[^\"]*56\.37B[^\"]*" class="careers_pos_item">[\s\S]*?<\/a>/)[0]
  assert.throws(() => parseAquaListing(listingHTML.replace(card, card + card)), /duplicate/)
  assert.throws(() => parseAquaListing(listingHTML.replaceAll('class="careers_pos_item"', 'class="inert-old-position"')), /enumerable/)
})

test('visible title, native employer and public application identities must match the current listing', () => {
  const row = indiaRows[0], original = roleHTML(row)
  const mutations = [
    original.replace('position_title">Expert Engineer (Golang)', 'position_title">Different role'),
    original.replace('"name": "Aqua Security"', '"name": "Unrelated Employer"'),
    original.replace('type="comeet-applyform" data-position-uid="56.37B"', 'type="comeet-applyform" data-position-uid="00.000"'),
  ]
  for (const html of mutations) {
    assert.notEqual(html, original)
    assert.throws(() => parseAquaDetail(html, row), /title|employer|application/)
  }
})

test('contradictory schema country and unseen schema-only content cannot be published', () => {
  const row = indiaRows[0], original = roleHTML(row)
  const country = original.replace('"name": "IN"', '"name": "US"')
  assert.notEqual(country, original)
  assert.throws(() => parseAquaDetail(country, row), /country/)
  const extraTeamContent = original.replace('<b>About the Team</b><br /><br />', '<b>About the Team</b><br /><p>Additional native team responsibilities unavailable on the visible page.</p>')
  assert.notEqual(extraTeamContent, original)
  assert.throws(() => parseAquaDetail(extraTeamContent, row), /content mismatch/)
})

test('one failed native detail preserves the other proven jobs and exposes the failure', async () => {
  const failedURL = indiaRows[0].url
  const jobs = await runNativeAqua({ transport: transport((response, url) => url === failedURL ? { ...response, status: 503 } : response) })
  assert.deepEqual(jobs.map(job => job.jobId), ['AB.27D', 'D4.279'])
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
  assert.equal(jobs[0].nativeCollectionEvidence.failures[0].stage, 'native-detail')
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false))
})

test('a changed closing inventory remains visible in collection diagnostics', async () => {
  let listReads = 0
  const jobs = await runNativeAqua({ transport: transport((response, url) => {
    if (url === CAREERS && ++listReads === 3) response.body = Buffer.from(listingHTML.replace('Expert Engineer (Golang)', 'Updated role title'))
    return response
  }) })
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches, false)
  assert.ok(jobs[0].nativeCollectionEvidence.failures.some(failure => failure.stage === 'closing-inventory'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('pre-cancelled native source work makes no HTTP requests', async () => {
  const controller = new AbortController()
  controller.abort(Error('cancel source'))
  await assert.rejects(runNativeAqua({ signal: controller.signal, transport: async () => assert.fail('No cancelled request') }), /cancel source/)
})
