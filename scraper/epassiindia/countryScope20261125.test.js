import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,extractJobylonListings,extractIndiaJobFromDetail,JOBYLON_EMBED_URL} from './script.js'
import {withRetry,getRetryMetadata} from '../../scraper-support/utils/retry.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/country-scope-20261125.json.gz',import.meta.url))))
const packets=fixture.packets.map(packet=>{
 const raw=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(createHash('sha256').update(raw).digest('hex'),packet.bodySHA256)
 return {...packet,body:raw.toString('utf8')}
})
const listings=extractJobylonListings(packets.find(packet=>packet.url===JOBYLON_EMBED_URL).body)
const unresolved=listings.find(row=>row.jobId==='398413')
const detail=packets.find(packet=>packet.url===unresolved.sourceUrl)

test('Epassi retains genuine multiple-location country ambiguity as typed drift with the original role evidence',()=>{
 assert.throws(()=>extractIndiaJobFromDetail(unresolved,detail.body),error=>{
  assert.equal(error.code,'EPASSI_NATIVE_COUNTRY_SCOPE_UNRESOLVED')
  assert.equal(error.softFailure,true)
  assert.equal(error.upstreamOutage,false)
  assert.equal(error.failureKind,'surface_drift_or_fail_closed')
  assert.equal(error.abortRetries,true)
  assert.equal(error.nativeCountryEvidence.jobId,'398413')
  assert.equal(error.nativeCountryEvidence.sourceUrl,'https://emp.jobylon.com/jobs/398413-epassi-organisational-performance-growth-student-worker-fmd/')
  assert.equal(error.nativeCountryEvidence.rawDetailHtml,detail.body)
  assert.equal(error.nativeCountryEvidence.nativeJobPosting.hiringOrganization.name,'Epassi')
  assert.equal(error.nativeCountryEvidence.nativeJobPosting.jobLocation.length,2)
  assert.equal(error.nativeCountryEvidence.nativeJobPosting.jobLocation[0].address.streetAddress,'')
  assert.equal(error.nativeCountryEvidence.nativeJobPosting.jobLocation[1].address.streetAddress,'Munich, Germany')
  return true
 })
})

test('Epassi failed full capture retains16 observations and cannot return a fabricated complete India zero',async()=>{
 let reads=0
 await assert.rejects(run({now:()=>fixture.startedAt,fetchText:async url=>{
  const packet=packets[reads++]
  assert.ok(packet,'Only the complete observed declared public GET sequence')
  assert.equal(url,packet.url)
  assert.equal(packet.status,200)
  return packet.body
 }}),error=>{
  assert.equal(error.code,'EPASSI_NATIVE_COUNTRY_SCOPE_UNRESOLVED')
  assert.equal(error.abortRetries,true)
  assert.equal(error.recruitmentObservations.nativeRecords,16)
  assert.equal(error.recruitmentObservations.returnedIndiaJobs,0)
  assert.equal(error.recruitmentObservations.sourceScopeComplete,false)
  assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false)
  assert.equal(error.nativeCollectionEvidence.observedListings,16)
  assert.equal(error.nativeCollectionEvidence.inspectedListings,16)
  assert.equal(error.nativeCollectionEvidence.failures.length,1)
  assert.equal(error.nativeCollectionEvidence.failures[0].jobId,'398413')
  assert.equal(error.nativeCollectionEvidence.failures[0].nativeCountryEvidence.rawDetailHtml,detail.body)
  return true
 })
 assert.equal(reads,18)
})

test('Epassi role placement in Munich cannot erase the separately advertised blank second location',()=>{
 assert.match(detail.body,/Multiple locations/)
 assert.match(detail.body,/to be based in Munich, Germany/)
 assert.throws(()=>extractIndiaJobFromDetail(unresolved,detail.body),/country location coverage/)
})

test('Epassi deterministic country failure stops the real four-attempt retry boundary after one full capture',async t=>{
 t.mock.method(console,'warn',()=>{})
 let reads=0
 await assert.rejects(withRetry(()=>run({now:()=>fixture.startedAt,fetchText:async url=>{
  const packet=packets[reads++%packets.length]
  assert.equal(url,packet.url)
  return packet.body
 }}),{attempts:4,baseDelayMs:0,label:'epassi-country-contract'}),error=>{
  assert.equal(error.code,'EPASSI_NATIVE_COUNTRY_SCOPE_UNRESOLVED')
  assert.deepEqual(getRetryMetadata(error),{attemptsUsed:1,retries:0,retryDelayMs:0})
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:false,failureKind:'surface_drift_or_fail_closed'})
  assert.equal(error.cause.recruitmentObservations.nativeRecords,16)
  assert.equal(error.cause.nativeCountryEvidence.rawDetailHtml,detail.body)
  return true
 })
 assert.equal(reads,18)
})

for(const [label,original]of [
 ['frozen HTTP error',Object.freeze(Object.assign(new Error('HTTP 503 first native detail'),{status:503}))],
 ['opaque string','opaque first native detail failure'],
 ['null',null],
 ['undefined',undefined],
])test('Epassi evidence attachment preserves the exact first '+label+' after a full failed capture',async()=>{
 let reads=0,thrown=false,actual
 try{await run({now:()=>fixture.startedAt,fetchText:async url=>{
  const packet=packets[reads++]
  assert.equal(url,packet.url)
  if(reads===3)throw original
  return packet.body
 }})}catch(error){thrown=true;actual=error}
 assert.equal(thrown,true)
 assert.equal(actual,original)
 assert.equal(reads,18)
})
