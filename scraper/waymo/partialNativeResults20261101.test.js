import test from 'node:test'
import assert from 'node:assert/strict'
import {accessibleNativePackets as packets} from './test-data/accessibleNativePackets.js'
import {run, buildIndiaSearchUrl, extractJobsFromSearchHtml} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const searchUrl = buildIndiaSearchUrl()
const now = () => '2026-10-31T07:30:00.000Z'
const rows = extractJobsFromSearchHtml(packets.find(packet => packet.url === searchUrl).body, {scrapedAt:now()})
assert.equal(rows.length, 2)
const lastUrl = rows.at(-1).sourceUrl

const replay = (edit = () => {}, calls = []) => async (url, init) => {
  const packet = structuredClone(packets.find(item => item.url === url))
  assert.ok(packet, 'Uncaptured request: ' + url)
  edit(packet, calls, init)
  calls.push(url)
  if (packet.status !== 200) throw Object.assign(Error('Waymo HTTP ' + packet.status), {
    status:packet.status, requestUrl:url, finalUrl:packet.finalUrl,
  })
  return packet.body
}

const nativeFields = job => Object.fromEntries([
  'jobId','nativeJobId','title','sourceUrl','applyUrl','link','requisitionId',
  'country','city','location','jobDescription','sourceDescription','postingDate','postedAt',
  'closingDate','sourcePostedDateRaw','sourceClosingDateRaw','sourceDatePrecision',
  'sourceClosingDatePrecision','nativeJobPosting','nativeCountryAddresses','nativeVisibleLocation',
  'nativeWorkplace','nativeApplicationEvidence','nativeApplicationFailure',
].map(key => [key,job[key]]))

const assertIncomplete = (jobs, count, openingCount = 2) => {
  assert.equal(jobs.length, count)
  for (const job of jobs) {
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailStatus, 'partial')
    assert.equal(job.sourceDetailFailureKind, 'waymo-native-reconciliation-incomplete')
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.activeApplyVerified, false)
    assert.ok(job.jobDescription.length > 1500)
    assert.equal(job.country, 'India')
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(jobs.nativeCollectionEvidence.openingIndiaCount, openingCount)
  assert.equal(jobs.nativeCollectionEvidence.openingClosingReconciled, false)
  assert.equal(jobs.nativeCollectionEvidence.worldwideInventoryComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.applicationCriteriaQualified, false)
  assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.status, 202)
}

const assertIndividuallyReconciled=(jobs,count)=>{
  assert.equal(jobs.length,count)
  assert.ok(jobs.every(job=>job.sourceDetailComplete===true&&job.nativeRoleClosingReconciled===true
    &&job.sourceScopeComplete===false&&job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.equal(jobs.nativeCollectionEvidence.individuallyReconciledRoles,count)
  assert.equal(jobs.nativeCollectionEvidence.worldwideInventoryComplete,false)
  assert.equal(jobs.nativeCollectionEvidence.heldNativeRows.length,rows.length-count)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
}

test('Waymo preserves earlier native facts and stops when a later detail returns HTTP 202', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Native HTTP is forbidden'))
  const complete = await run({fetchText:replay(),now})
  const calls = []
  const jobs = await run({fetchText:replay(packet => {
    if (packet.url === lastUrl) packet.status = 202
  },calls),now})
  assertIncomplete(jobs,1)
  assert.deepEqual(jobs.map(nativeFields), complete.slice(0,1).map(nativeFields))
  assert.equal(calls.filter(url => url === lastUrl).length,1)
  assert.equal(calls.filter(url => url === searchUrl).length,1)
  assert.equal(jobs.nativeCollectionEvidence.closingIndiaCount,null)
  assert.equal(jobs.nativeCollectionEvidence.openingClosingReconciled,false)
  for(const job of jobs)assert.equal(calls.filter(url=>url===job.sourceUrl).length,1)
  assert.equal(calls.at(-1),lastUrl)
  assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.requestUrl,lastUrl)
  assert.ok(jobs.nativeCollectionEvidence.retainedResponses.some(packet => packet.url === rows[0].sourceUrl))
})

test('Waymo retains all opening role facts when the closing listing returns HTTP 202', async () => {
  const jobs = await run({fetchText:replay((packet,calls) => {
    if (packet.url === searchUrl && calls.includes(searchUrl)) packet.status = 202
  }),now})
  assertIncomplete(jobs,2)
  assert.equal(jobs.nativeCollectionEvidence.closingIndiaCount,null)
})

test('Waymo retains opening facts without certifying a blocked closing role', async () => {
  const jobs = await run({fetchText:replay((packet,calls) => {
    if (packet.url === lastUrl && calls.includes(lastUrl)) packet.status = 202
  }),now})
  assertIndividuallyReconciled(jobs,1)
  assert.equal(jobs.nativeCollectionEvidence.closingIndiaCount,2)
})

test('Waymo still throws when the first detail is unavailable and no native role was proved', async () => {
  await assert.rejects(run({fetchText:replay(packet => {
    if (packet.url === rows[0].sourceUrl) packet.status = 202
  }),now}),error => error.status === 202 && error.inventoryEvidence.listingComplete === false)
})

test('Waymo never turns a later explicit country conflict into successful partial extraction', async () => {
  await assert.rejects(run({fetchText:replay(packet => {
    if (packet.url === lastUrl) packet.body = packet.body.replace(/("addressCountry"\s*:\s*")IN("|\s)/, '$1US$2')
  }),now}),error => error.code === 'WAYMO_NATIVE_PROOF' && /country/i.test(error.message))
})

test('Waymo preserves exact caller cancellation even after earlier roles were read', async () => {
  const controller = new AbortController()
  const reason = Object.assign(Error('Stop the caller operation'),{status:202})
  await assert.rejects(run({signal:controller.signal,fetchText:replay(packet => {
    if (packet.url === lastUrl) {
      controller.abort(reason)
      throw reason
    }
  }),now}), error => error === reason)
})

test('Waymo keeps unclassified programming or transport errors visible after earlier roles', async () => {
  const failure = new TypeError('Unexpected response implementation')
  await assert.rejects(run({fetchText:replay(packet => {
    if (packet.url === lastUrl) throw failure
  }),now}),error => error === failure)
})

for (const status of [202,200]) test('Waymo keeps a later foreign final URL as a transport failure for HTTP '+status, async t => {
  const foreignUrl='https://unrelated.invalid/jobs/blocked'
  t.mock.method(globalThis,'fetch',async url => {
    const packet=packets.find(item=>item.url===url)
    assert.ok(packet,'Uncaptured request: '+url)
    const response=new Response(packet.body,{status:url===lastUrl?status:packet.status,headers:{'content-type':'text/html; charset=utf-8'}})
    Object.defineProperty(response,'url',{value:url===lastUrl?foreignUrl:packet.finalUrl})
    return response
  })
  await assert.rejects(run({now}),error => error.status===status&&error.requestUrl===lastUrl&&error.finalUrl===foreignUrl)
})

test('Waymo rejects a later HTTP 202 error attributed to a different requested URL', async () => {
  const failure=Object.assign(Error('Wrong request identity'),{status:202,requestUrl:'https://unrelated.invalid/jobs/blocked'})
  await assert.rejects(run({fetchText:replay(packet => {
    if(packet.url===lastUrl)throw failure
  }),now}),error=>error===failure)
})
