import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractionRawJobMetrics} from '../../scraper-support/utils/extractionRawJobMetrics.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

// Retained genuine public opening/closing packets; replay keeps their physical clock.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/amber-native-quality.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='amberstudent')
const sourceClock=fixture.requests[0].startedAt
const observations={source:'amberstudent',recordKind:'vacancy-rows',observedRecordCount:14,observedVacancyCount:14,
 sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
function replay(mutate=()=>{}){
 const pending=fixture.requests.map(packet=>structuredClone(packet))
 return {options:{requestIntervalMs:0,now:()=>sourceClock,fetchImpl:async(url,init)=>{
  const packet=pending.shift();assert.ok(packet,'Unexpected request after closing')
  assert.equal(url,packet.requestedURL);assert.equal(init.method,'GET');mutate(packet,pending.length)
  const result=new Response(packet.text,{status:packet.status,headers:packet.headers})
  Object.defineProperty(result,'url',{value:packet.finalURL});return result
 }},get remaining(){return pending.length}}
}
for(const [name,scraper] of [['exported',{run}],['registered',createCatalogScraper(provider)]]){
 test(`Amber ${name} raw diagnostics retain all fourteen observed vacancies while seven country-qualified models return`,async()=>{
  const read=replay(),jobs=await scraper.run(read.options)
  assert.equal(read.remaining,0);assert.equal(jobs.length,7)
  assert.deepEqual(readSourceObservationEvidence(jobs,'amberstudent'),observations)
  assert.deepEqual(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)),{
   rawJobs:14,rawJobsBasis:'observed-native-vacancy-rows'})
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs).verifiedAt,sourceClock)
  assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 })
}
test('Amber result caps retain observed vacancy counts without granting complete company scope',async()=>{
 const read=replay(),jobs=await createCatalogScraper(provider).run({...read.options,maxJobs:2})
 assert.equal(jobs.length,2);assert.equal(read.remaining,0)
 assert.deepEqual(readSourceObservationEvidence(jobs,'amberstudent'),observations)
 assert.equal(extractionRawJobMetrics(provider,jobs,readInventoryEvidence(jobs)).rawJobs,14)
})
test('Amber unobserved zero caps do not fabricate native observation counts',async()=>{
 const jobs=await run({maxJobs:0,fetchImpl:async()=>assert.fail('Zero cap cannot fetch')})
 assert.equal(readSourceObservationEvidence(jobs,'amberstudent'),null)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(jobs[Symbol.for('jobverify.verified-recruitment-observations')].nativePostings,null)
})
