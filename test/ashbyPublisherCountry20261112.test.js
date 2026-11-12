import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { readAppData } from '../scraper-support/shared/ashbyPairNative20261027.js'
import { reconcileAshbyPublisherCountries } from '../scraper-support/utils/ashbyPublisherCountry20261112.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/ashby-publisher-country-20261112.json.gz', import.meta.url))))
const legalOps = '191bba6f-c66d-4ac0-8ddd-300b272046e0'
const itEngineer = '9aca205e-b2bc-405b-85d6-3d2aadbe49b1'
const stockholm = 'baf63625-28db-45e7-a8d0-98bd60fe3688'
const dublin = '3829206d-192f-4017-a9ce-1f9c4c012711'
const anyscaleRemote = '236b71c1-b5b0-4d5e-b17a-3e1bc4966a6a'
const detailFor = id => structuredClone(fixture.details.find(row => row.jobId === id))
const rowFor = (source, id) => structuredClone(fixture.sources[source].payload.jobs.find(row => row.id === id))
const editPage = (detail, { app: editApp, schema: editSchema } = {}) => {
  const document = readNativeDocument(detail.html)
  const appNode = document.nodes(node => node.tag === 'script' && /window\.__appData\s*=/.test(node.raw || ''))[0]
  const schemaNode = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')[0]
  if (editApp) {
    const app = readAppData(appNode.raw)
    editApp(app)
    detail.html = detail.html.replace(appNode.raw, `window.__appData = ${JSON.stringify(app)};`)
  }
  if (editSchema) {
    const schema = JSON.parse(schemaNode.raw)
    editSchema(schema)
    detail.html = detail.html.replace(schemaNode.raw, JSON.stringify(schema))
  }
  return detail
}
const execute = async (source, id, { row = rowFor(source, id), detail = detailFor(id), signal } = {}) => {
  const payload = { apiVersion: '1', jobs: [row] }, original = structuredClone(payload)
  const jobs = await createPublishingGapAtsScraper(fixture.sources[source].provider).run({ signal,
    fetchJson: async () => payload,
    fetchPage: async url => {
      assert.equal(url, row.jobUrl)
      return { status: detail.status, url: detail.url, html: detail.html }
    },
  })
  assert.deepEqual(payload, original, 'The original publisher response must be preserved')
  return { jobs, evidence: readInventoryEvidence(jobs), audit: jobs.nativeCollectionEvidence }
}

test('retained native country fixture keeps exact original API and role page hashes', () => {
  for (const detail of fixture.details) assert.equal(createHash('sha256').update(detail.html).digest('hex'), detail.hash)
  for (const source of Object.values(fixture.sources)) {
    const original = Buffer.from(source.originalBodyBase64, 'base64')
    assert.equal(createHash('sha256').update(original).digest('hex'), source.receipt.hash)
    assert.deepEqual(JSON.parse(original), source.payload)
  }
  assert.equal(fixture.sources.elevenlabs.payload.jobs.length, 128)
  assert.equal(fixture.sources.anyscale.payload.jobs.length, 24)
})

test('ElevenLabs scopes an omitted primary Remote country with its matching US-only native Location criterion', async () => {
  const { jobs, evidence, audit } = await execute('elevenlabs', legalOps)
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 2)
  assert.deepEqual(audit.nativeRecords, [rowFor('elevenlabs', legalOps)])
  assert.equal(audit.nativeCountryReconciliation.proofs[0].country, 'United States')
  assert.equal(audit.nativeCountryReconciliation.proofs[0].sha256, detailFor(legalOps).hash)
})

test('Harvey scopes a single native primary location using its own explicit country Location statement', async () => {
  const { evidence, audit } = await execute('harvey', stockholm)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(audit.nativeCountryReconciliation.proofs[0].country, 'Sweden')
  assert.deepEqual(audit.nativeRecords, [rowFor('harvey', stockholm)])
})

test('native blank addresses and optional offices leave generic Remote and Dublin countries unresolved', async () => {
  for (const [source, id] of [['anyscale', anyscaleRemote], ['elevenlabs', itEngineer], ['harvey', dublin]]) {
    const { evidence } = await execute(source, id)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('a matching globally remote criterion cannot inherit a secondary US country', async () => {
  const row = rowFor('elevenlabs', legalOps), before = 'This role is remote and can be executed anywhere in the United States.'
  const after = 'This role is remote and can be executed globally.'
  assert.ok(row.descriptionHtml.includes(before))
  row.descriptionHtml = row.descriptionHtml.replace(before, after)
  const detail = editPage(detailFor(legalOps), {
    app: app => { app.posting.descriptionHtml = app.posting.descriptionHtml.replace(before, after) },
    schema: schema => { schema.description = schema.description.replace(before, after) },
  })
  const { evidence } = await execute('elevenlabs', legalOps, { row, detail })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('a verified primary country leaves every unknown secondary location unresolved', async () => {
  const row = rowFor('elevenlabs', legalOps)
  row.secondaryLocations.push({ location: 'Unspecified satellite', address: null })
  const detail = editPage(detailFor(legalOps), {
    app: app => { app.posting.secondaryLocationNames.push('Unspecified satellite') },
    schema: schema => { schema.jobLocation.push({ '@type': 'Place', address: { '@type': 'PostalAddress' } }) },
  })
  const { evidence, audit } = await execute('elevenlabs', legalOps, { row, detail })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.nativeCountryReconciliation.proofs[0].country, 'United States')
  assert.equal(audit.nativeRecords[0].secondaryLocations.at(-1).address, null)
})

test('native evidence must reconcile current role identity, complete criteria, and all location labels', async () => {
  for (const mutation of [
    { app: app => { app.posting.id = 'different-role' } },
    { app: app => { app.posting.isListed = false } },
    { app: app => { app.posting.descriptionHtml += '<p>Different complete criteria.</p>' } },
    { app: app => { app.posting.secondaryLocationNames = [] } },
    { schema: schema => { schema.identifier.value = 'different-role' } },
    { schema: schema => { schema.description += '<p>Different complete criteria.</p>' } },
  ]) {
    const { evidence } = await execute('elevenlabs', legalOps, { detail: editPage(detailFor(legalOps), mutation) })
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('a hidden native Location criterion cannot resolve an omitted country', async () => {
  const row = rowFor('elevenlabs', legalOps)
  const before = 'This role is remote and can be executed anywhere in the United States.'
  const after = `<span hidden>${before}</span>`
  row.descriptionHtml = row.descriptionHtml.replace(before, after)
  const detail = editPage(detailFor(legalOps), {
    app: app => { app.posting.descriptionHtml = app.posting.descriptionHtml.replace(before, after) },
    schema: schema => { schema.description = schema.description.replace(before, after) },
  })
  const { evidence } = await execute('elevenlabs', legalOps, { row, detail })
  assert.equal(evidence.listingComplete, false)
})

test('foreign redirects and unsuccessful native responses cannot supply country evidence', async () => {
  for (const update of [{ status: 403 }, { url: 'https://jobs.ashbyhq.com/foreign/role' }]) {
    const { evidence } = await execute('elevenlabs', legalOps, { detail: { ...detailFor(legalOps), ...update } })
    assert.equal(evidence.listingComplete, false)
  }
})

test('the optional native country audit stops at its budget and preserves unchecked rows', async () => {
  const row = rowFor('elevenlabs', legalOps), payload = { apiVersion: '1', jobs: [row] }
  const result = await Promise.race([
    reconcileAshbyPublisherCountries(payload, fixture.sources.elevenlabs.provider, {
      auditBudgetMs: 20, fetchPage: async () => new Promise(() => {}),
    }),
    new Promise(resolve => setTimeout(() => resolve(null), 150)),
  ])
  assert.ok(result, 'An optional audit must return unresolved evidence when its request ignores cancellation')
  assert.deepEqual(result.payload, payload)
  assert.equal(result.proofs.length, 0)
  assert.equal(result.failures[0].reason, 'native-country-audit-budget-exhausted')
})

test('the default native country audit disables redirects at the HTTP boundary', async context => {
  const row = rowFor('elevenlabs', legalOps), detail = detailFor(legalOps)
  let redirect
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    redirect = options.redirect
    const response = new Response(detail.html, { status: 200 })
    Object.defineProperty(response, 'url', { value: row.jobUrl })
    return response
  })
  await reconcileAshbyPublisherCountries({ apiVersion: '1', jobs: [row] }, fixture.sources.elevenlabs.provider)
  assert.equal(redirect, 'manual')
})

test('caller cancellation propagates when an injected native reader ignores its signal', async () => {
  const controller = new AbortController(), reason = new Error('stop native country audit')
  const row = rowFor('elevenlabs', legalOps)
  const audit = reconcileAshbyPublisherCountries({ apiVersion: '1', jobs: [row] }, fixture.sources.elevenlabs.provider, {
    signal: controller.signal, fetchPage: async () => new Promise(() => {}),
  }).catch(error => error)
  controller.abort(reason)
  const result = await Promise.race([audit, new Promise(resolve => setTimeout(() => resolve(null), 150))])
  assert.equal(result, reason)
})

test('native country evidence never overwrites a different published secondary country', async () => {
  const row = rowFor('elevenlabs', legalOps)
  row.secondaryLocations = [{ location: 'India', address: { postalAddress: { addressCountry: 'India' } } }]
  const detail = editPage(detailFor(legalOps), {
    app: app => { app.posting.secondaryLocationNames = ['India'] },
    schema: schema => { schema.jobLocation[1].address.addressCountry = 'India' },
  })
  const result = await reconcileAshbyPublisherCountries({ apiVersion: '1', jobs: [row] }, fixture.sources.elevenlabs.provider, {
    fetchPage: async () => ({ status: detail.status, url: detail.url, html: detail.html }),
  })
  assert.equal(result.proofs.length, 0)
  assert.equal(result.payload.jobs[0].address.postalAddress.addressCountry, undefined)
  assert.equal(result.payload.jobs[0].secondaryLocations[0].address.postalAddress.addressCountry, 'India')
})

test('the native country request cap preserves every unchecked record', async () => {
  const records = Array.from({ length: 65 }, (_, index) => {
    const row = rowFor('elevenlabs', legalOps)
    row.id = `native-limit-${index}`
    row.jobUrl = `https://jobs.ashbyhq.com/ElevenLabs/${row.id}`
    row.applyUrl = `${row.jobUrl}/application`
    return row
  })
  const payload = { apiVersion: '1', jobs: records }
  let requests = 0
  const result = await reconcileAshbyPublisherCountries(payload, fixture.sources.elevenlabs.provider, {
    fetchPage: async url => { requests++; return { status: 403, url, html: 'Blocked' } },
  })
  assert.equal(requests, 64)
  assert.deepEqual(result.payload, payload)
  assert.equal(result.failures.at(-1).jobId, 'native-limit-64')
  assert.equal(result.failures.at(-1).reason, 'native-country-audit-request-cap')
})

test('the default native country reader stops consuming an oversized response stream', async context => {
  const row = rowFor('elevenlabs', legalOps)
  let pulls = 0
  context.mock.method(globalThis, 'fetch', async () => {
    const response = new Response(new ReadableStream({ pull(controller) {
      pulls++
      if (pulls <= 10) controller.enqueue(new Uint8Array(524288))
      else controller.close()
    } }), { status: 200 })
    Object.defineProperty(response, 'url', { value: row.jobUrl })
    return response
  })
  const result = await reconcileAshbyPublisherCountries({ apiVersion: '1', jobs: [row] }, fixture.sources.elevenlabs.provider)
  assert.equal(result.proofs.length, 0)
  assert.ok(pulls < 10, 'Stop the response stream as soon as the byte budget is exceeded')
})
