import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/tektronix-current-20261115.json.gz', import.meta.url))))
const configure = () => {
  const provider = structuredClone(getScraperCatalog().find(row => row.source === 'tektronix'))
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0 }
  provider.config.detail.countryFilter = 'India'
  return provider
}
const replay = async (records, { provider = configure(), details = [fixture.indiaDetail, fixture.foreignDetail] } = {}) => {
  const fetched = []
  const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
    const address = new URL(url)
    if (address.pathname.endsWith('/search')) return { status: 200, error: { message: '', body: '' },
      metadata: null, data: { count: records.length, positions: structuredClone(records) } }
    const id = address.searchParams.get('position_id'); fetched.push(id)
    const detail = details.find(value => String(value.data.id) === id)
    assert.ok(detail, 'Unexpected own native detail: ' + id)
    return structuredClone(detail)
  } })
  return { jobs, fetched }
}

test('India-specific hydration skips only resolved foreign native records and preserves global listing counts', async () => {
  const { jobs, fetched } = await replay([fixture.foreign, fixture.india])
  assert.deepEqual(fetched, [String(fixture.india.id)])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobDescription, fixture.indiaDetail.data.jobDescription)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('an unresolved Remote worksite keeps native detail hydration and incomplete country scope', async () => {
  const record = { ...structuredClone(fixture.india), locations: ['Remote'], standardizedLocations: ['Remote'] }
  const detail = structuredClone(fixture.indiaDetail)
  Object.assign(detail.data, { locations: ['Remote'], standardizedLocations: ['Remote'] })
  const { jobs, fetched } = await replay([record], { details: [detail] })
  assert.deepEqual(fetched, [String(record.id)])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a mixed India and foreign native worksite remains selected for full detail checks', async () => {
  const record = structuredClone(fixture.india)
  record.locations.push(...fixture.foreign.locations)
  record.standardizedLocations.push(...fixture.foreign.standardizedLocations)
  const detail = structuredClone(fixture.indiaDetail)
  Object.assign(detail.data, { locations: record.locations, standardizedLocations: record.standardizedLocations })
  const { jobs, fetched } = await replay([record], { details: [detail] })
  assert.deepEqual(fetched, [String(record.id)])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
})

test('providers without the opt-in retain their original foreign-role hydration', async () => {
  const provider = configure()
  delete provider.config.detail.countryFilter
  const { fetched } = await replay([fixture.foreign, fixture.india], { provider })
  assert.deepEqual(fetched, [String(fixture.foreign.id), String(fixture.india.id)])
})

test('country-specific hydration cannot be enabled for a Global provider', async () => {
  const provider = configure()
  provider.countryFilter = 'Global'
  await assert.rejects(replay([fixture.foreign], { provider }), /country.*hydration|hydration.*country/i)
})

test('duplicate resolved-foreign native identities cannot certify a complete zero India inventory', async () => {
  const { jobs, fetched } = await replay([fixture.foreign, fixture.foreign])
  assert.deepEqual(fetched, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.match(evidence.reason, /repeated-vacancy-identity/)
  assert.deepEqual(jobs.sourceSkippedForeignNativeRecords, [fixture.foreign, fixture.foreign])
})

test('a resolved-foreign listing still needs its own employer native position URL before pruning', async () => {
  const record = { ...structuredClone(fixture.foreign), positionUrl: 'https://unrelated.invalid/careers/job/' + fixture.foreign.id }
  await assert.rejects(replay([record]), /identity mismatch: positionUrl/)
})

for (const field of ['id', 'displayJobId', 'name', 'positionUrl']) test('a foreign record missing ' + field + ' cannot bypass identity validation', async () => {
  const record = structuredClone(fixture.foreign)
  delete record[field]
  await assert.rejects(replay([record]), /identity mismatch/)
})

test('registered country pruning retains full duplicate foreign observations after catalog decoration', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.match(String(url), /\/search\?/)
    const response = Response.json({ status: 200, error: { message: '', body: '' }, metadata: null,
      data: { count: 2, positions: [fixture.foreign, fixture.foreign] } })
    Object.defineProperty(response, 'url', { value: String(url) })
    return response
  })
  const jobs = await createCatalogScraper(configure()).run()
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.deepEqual(jobs.nativeCollectionEvidence?.skippedForeignNativeRecords, [fixture.foreign, fixture.foreign])
})
