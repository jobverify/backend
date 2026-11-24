import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261121.json.gz',import.meta.url))))
const original=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const home='https://www.shivaami.com/',board=home+'careers/',main=home+'assets/index-C15-OIBe.js',career=home+'assets/Careers-wCyxQTtJ.js',css=home+'assets/index-DonCM9UI.css'
async function replay({legacy=false,change,options={}}={}){
 const packets=new Map((legacy?original.packets.filter(row=>row.phase==='opening'):fixture.packets).map(row=>[row.requestedURL,row]))
 const calls=[],seen=new Map()
 const fetchImpl=async(value,init)=>{
  const url=String(value),saved=packets.get(url);assert.ok(saved,'Only exact declared retained packet '+url)
  const occurrence=(seen.get(url)??0)+1;seen.set(url,occurrence);calls.push({url,occurrence,init})
  const packet=structuredClone(saved);packet.body=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
  if(change)change(packet,url,occurrence)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }
 let jobs,error
 try{jobs=await run({now:()=>fixture.capturedAt,requestIntervalMs:0,...options,fetchImpl})}catch(caught){error=caught}
 return{jobs,error,calls}
}

test('coherent current native deployment preserves every original role and full criterion after two complete snapshots',async()=>{
 const result=await replay();assert.ifError(result.error)
 const prior=await replay({legacy:true});assert.ifError(prior.error)
 assert.equal(result.calls.length,20);assert.equal(prior.calls.length,20);assert.equal(result.jobs.length,3)
 assert.deepEqual(result.jobs.nativeCollectionEvidence.nativeRows,prior.jobs.nativeCollectionEvidence.nativeRows)
 assert.deepEqual(result.jobs.nativeCollectionEvidence.closingNativeRows,prior.jobs.nativeCollectionEvidence.closingNativeRows)
 assert.deepEqual(result.jobs.nativeCollectionEvidence.commonBenefits,prior.jobs.nativeCollectionEvidence.commonBenefits)
 assert.deepEqual(result.jobs.map(row=>row.sourceNativeRole),prior.jobs.map(row=>row.sourceNativeRole))
 for(const job of result.jobs){
  assert.equal(job.company,'Shivaami Cloud Services');assert.equal(job.country,'India');assert.equal(job.location,'Mumbai, India')
  assert.equal(job.jobId,null);assert.equal(job.requisitionId,null);assert.equal(job.sourceNativeIdentifier,null);assert.equal(job.sourceCanonicalRoleURL,null)
  assert.equal(job.sourceUrl,board);assert.equal(job.applyUrl,board);assert.equal(job.sourceNativeApplication.selectedProfile,job.title)
  assert.equal(job.sourceNativeApplication.submissionPerformed,false);assert.equal(job.sourceNativeApplication.renderedApplicationQualified,false)
  assert.ok(job.jobDescription.startsWith(job.sourceNativeRole.description));assert.ok(job.jobDescription.includes(job.sourceNativeRole.experience))
  for(const benefit of job.sourceNativeCommonBenefits){assert.ok(job.jobDescription.includes(benefit.title));assert.ok(job.jobDescription.includes(benefit.description))}
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceNativeClosingReconciled,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.postingDate,null);assert.equal(job.firstEverPostedAt,null);assert.equal(job.closingDate,null)
 }
 assert.equal(result.jobs.nativeCollectionEvidence.nativeRows.length,4);assert.equal(result.jobs.nativeCollectionEvidence.holds.length,1)
 assert.equal(result.jobs.nativeCollectionEvidence.holds[0].originalNativeRole.location,'Mulund, Mumbai')
 assert.equal(result.jobs.nativeCollectionEvidence.holds[0].title,'Inside Sales Executive')
 assert.equal(readSourceObservationEvidence(result.jobs,'shivaamicloudservices').observedRecordCount,4)
 const inventory=readInventoryEvidence(result.jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
 assert.ok(result.calls.every(call=>call.init.method==='GET'&&call.init.redirect==='manual'&&call.init.credentials==='omit'))
})

for(const[name,url,mutate]of[
 ['explicit native work country',career,text=>text.replace('Mumbai, India','Mumbai, Nepal')],
 ['whole original criterion',career,text=>text.replace('Excellent communication and interpersonal skills are a must.','Changed mandatory original criterion.')],
 ['added native qualification',career,text=>text.replace('location:"Mumbai, India"','qualifications:"Mandatory unreviewed qualification",location:"Mumbai, India"')],
 ['exact application profile selection',career,text=>text.replace('n("profile",t),f()','n("profile","Unrelated employer role"),f()')],
 ['corporate legal employer',main,text=>text.replace(' Shivaami Cloud Services. All rights reserved.',' Another Employer. All rights reserved.')],
 ['current entry programme',board,text=>text.replace('type="module"','type="application/json"')],
 ['visible applications closure',board,text=>text.replace('</body>','<p>Applications are closed.</p></body>')],
 ['current visibility stylesheet',css,text=>text+'\nbody{visibility:hidden!important}'],
])for(const closingOnly of[false,true])test('coherent current native deployment rejects '+name+(closingOnly?' at closing':' at opening'),async()=>{
 let changed=false
 const result=await replay({change:(packet,requested,n)=>{if(requested!==url||closingOnly&&n===1)return;const updated=mutate(packet.body);assert.notEqual(updated,packet.body,'Mutation must affect the genuine selected current packet');packet.body=updated;changed=true}})
 assert.equal(changed,true);assert.ok(result.error);assert.equal(result.jobs,undefined)
 assert.ok(result.calls.length>=(closingOnly?11:1));assert.equal(result.error.failureKind,'coverage_gap')
})

test('coherent current native deployment rejects old board HTML paired with the new opening homepage',async()=>{
 const legacy=original.packets.find(row=>row.requestedURL===board),oldBody=Buffer.from(legacy.bodyBase64,'base64').toString('utf8')
 const result=await replay({change:(packet,url)=>{if(url===board)packet.body=oldBody}})
 assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.calls.length,2)
})

test('coherent current native deployment cannot switch to the old homepage at closing',async()=>{
 const legacy=original.packets.find(row=>row.requestedURL===home),oldBody=Buffer.from(legacy.bodyBase64,'base64').toString('utf8')
 const result=await replay({change:(packet,url,n)=>{if(url===home&&n===2)packet.body=oldBody}})
 assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.calls.length,11)
})

test('unknown first homepage cannot select a caller supplied deployment profile',async()=>{
 const result=await replay({options:{profile:{assets:{},nativeRoleArray:'w'}},change:(packet,url)=>{if(url===home)packet.body+='<!-- unreviewed deployment -->'}})
 assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.calls.length,1)
})

test('current original content cannot qualify contradictory response MIME',async()=>{
 const result=await replay({change:(packet,url)=>{if(url===home)packet.headers['content-type']='application/json'}})
 assert.ok(result.error);assert.equal(result.jobs,undefined);assert.equal(result.calls.length,1)
})

test('current closing cancellation preserves the exact opaque caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'current cohort closing cancellation'})
 const result=await replay({options:{signal:controller.signal},change:(_packet,url,n)=>{if(url===career&&n===2)controller.abort(reason)}})
 assert.equal(result.error,reason);assert.equal(result.jobs,undefined);assert.equal(result.calls.length,14)
})
