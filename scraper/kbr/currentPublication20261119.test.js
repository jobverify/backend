import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-publication-20261119.json.gz',import.meta.url))))
const snapshots=fixture.responses.filter(row=>row.phase==='opening'&&row.url.endsWith('/data/kbr-jobs.json'))
const snapshot=JSON.parse(Buffer.from(snapshots[0].bodyBase64,'base64'))
const nativeIndia=snapshot.jobs.filter(row=>row.location.endsWith(', India')&&row.application_url)
const target=nativeIndia[0]
const replay=(change=()=>{})=>{
 const queues=new Map(),calls=[]
 for(const response of fixture.responses){
  if(!queues.has(response.requestedUrl))queues.set(response.requestedUrl,[])
  queues.get(response.requestedUrl).push(response)
 }
 return {calls,fetchText:async()=>{throw Error('Legacy body-only Workday hydration still blocks native published jobs')},fetchPage:async(url,init)=>{
  const original=queues.get(url)?.shift();assert.ok(original,'Unbound original URL '+url)
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString('utf8')}
  change(row,url);calls.push({url,phase:row.phase,method:init?.method??'GET'})
  row.bodyBase64=Buffer.from(row.body).toString('base64');return row
 }}
}

test('KBR publishes current own linked India roles without blocked unrelated Workday country hydration',async()=>{
 const transport=replay(),jobs=await run({...transport,now:()=>fixture.observedAt})
 assert.equal(jobs.length,59);assert.equal(jobs.length,nativeIndia.length)
 assert.equal(transport.calls.length,fixture.responses.length)
 assert.ok(transport.calls.every(row=>row.method==='GET'&&!row.url.includes('/wday/cxs/')))
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===false&&job.postingDate===null))
 assert.ok(jobs.every(job=>job.sourceNativeRecord.requisition_status==='Open'&&job.sourceClosingReconciled))
 assert.ok(jobs.every(job=>job.backendApplicationActivationVerified===false&&job.applicationSubmitted===false))
 assert.equal(jobs.nativeCollectionEvidence.openingSnapshot.jobs.length,snapshot.jobs.length)
 assert.equal(jobs.nativeCollectionEvidence.unlinkedIndiaRows.length,2)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='kbr'),jobs)
 assert.equal(assessment.indiaJobs,59);assert.equal(assessment.runnerOutcome.success,true)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

for(const [name,change,reason] of [
 ['foreign country',row=>{row.location='Chennai, Tamil Nadu, Canada'},/India|country/i],
 ['closed native requisition',row=>{row.requisition_status='Closed'},/open|publication/i],
 ['another employer application',row=>{row.application_url=row.application_url.replace('kbr.wd5.','other.wd5.')},/application|employer/i],
 ['other requisition application',row=>{row.application_url=row.application_url.replace(row.id,'R9999999')},/application|requisition/i],
 ['explicit closure title',row=>{row.title+=' - Position Closed'},/closed/i],
 ['mixed foreign and India workplaces',row=>{row.location='Toronto, Ontario, Canada / Chennai, Tamil Nadu, India'},/country|workplace/i],
 ['past explicit expiry',row=>{row.validThrough='2020-01-01'},/expired|deadline/i],
 ['past application deadline',row=>{row.application_deadline='2020-01-01'},/expired|deadline/i],
 ['malformed native expiry',row=>{row.validThrough='Tomorrow'},/deadline|date/i],
 ['contradictory native country code',row=>{row.countryCode='CA'},/country/i],
 ['disabled native application',row=>{row.canApply=false},/publication|application/i],
 ['explicit closure marker',row=>{row.title='[CLOSED] '+row.title},/closed/i],
 ['future native publication',row=>{row.datePosted='2099-01-01'},/publication|date/i],
])test('KBR retains and holds '+name+' without discarding valid current roles',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/data/kbr-jobs.json')){
   const data=JSON.parse(row.body);change(data.jobs.find(job=>job.id===target.id));row.body=JSON.stringify(data)
  }
 })
 const jobs=await run({...transport,now:()=>fixture.observedAt})
 assert.equal(jobs.length,58)
 const held=jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.jobId===target.id)
 assert.match(held.reason,reason);assert.ok(held.openingRecord);assert.ok(held.closingRecord)
})

test('KBR accepts current legitimate title changes with the original requisition application identity',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/data/kbr-jobs.json')){
   const data=JSON.parse(row.body);data.jobs.find(job=>job.id===target.id).title='Updated current role title';row.body=JSON.stringify(data)
  }
 })
 const jobs=await run({...transport,now:()=>fixture.observedAt})
 assert.equal(jobs.length,59);assert.equal(jobs.find(job=>job.jobId===target.id).title,'Updated current role title')
})

test('KBR accepts a legitimate new whole India workplace without a frozen city profile',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/data/kbr-jobs.json')){
   const data=JSON.parse(row.body);data.jobs.find(job=>job.id===target.id).location='Jaipur, Rajasthan, India';row.body=JSON.stringify(data)
  }
 })
 const jobs=await run({...transport,now:()=>fixture.observedAt}),job=jobs.find(job=>job.jobId===target.id)
 assert.equal(jobs.length,59);assert.equal(job.city,'Jaipur');assert.equal(job.state,'Rajasthan');assert.equal(job.country,'India')
})

test('KBR preserves explicit original publication and future deadline without substituting snapshot refresh date',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/data/kbr-jobs.json')){
   const data=JSON.parse(row.body);Object.assign(data.jobs.find(job=>job.id===target.id),{datePosted:'2026-11-18',validThrough:'2030-01-01'})
   row.body=JSON.stringify(data)
  }
 })
 const jobs=await run({...transport,now:()=>fixture.observedAt}),job=jobs.find(job=>job.jobId===target.id)
 assert.equal(jobs.length,59);assert.equal(job.postingDate,'2026-11-18');assert.equal(job.closingDate,'2030-01-01')
 assert.equal(job.sourceNativeRecord.datePosted,'2026-11-18');assert.equal(job.sourceNativeRecord.validThrough,'2030-01-01')
})

test('KBR retains both complete models when unknown native criteria change at closing',async()=>{
 const transport=replay((row,url)=>{
  if(url.endsWith('/data/kbr-jobs.json')){
   const data=JSON.parse(row.body);data.jobs.find(job=>job.id===target.id).unknown_native_field={value:row.phase};row.body=JSON.stringify(data)
  }
 })
 const jobs=await run({...transport,now:()=>fixture.observedAt})
 assert.equal(jobs.length,58)
 const held=jobs.nativeCollectionEvidence.heldNativeRows.find(row=>row.jobId===target.id)
 assert.equal(held.openingRecord.unknown_native_field.value,'opening')
 assert.equal(held.closingRecord.unknown_native_field.value,'closing')
})

for(const [name,change] of [
 ['missing original redirect proof',row=>{delete row.redirected}],
 ['wrong original MIME',row=>{if(row.url.endsWith('.json'))row.headers['content-type']='text/html'}],
 ['unavailable closing feed',row=>{if(row.phase==='closing'&&row.url.endsWith('/data/kbr-jobs.json'))row.status=503}],
 ['stale native feed',row=>{if(row.url.endsWith('/data/kbr-jobs.json')){const data=JSON.parse(row.body);data.generated_at='2020-01-01';row.body=JSON.stringify(data)}}],
 ['duplicate native identity',row=>{if(row.url.endsWith('/data/kbr-jobs.json')){const data=JSON.parse(row.body);data.jobs[1].id=data.jobs[0].id;row.body=JSON.stringify(data)}}],
 ['foreign redirect',row=>{if(row.status===302)row.headers.location='https://example.org/'}],
])test('KBR cannot report recovery from '+name,async()=>{
 await assert.rejects(run({...replay(change),now:()=>fixture.observedAt}))
})

test('KBR preserves opaque caller cancellation during an unresolved original header read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({stop:'caller'})
 const promise=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{}),fetchText:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(promise,error=>error===reason)
})
