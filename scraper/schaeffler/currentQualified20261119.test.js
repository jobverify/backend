import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {runNative} from './nativeCareers.js'
import {qualifyCurrentSchaefflerRole} from './currentQualified20261119.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-geography-20261119.json.gz',import.meta.url))))
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[]
 for(const row of fixture.responses){
  if(!queues.has(row.requestedUrl))queues.set(row.requestedUrl,[])
  queues.get(row.requestedUrl).push(row)
 }
 return {calls,fetchPage:async(url,init)=>{
  const original=queues.get(url)?.shift();assert.ok(original,'Unbound or repeated native URL '+url)
  const row={...structuredClone(original),html:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  calls.push({url,phase:row.phase,method:init?.method??'GET'});change(row,url)
  row.bodyBase64=Buffer.from(row.html).toString('base64')
  return row
 }}
}

test('current Schaeffler native locations qualify twelve complete India roles with full own closing reconciliation',async()=>{
 const transport=replay(),jobs=await run({fetchPage:transport.fetchPage,now:fixture.observedAt})
 assert.equal(jobs.filter(job=>job.country==='India').length,12)
 assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.jobDescription.length>1000))
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.applyUrl.includes('/talentcommunity/apply/'+job.jobId+'/')))
 assert.ok(jobs.every(job=>job.applicationSubmitted===false&&job.sourceNativeApplication.activationVerified===false))
 assert.equal(transport.calls.length,28)
 assert.equal(jobs.nativeCollectionEvidence.companyScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.originalResponses.length,28)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='schaeffler'),jobs)
 assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.indiaJobs,12)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

const originals=await runNative({fetchPage:replay().fetchPage,now:fixture.observedAt})
const first=originals[0]
for(const location of ['Pune, CA, 412106','Pune, IN, 412106; Toronto','Remote','Pune, IN']){
 test('Schaeffler holds unreviewed whole native workplace '+location,()=>{
  const job=structuredClone(first)
  job.sourceNativeRole.properties.find(field=>field.id==='location').value=location
  assert.throws(()=>qualifyCurrentSchaefflerRole(job,fixture.observedAt),/workplace tuple/)
 })
}
for(const [name,change,reason] of [
 ['explicit foreign country',job=>{job.country='Canada'},/country/],
 ['unknown criteria carrier',job=>{job.sourceNativeRole.properties.push({id:'newMandatoryRequirement',value:'Other country only'})},/carriers/],
 ['closed title',job=>{job.title+=' - POSITION CLOSED';job.sourceNativeRole.properties.find(field=>field.id==='title').value=job.title},/closed/],
 ['disabled application',job=>{job.sourceNativeApplication.originalApplyCTAs[0].attrs['aria-disabled']='true'},/application link/],
 ['other job application',job=>{job.sourceNativeApplication.originalApplyCTAs[0].attrs.href='/talentcommunity/apply/1/?locale=en_US'},/application link/],
 ['missing full qualification',job=>{job.jobDescription='Description available on request.'},/qualifications/],
 ['malformed original closing date',job=>{job.sourceNativeRole.microdataMetas.find(meta=>meta.itemprop==='validThrough').content='Tomorrow'},/date/],
]){
 test('Schaeffler refuses '+name,()=>{
  const job=structuredClone(first);change(job)
  assert.throws(()=>qualifyCurrentSchaefflerRole(job,fixture.observedAt),reason)
 })
}

test('Schaeffler holds an explicitly expired native deadline',()=>{
 assert.throws(()=>qualifyCurrentSchaefflerRole(first,'2030-01-01T00:00:00.000Z'),/deadline/)
})

test('Schaeffler retains both full native snapshots when own criteria change at closing',async()=>{
 const originalHTML=first.sourceNativeRole.originalDescriptionHTML
 const transport=replay((row,url)=>{
  if(row.phase==='closing'&&url===first.sourceUrl)
   row.html=row.html.replace(originalHTML,originalHTML+'<p>Additional mandatory condition at closing.</p>')
 })
 const jobs=await run({fetchPage:transport.fetchPage,now:fixture.observedAt})
 assert.equal(jobs.length,11)
 assert.equal(jobs.some(job=>job.jobId===first.jobId),false)
 const held=jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.jobId===first.jobId)
 assert.match(held.reason,/changed at closing/)
 assert.equal(held.openingRecord.jobDescription,first.jobDescription)
 assert.match(held.closingRecord.jobDescription,/Additional mandatory condition/)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Schaeffler cannot publish opening positives when the closing native category is unavailable',async()=>{
 const transport=replay((row,url)=>{if(row.phase==='closing'&&url.includes('/search/'))row.status=503})
 const jobs=await run({fetchPage:transport.fetchPage,now:fixture.observedAt})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRows.length,12)
 assert.equal(jobs.nativeCollectionEvidence.observations[0].records.length,12)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='schaeffler'),jobs)
 assert.equal(assessment.runnerOutcome.success,false)
 assert.notEqual(assessment.zeroJobEvidence,'fetched-zero')
})

test('Schaeffler exact opaque cancellation interrupts an unresolved original header read',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:true,source:'schaeffler-caller'})
 await assert.rejects(run({signal:caller.signal,fetchPage:()=>{
  caller.abort(reason);return new Promise(()=>{})
 }}),error=>error===reason)
})

test('Schaeffler pre-cancellation precedes job caps and callback validation',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:true,source:'schaeffler-pre-cancel'})
 caller.abort(reason)
 await assert.rejects(run({signal:caller.signal,maxJobs:-1,fetchText:()=>{throw Error('must not read')}}),error=>error===reason)
})
