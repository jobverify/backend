import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper, getScraperCatalog} from '../../scraper-support/providers/index.js'
import {attachInventoryEvidence, readInventoryEvidence, sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {qualifyWorleyCriteria} from './script.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/worley20261114-native.json.gz', import.meta.url))))
const packets = fixture.responses.map(row => ({...row, body:Buffer.from(row.bodyBase64, 'base64')}))
const parsed = packets.map(row => ({...row, payload:JSON.parse(row.body)}))
const nativeRows = parsed.flatMap(row => row.payload.data?.positions || [])
const badID = '1133910365035', goodID = String(fixture.mappedJobs[0].jobId)
const detail = id => parsed.find(row => new URL(row.url).searchParams.get('position_id') === String(id))

// Test controls change only the selected listing cohort/total. Every role and
// detail starts from the complete genuine native response, without generated criteria.
async function registeredReplay(ids, mutate = () => {}) {
  const calls = [], originalFetch = globalThis.fetch
  const listing = structuredClone(parsed.find(row => row.payload.data?.positions).payload)
  listing.data.positions = ids.map(id => structuredClone(nativeRows.find(row => String(row.id) === id)))
  listing.data.count = ids.length
  globalThis.fetch = async (url, options) => {
    options.signal?.throwIfAborted()
    calls.push(String(url))
    const target = new URL(url)
    assert.equal(target.origin, 'https://jobs.worley.com')
    let payload
    if (target.pathname === '/api/pcsx/search') {
      assert.equal(target.searchParams.get('start'), '0')
      payload = structuredClone(listing)
    } else {
      assert.equal(target.pathname, '/api/pcsx/position_details')
      payload = structuredClone(detail(target.searchParams.get('position_id')).payload)
    }
    mutate(payload, target)
    return new Response(JSON.stringify(payload), {status:200, headers:{'content-type':'application/json'}})
  }
  try {
    return {jobs:await createCatalogScraper(getScraperCatalog().find(row => row.source === 'worley')).run(), calls}
  } finally {globalThis.fetch = originalFetch}
}

test('genuine Worley response fixture preserves every original entity and the original 137 mapped roles', () => {
  assert.equal(packets.length, 151)
  assert.equal(fixture.mappedJobs.length, 137)
  for (const packet of packets) {
    assert.equal(packet.body.length, packet.bytes)
    assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
    assert.equal(packet.status, 200)
    assert.equal(packet.finalURL, packet.url)
  }
  assert.match(detail(badID).payload.data.jobDescription, /Recruiter to copy a Job Description here/)
  assert.match(detail(badID).payload.data.jobDescription, /Recruiter to paste Qualifications\/Requirements of the job here/)
})

test('registered Worley reader quarantines genuine recruiter placeholders and preserves the complete native description in its audit', async () => {
  const {jobs, calls} = await registeredReplay([goodID, badID])
  assert.deepEqual(jobs.map(job => String(job.jobId)), [goodID])
  assert.equal(calls.length, 3)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.candidateDetails, 2)
  assert.equal(audit.extractedDetailJobs, 1)
  assert.equal(audit.failures.length, 1)
  assert.equal(audit.failures[0].nativeJobId, badID)
  assert.equal(audit.failures[0].nativeDescription, detail(badID).payload.data.jobDescription)
  assert.equal(jobs[0].jobDescription, detail(goodID).payload.data.jobDescription)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('all-placeholder Worley cohort remains a protected coverage gap instead of a verified zero', async () => {
  const {jobs, calls} = await registeredReplay([badID])
  assert.equal(jobs.length, 0)
  assert.equal(calls.length, 2)
  assert.equal(jobs.nativeCollectionEvidence.failures.length, 1)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('all 137 original mapped roles are reconciled before the sole placeholder is quarantined, without mutating native data', () => {
  const original = structuredClone(fixture.mappedJobs), before = JSON.stringify(original)
  attachInventoryEvidence(original, {status:'complete-inventory', firstParty:true,
    surface:'https://jobs.worley.com/api/pcsx/search', listingComplete:true, pagesFetched:14,
    reportedTotal:137, indiaFacetCount:137, verifiedAt:'2026-11-14T19:22:22.451Z'})
  const qualified = qualifyWorleyCriteria(original)
  assert.equal(JSON.stringify(original), before)
  assert.equal(qualified.length, 136)
  assert.equal(qualified.nativeCollectionEvidence.candidateDetails, 137)
  assert.equal(qualified.nativeCollectionEvidence.failures.length, 1)
  assert.equal(readInventoryEvidence(qualified).reportedTotal, 137)
  for (const job of qualified) {
    const prior = original.find(row => row.jobId === job.jobId)
    for (const field of ['title','company','jobId','requisitionId','jobDescription','sourceDescription',
      'sourceUrl','applyUrl','country','location','locations','sourceNativeLocations','sourceStandardizedLocations','postingDate']) {
      assert.deepEqual(job[field], prior[field], field + ':' + job.jobId)
    }
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.deepEqual(qualified.nativeCollectionEvidence.failures[0].nativeRole,
    original.find(row => String(row.jobId) === badID))
})

for (const [label, html] of [
  ['case and whitespace','<p>RECRUITER\n TO\tPASTE Qualifications/Requirements here</p>'],
  ['inline markup','<p><b>Recruiter</b> to <em>copy</em> a Job Description here</p>'],
  ['native HTML entities','<p>Recruiter&nbsp;to&#32;paste Qualifications here</p>'],
  ['empty role text','<p> </p>'],
  ['missing role text',null],
]) test('source qualification holds ' + label + ' without altering its original text', () => {
  const job = {...fixture.mappedJobs[0], jobDescription:html}
  const jobs = qualifyWorleyCriteria([job])
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.failures[0].nativeDescription, html)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('ordinary substantive duties retain exact dates and all native locations, including mixed-country workplaces', () => {
  const original = fixture.mappedJobs.find(job => String(job.jobId) === '1133916251665')
  assert.ok(original)
  const jobs = qualifyWorleyCriteria([original])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].postingDate, original.postingDate)
  assert.deepEqual(jobs[0].sourceStandardizedLocations, original.sourceStandardizedLocations)
  assert.deepEqual(jobs[0].sourceNativeLocations, original.sourceNativeLocations)
  assert.equal(jobs.nativeCollectionEvidence.failures.length, 0)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const status of [401,403,429,451]) test('registered native HTTP' + status + ' still fails without a fake zero or extra discovery', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {calls++; return new Response(null, {status})}
  try {
    await assert.rejects(createCatalogScraper(getScraperCatalog().find(row => row.source === 'worley')).run(), error => error.status === status)
    assert.equal(calls, 1)
  } finally {globalThis.fetch = originalFetch}
})

test('caller cancellation preserves the original reason before any native request', async () => {
  const controller = new AbortController(), reason = Error('cancel Worley original native reader')
  controller.abort(reason)
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {calls++; throw Error('unexpected request after cancellation')}
  try {
    await assert.rejects(createCatalogScraper(getScraperCatalog().find(row => row.source === 'worley')).run({signal:controller.signal}), error => error === reason)
    assert.equal(calls, 0)
  } finally {globalThis.fetch = originalFetch}
})

test('registered native detail identity mismatch remains a failure instead of being quarantined as missing criteria', async () => {
  await assert.rejects(registeredReplay([goodID], (payload, url) => {
    if (url.pathname.endsWith('/position_details')) payload.data.name += ' conflicting role'
  }), /detail identity mismatch: name/)
})
