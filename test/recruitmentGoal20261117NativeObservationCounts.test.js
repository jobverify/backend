import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../scripts/softFailureAssessment20261113.mjs'

const observationSymbol=Symbol.for('jobverify.verified-recruitment-observations')
const cases=[
 {source:'condenast',records:7,vacancies:7,prospects:0,qualified:7,held:0,kind:'vacancy-rows',reads:26,now:'2026-11-06T02:30:00.000Z'},
 {source:'kkr',records:136,vacancies:132,prospects:4,qualified:19,held:0,kind:'mixed',reads:10,now:'2026-11-06T00:30:00.000Z'},
 {source:'precisely',records:26,vacancies:25,prospects:1,qualified:9,held:6,kind:'mixed',reads:8,now:'2026-11-05T23:59:00.000Z'},
]
async function replay(t,c,options={},mutate=()=>{}){
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL(`./test-data/recruitmentGoal20261104/${c.source}-native-quality.json.gz`,import.meta.url))))
 const provider=getScraperCatalog().find(p=>p.source===c.source),calls=[],audits=[]
 const fetchImpl=async(url,init={})=>{
  const packet=structuredClone(fixture.packets.find(p=>p.requestedURL===String(url)&&(p.method??'GET')===(init.method??'GET')&&(p.body??'')===(init.body??'')))
  assert.ok(packet,'Only exact historical source originals may be replayed: '+url)
  calls.push({url:String(url),method:init.method??'GET',body:init.body??''});mutate(packet)
  return Object.defineProperty(new Response(packet.bodyText,{status:packet.status,headers:packet.headers??{'content-type':packet.contentType}}),'url',{value:packet.finalURL})
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const jobs=await createCatalogScraper(provider).run({fetchImpl,minIntervalMs:0,requestIntervalMs:0,now:()=>c.now,onAudit:a=>audits.push(a),...options})
 return {jobs,audits,calls,provider}
}
function verifyReceipt(c,jobs,provider){
 const expected={source:c.source,recordKind:c.kind,observedRecordCount:c.records,observedVacancyCount:c.vacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
 assert.deepEqual(readSourceObservationEvidence(jobs,c.source),expected)
 assert.deepEqual(jobs.nativeCollectionEvidence,expected)
 assert.equal(readSourceObservationEvidence(jobs,'another-source'),null)
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,c.vacancies)
 assert.deepEqual(assessment.runnerOutcome.sourceObservations,expected)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
}
for(const c of cases){
 test(`${c.source} registered historical originals retain canonical full native observations and separate vacancy counts`,async t=>{
  const {jobs,audits,calls,provider}=await replay(t,c)
  assert.equal(jobs.length,c.qualified);assert.equal(calls.length,c.reads);verifyReceipt(c,jobs,provider)
  const audit=jobs[observationSymbol]
  assert.deepEqual(audit,audits[0]);assert.deepEqual(jobs[0].sourceNativeCollectionAudit,audit)
  assert.equal(audit.nativeRecords,c.records);assert.equal(audit.nativeRoleClosingReconciled,c.qualified)
  assert.equal(audit.heldNativeRows.length,c.held)
  if(c.source!=='condenast'){
   assert.equal(audit.opening.feed.jobs.length,c.records)
   assert.equal(audit.excludedNativeRows.filter(r=>r.reason==='native-prospect-post').length,c.prospects)
   assert.equal(audit.opening.feed.jobs.filter(r=>Object.hasOwn(r,'internal_job_id')&&r.internal_job_id===null).length,c.prospects)
  }
  assert.ok(audit.unresolved.includes('company-recruitment-scope-unverified'))
  assert.equal(jobs[0].sourceNativeRetainedResponses.length,c.reads)
 })
 test(`${c.source} caller result cap retains the whole hydrated native observation cohort`,async t=>{
  const {jobs,calls,provider}=await replay(t,c,{maxJobs:1})
  assert.equal(jobs.length,1);assert.equal(calls.length,c.reads);verifyReceipt(c,jobs,provider)
  assert.equal(jobs[observationSymbol].nativeRoleClosingReconciled,c.qualified)
  assert.ok(jobs[observationSymbol].unresolved.includes('caller-result-limit'))
 })
 test(`${c.source} no-read caller cap never invents observed native zero counts`,async t=>{
  const {jobs,calls}=await replay(t,c,{maxJobs:0})
  assert.equal(jobs.length,0);assert.equal(calls.length,0)
  assert.equal(readSourceObservationEvidence(jobs,c.source),null)
  assert.equal(jobs[observationSymbol].nativeRecords,null)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 })
}
test('Precisely held own-country observations remain in full native counts without becoming qualified jobs',async t=>{
 const c=cases.find(c=>c.source==='precisely')
 const {jobs,provider}=await replay(t,c,{},packet=>{
  if(!packet.requestedURL.includes('boards-api.greenhouse.io/'))return
  const feed=JSON.parse(packet.bodyText);feed.jobs.find(r=>r.id===4737662005).location.name='Bangalore';packet.bodyText=JSON.stringify(feed)
 })
 assert.equal(jobs.length,8);verifyReceipt(c,jobs,provider)
 assert.equal(jobs[observationSymbol].heldNativeRows.length,7)
 assert.ok(jobs[observationSymbol].heldNativeRows.some(r=>r.record.id===4737662005&&r.reason==='native-country-unproven'))
})
