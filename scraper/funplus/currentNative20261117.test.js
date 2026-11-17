import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const replay=(edit=(p,body)=>body)=>{
 const counts=new Map(),reads=[]
 return {reads,options:{now:()=>fixture.now,requestIntervalMs:0,fetchImpl:async(input,init={})=>{
  const url=String(input),p=fixture.responses.find(r=>r.requestedURL===url)
  assert.ok(p,'Only exact currently declared public reads '+url)
  assert.ok(!init.method||init.method==='GET','Never submit an application')
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  reads.push(url);const count=(counts.get(url)||0)+1;counts.set(url,count)
  const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString('utf8'),count)
  return Object.defineProperty(new Response(changed,{status:p.status,headers:{'content-type':p.headers['content-type']}}),'url',{value:p.url})
 }}}
}
test('current original FunPlus relative native role retains full foreign criteria and application under scope holds',async()=>{
 const {options,reads}=replay(),jobs=await run(options)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'329858');assert.equal(jobs[0].country,'Portugal')
 assert.match(jobs[0].jobDescription,/Minimum of 3 years/);assert.match(jobs[0].jobDescription,/Bachelor/)
 assert.match(jobs[0].jobDescription,/Studio Ellipsis/);assert.match(jobs[0].jobDescription,/Passion for Gaming/)
 assert.equal(jobs[0].nativeEmployerName,'Studio Ellipsis');assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.equal(jobs[0].nativeSourceRecord.application.fields.some(f=>f.attrs.name==='consent_to_talent_pool'),true)
 assert.equal(readSourceObservationEvidence(jobs,'funplus').observedRecordCount,1)
 assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'funplus',companyName:'FunPlus'},jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,1);assert.equal(assessment.runnerOutcome.filteredNonIndia,1)
 assert.equal(assessment.runnerOutcome.eligibleJobs,0);assert.equal(assessment.cleanupOptions.replaceExisting,false)
 assert.equal(reads.length,12)
})
test('FunPlus finite profile rejects inert handoff, native country/full criteria/application/program drift and mixed closing',async()=>{
 for(const mode of ['inert-carrier','country','qualification','application','program','closing-row','logo-object']){
  const {options}=replay((p,body,count)=>{
   if(mode==='inert-carrier'&&p.requestedURL==='https://funplus.com/careers/')return body.replace('<section class="career-list','<section hidden class="career-list')
   if(p.requestedURL.includes('/job_posting/')&&mode==='country')return body.replaceAll('Lisbon, Lisbon, Portugal','Lisbon, Lisbon, India')
   if(p.requestedURL.includes('/job_posting/')&&mode==='qualification')return body.replace('Minimum of 3 years','Minimum of 1 year')
   if(p.requestedURL.includes('/apply/')&&mode==='application')return body.replace("name='cv'","name='missing_cv'")
   if(p.requestedURL.includes('/CompanyPages/')&&mode==='program')return body+';window.location="https://other.example"'
   if(p.requestedURL.endsWith('/embed/jobs')&&mode==='closing-row'&&count===2)return body.replace('senior-level-artist-329858','another-role-999999')
   if(p.requestedURL.endsWith('/embed/jobs')&&mode==='logo-object')return body.replaceAll('tn60hau4qmpak1hgzeny6e54gonv','other-employer-object')
   return body
  })
  await assert.rejects(run(options),/current|profile|handoff|model|contract/i,mode)
 }
})
test('actual later original signed passive logo preserves its exact object and all native models',async()=>{
 const {options}=replay((packet,body)=>packet.requestedURL.endsWith('/embed/jobs')
  ?Buffer.from(fixture.currentSignedImageOriginal.bodyBase64,'base64').toString('utf8'):body)
 const jobs=await run(options);assert.equal(jobs.length,1);assert.equal(jobs[0].country,'Portugal')
 assert.equal(jobs.nativeCollectionEvidence.unknownPassiveContextComplete,false)
})
test('FunPlus caller opaque abort and blocked HTTP retain their meanings without later reads',async()=>{
 const owner=new AbortController(),reason={nativeOwner:'stop'},fixtureRun=replay()
 owner.abort(reason);await assert.rejects(run({...fixtureRun.options,signal:owner.signal}),e=>e===reason)
 assert.equal(fixtureRun.reads.length,0)
 let reads=0
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>{
  reads++;return Object.defineProperty(new Response('blocked',{status:429,headers:{'content-type':'text/html'}}),'url',{value:String(url)})
 }}),e=>e.status===429&&e.failureKind==='blocked_or_access_denied')
 assert.equal(reads,1)
})
test('FunPlus zero cap retains an unobserved inventory hold and makes no public requests',async()=>{
 const {options,reads}=replay(),jobs=await run({...options,maxJobs:0})
 assert.equal(jobs.length,0);assert.equal(reads.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'funplus'),null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
