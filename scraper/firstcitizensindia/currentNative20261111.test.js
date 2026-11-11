import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { isVerifiedEmptyEvidence, readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest-20261111.json', import.meta.url), 'utf8'))
const captured = new Map(manifest.receipts.map(receipt => [receipt.requestedURL, {
  ...receipt, body: gunzipSync(readFileSync(new URL('./fixtures/' + receipt.fixture, import.meta.url))).toString('utf8'),
}]))
const CORPORATE = 'https://www.firstcitizens.com/'
const CAREERS = 'https://jobs.firstcitizens.com/'
const SEARCH = 'https://jobs.firstcitizens.com/jobs'
const CLIENT = 'https://app.jibecdn.com/prod/search/4.11.225/main.js'
const INDIA = 'https://jobs.firstcitizens.com/api/jobs?page=1&country=India'
const CONTROL = 'https://jobs.firstcitizens.com/api/jobs?page=1&limit=100&country=United+States'
const PAGE1 = 'https://jobs.firstcitizens.com/api/jobs?page=1&limit=100'
const PAGE5 = 'https://jobs.firstcitizens.com/api/jobs?page=5&limit=100'
const jsonChange = (body, change) => { const payload = JSON.parse(body); change(payload); return JSON.stringify(payload) }

function replay(t, mutate = value => value) {
  const reads = new Map()
  t.mock.method(globalThis, 'fetch', async (value, init) => {
    const url = String(value), packet = captured.get(url)
    assert.ok(packet, 'Only currently declared and captured public reads are allowed: ' + url)
    const occurrence = (reads.get(url) || 0) + 1
    reads.set(url, occurrence)
    const changed = mutate({ url, occurrence, body: packet.body, status: 200, init })
    const response = new Response(changed.body, { status: changed.status,
      headers: { 'content-type': packet.headers['content-type'] } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  return reads
}

test('current complete native country inventory certifies only its configured India zero with cleanup and whole-employer scope held', async t => {
  const reads = replay(t)
  let audit
  const jobs = await run({ onAudit: value => { audit = value } })
  assert.deepEqual(jobs, [])
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)), true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'firstcitizensindia').observedRecordCount, 404)
  assert.equal(readSourceObservationEvidence(jobs, 'firstcitizensindia').companyIndiaTotal, null)
  assert.equal(audit.nativeListingRecords.length, 404)
  assert.equal(audit.nativeListingRecords[0].data.hiring_organization, 'First Citizens Bank')
  assert.equal(audit.nativeListingRecords[0].data.posted_date, '2026-11-11T00:57:00+0000')
  assert.ok(audit.nativeListingRecords[0].data.description.length > 100)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.exhaustiveNativeCountryInventory, true)
  assert.equal(audit.closingInventoryMatches, true)
  assert.equal(audit.countryControl.country, 'United States')
  assert.equal(audit.countryControl.expectedNativeCount, 404)
  assert.equal(audit.countryControl.reportedCount, 404)
  assert.equal(audit.receipts.length, 22)
  assert.equal(reads.get(PAGE5), 2)
  assert.equal(reads.get(CORPORATE), 2)
  assert.equal(reads.get(CLIENT), 2)
  assert.equal(reads.get(INDIA), 2)
})

for (const [name, modify, reason] of [
  ['an unqualified country spelling', p => { p.jobs[0].data.country = 'Untied States' }, /country/i],
  ['a primary India location despite a zero filter response', p => { p.jobs[0].data.country = 'India'; p.jobs[0].data.country_code = 'IN' }, /India|country/i],
  ['an additional India location despite only foreign primary locations', p => {
    const data = p.jobs.find(row => row.data.additional_locations?.length).data
    data.additional_locations[0].country = 'India'; data.additional_locations[0].country_code = 'IN'
  }, /India|country/i],
  ['an unknown additional work country', p => { delete p.jobs.find(row => row.data.additional_locations?.length).data.additional_locations[0].country }, /country/i],
  ['a different native employer', p => { p.jobs[0].data.hiring_organization = 'Different Employer' }, /employer/i],
  ['a repeated native identity', p => { p.jobs[1] = structuredClone(p.jobs[0]) }, /duplicate|identity/i],
]) test('a zero filter cannot override ' + name + ' in the exhaustive native inventory', async t => {
  replay(t, value => value.url === PAGE1 ? { ...value, body: jsonChange(value.body, modify) } : value)
  await assert.rejects(run(), reason)
})

test('a partial last native page cannot certify any zero', async t => {
  replay(t, value => value.url === PAGE5 ? { ...value, body: jsonChange(value.body, p => p.jobs.pop()) } : value)
  await assert.rejects(run(), /count|complete|page/i)
})

test('a wrong-value empty country control cannot authorize a configured India zero', async t => {
  replay(t, value => value.url === CONTROL ? { ...value, body: captured.get(INDIA).body } : value)
  await assert.rejects(run(), /control|country/i)
})

test('a country control with repeated members cannot validate native filter membership', async t => {
  replay(t, value => value.url === CONTROL ? { ...value,
    body: jsonChange(value.body, p => { p.jobs[1] = structuredClone(p.jobs[0]) }) } : value)
  await assert.rejects(run(), /control|duplicate|membership/i)
})

test('an ignored India filter cannot supply a verified empty result', async t => {
  replay(t, value => value.url === INDIA ? { ...value, body: captured.get(PAGE1).body } : value)
  await assert.rejects(run(), /India|filter|empty/i)
})

test('a changed closing complete native role model withholds the zero result', async t => {
  replay(t, value => value.url === PAGE5 && value.occurrence === 2 ? { ...value,
    body: jsonChange(value.body, p => { p.jobs[0].data.description += '<p>Changed current native criteria.</p>' }) } : value)
  await assert.rejects(run(), /closing.*inventory|inventory.*changed/i)
})

test('a current corporate handoff removed at closing withholds the zero result', async t => {
  replay(t, value => value.url === CORPORATE && value.occurrence === 2 ? { ...value,
    body: value.body.replaceAll('href="https://jobs.firstcitizens.com/"', 'href="https://unrelated.example/"') } : value)
  await assert.rejects(run(), /corporate|handoff|declaration/i)
})

test('a changed active search renderer withholds the zero result', async t => {
  replay(t, value => value.url === CLIENT && value.occurrence === 2 ? { ...value, body: value.body + '\n// changed current client' } : value)
  await assert.rejects(run(), /client|renderer/i)
})

test('an inert search renderer cannot authorize a native API', async t => {
  replay(t, value => value.url === SEARCH ? { ...value,
    body: value.body.replace('src="' + CLIENT + '"', 'src="https://unrelated.example/client.js"')
      + '<template><script type="module" src="' + CLIENT + '"></script></template>' } : value)
  await assert.rejects(run(), /client|renderer/i)
})

test('a source read denial stays a warning and never becomes empty evidence', async t => {
  replay(t, value => value.url === PAGE1 ? { ...value, body: '<h1>Access denied</h1>', status: 403 } : value)
  await assert.rejects(run(), /HTTP 403|access denied/i)
})
