import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {createCurrentLogicFruitRenderer,qualifyCurrentLogicFruitRecord} from './currentRenderer20261119.js'

const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-qualified-20261119.json.gz',import.meta.url))))
const LIST='https://api.logic-fruit.com/api/jobs?status=published'
const records=JSON.parse(Buffer.from(originals.find(row=>row.requestedUrl===LIST).bodyBase64,'base64')).data
const replay=(change=()=>{})=>{
 const calls=[]
 return {calls,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET')
  const original=originals.find(row=>row.requestedUrl===url)
  assert.ok(original,'Unbound URL '+url)
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  calls.push(url);change(row,url)
  const response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.url})
  return response
 }}
}

test('Logic Fruit qualifies nine published own roles through its exact active SPA renderer while retaining real404 evidence',async()=>{
 const transport=replay(),jobs=await run({fetchImpl:transport.fetchImpl})
 assert.equal(jobs.length,9)
 assert.deepEqual(jobs.map(job=>job.sourceNativeJobRecord),records)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.requisitionId===null))
 assert.ok(jobs.every(job=>job.postingDate===null&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.sourceURLHTTPStatus===404&&job.applyUrl===job.sourceUrl))
 assert.equal(jobs.nativeCollectionEvidence.renderedInventoryBindingVerified,true)
 assert.equal(jobs.nativeCollectionEvidence.applicationInteractions,0)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,9)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(transport.calls.length,48)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='logicfruittechnologies'),jobs)
 assert.equal(assessment.runnerOutcome.success,true)
 assert.equal(assessment.indiaJobs,9)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

for(const location of ['Remote','Gurugram, Canada','Gurugram / London','Bengaluru Worldwide']){
 test('Logic Fruit rejects the complete unqualified native location '+location,()=>{
  assert.throws(()=>qualifyCurrentLogicFruitRecord({...records[0],location},404),/location/)
 })
}
for(const [field,value,reason] of [
 ['overview','This position is closed and we are no longer accepting applications. '.repeat(3),/closed/],
 ['overview',records[0].overview+'\nThis position has been closed.',/closed/],
 ['overview',records[0].overview+'\nThis job is no longer available.',/closed/],
 ['title',records[0].title+' - POSITION CLOSED',/closed/],
 ['qualifications',records[0].qualifications+'\nWork Country: Canada.',/country/],
 ['qualifications',records[0].qualifications+'\n**Work Country:** Canada.',/country/],
 ['qualifications',records[0].qualifications+'\n**Work Country**: Canada.',/country/],
 ['qualifications',records[0].qualifications+'\nEmployer: Other Company.',/employer/],
 ['qualifications',records[0].qualifications+'\n**Hiring company:** Other Company.',/employer/],
 ['qualifications',records[0].qualifications+'\n**Hiring company**: Other Company.',/employer/],
 ['qualifications','Details on request.',/criteria/],
 ['canonicalUrl','https://other-employer.test/jobs/123',/canonical/],
 ['newMandatoryCondition','Canadian citizenship required',/field/],
]){
 test('Logic Fruit refuses unqualified own record '+field,()=>{
  assert.throws(()=>qualifyCurrentLogicFruitRecord({...records[0],[field]:value},404),reason)
 })
}

for(const mode of ['other404','denied','stylesheet']){
 test('Logic Fruit holds '+mode+' instead of treating arbitrary errors or presentation as the active app',async()=>{
  const own='https://www.logic-fruit.com/jobs-current-opening/'+records[0].slug+'/'
  const transport=replay((row,url)=>{
   if(mode==='other404'&&url===own)row.body='<html><body>Not found</body></html>'
   if(mode==='denied'&&url===own)row.status=403
   if(mode==='stylesheet'&&url.endsWith('/index-Beph4yMq.css'))row.body+='\n.job-apply-form{display:none!important}'
  })
  await assert.rejects(run({fetchImpl:transport.fetchImpl}),/SPA shell|HTTP status|stylesheet/)
 })
}

test('Logic Fruit caller cancellation during an own404 route retains the opaque reason',async()=>{
 const caller=new AbortController(),reason=Object.freeze({opaque:true,source:'logicfruit-own-route'})
 const own='https://www.logic-fruit.com/jobs-current-opening/'+records[0].slug+'/'
 const transport=replay((row,url)=>{if(url===own)caller.abort(reason)})
 await assert.rejects(run({fetchImpl:transport.fetchImpl,signal:caller.signal}),error=>error===reason)
})

test('Logic Fruit refuses renderer receipts whose original body was unavailable',async()=>{
 const own='https://www.logic-fruit.com/jobs-current-opening/'+records[0].slug+'/'
 const original=originals.find(row=>row.requestedUrl===own)
 const renderer=createCurrentLogicFruitRenderer({fetchPage:async()=>({...original,finalUrl:own,
  body:Buffer.from(original.bodyBase64,'base64').toString('utf8'),bodyUnavailable:true})})
 await assert.rejects(renderer.role(records[0],'opening'),/original renderer HTTP metadata/)
})
