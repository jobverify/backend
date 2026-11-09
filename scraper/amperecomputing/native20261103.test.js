import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createAmpereComputingScraper,SEARCH_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-talemetry-20261103.json.gz',import.meta.url))))
async function exercise({change=()=>{},beforeRead=()=>{},options={}}={}){
 const fixture=structuredClone(capture),calls=[],audits=[];change(fixture)
 const fetchPage=async url=>{calls.push(url);beforeRead(fixture,url,calls);const page=fixture.responses[url];assert.ok(page,'Unexpected current Ampere GET: '+url);return {...page,url:page.finalUrl}}
 const jobs=await createAmpereComputingScraper().run({fetchPage,onNativeAudit:a=>audits.push(a),...options})
 return {jobs,calls,audits}
}
test('Ampere enumerates all100 native records and30 typed India roles, preserving current full SSR criteria without JSON-LD',async()=>{
 const{jobs,audits}=await exercise()
 assert.equal(jobs.length,30)
 assert.equal(audits[0].publicObservations.length,30)
 assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,30)
 assert.equal(readSourceObservationEvidence(jobs,'amperecomputing').observedRecordCount,100)
 assert.equal(audits[0].nativeRecords.length,100)
 assert.equal(audits[0].indiaNativeRecords.length,30)
 const job=jobs.find(j=>j.jobId==='17874183')
 assert.match(job.sourceDescription,/Bachelor.{0,50}5 years/)
 assert.match(job.sourceDescription,/Preferred Qualifications/)
 assert.equal(job.sourceNativeListingRecord.location.country,'India')
 assert.equal(job.postingDate,null)
 assert.equal(job.remoteStatus,null)
 assert.equal(job.requisitionId,null)
 assert.equal(job.sourceDetailComplete,true)
 assert.equal(job.sourcePrivateApplicationFieldsKnown,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('Ampere reconciles every native page and own closing detail before caller caps',async()=>{
 const{jobs,calls,audits}=await exercise({options:{maxJobs:1}})
 assert.equal(jobs.length,1)
 assert.equal(audits[0].publicObservations.length,30)
 assert.equal(calls.filter(u=>/\/jobs\/\d+-/.test(u)).length,60)
 assert.equal(calls.filter(u=>u===SEARCH_URL+'.json?page=4').length,3)
})
test('Ampere reports public HTTP challenge as blocked inventory rather than empty jobs',async()=>{
 await assert.rejects(createAmpereComputingScraper().run({fetchPage:async url=>({url,status:403,html:'<title>Just a moment...</title>'})}),e=>e.failureKind==='blocked_or_access_denied'&&e.status===403)
})
for(const[label,url,mutate]of[
 ['duplicate native identity',SEARCH_URL+'.json',m=>{m.entries[1]=m.entries[0]}],
 ['unreconciled pagination',SEARCH_URL+'.json?page=2',m=>{m.current_page=1}],
 ['foreign country in exact India facet','https://careers.amperecomputing.com/search/jobs/in/country/india.json',m=>{m.entries[0].location.country='United States'}],
])test('Ampere rejects '+label,async()=>{
 await assert.rejects(exercise({change:f=>{const p=f.responses[url],m=JSON.parse(p.html);mutate(m);p.html=JSON.stringify(m)}}),/Ampere native contract/)
})
test('Ampere rejects conflicting public own role and employer identity',async()=>{
 for(const [before,after]of[['"job_id":"17874183"','"job_id":"99999"'],['"applyCompany":"amperecomputing"','"applyCompany":"othercompany"']]){
  await assert.rejects(exercise({change:f=>{for(const p of Object.values(f.responses))if(p.url.includes('/jobs/17874183'))p.html=p.html.replaceAll(before,after).replaceAll(before.replaceAll('"','&quot;'),after.replaceAll('"','&quot;'))}}),/Ampere native contract/)
 }
})
test('Ampere cancellation precedes native requests',async()=>{
 const reason=Error('stop Ampere');let calls=0
 await assert.rejects(createAmpereComputingScraper().run({signal:AbortSignal.abort(reason),fetchPage:async()=>{calls++}}),e=>e===reason)
 assert.equal(calls,0)
})

test('Ampere preserves cancellation while its injected public reader remains pending',async()=>{
 const controller=new AbortController(),reason=Error('cancel Ampere pending read'),timer=setTimeout(()=>controller.abort(reason),10)
 try{await assert.rejects(createAmpereComputingScraper().run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})}),e=>e===reason)}finally{clearTimeout(timer)}
})

test('Ampere final country-aware native traversal holds a role withdrawn after all closing public descriptions',async()=>{
 const{jobs,audits}=await exercise({beforeRead:(f,url,calls)=>{
  if(url!==SEARCH_URL+'.json'||calls.filter(c=>c===url).length!==3||calls.filter(c=>/\/jobs\/\d+-/.test(c)).length!==60)return
  for(const [base,pages]of[[SEARCH_URL,4],[SEARCH_URL+'/in/country/india',2]]){
   const packets=Array.from({length:pages},(_,i)=>f.responses[base+'.json'+(i?'?page='+(i+1):'')]),models=packets.map(p=>JSON.parse(p.html)),rows=models.flatMap(m=>m.entries).filter(r=>r.id!=='17874183')
   packets.forEach((p,i)=>{const model=models[i];model.total_entries=rows.length;model.entries=rows.slice(i*model.per_page,(i+1)*model.per_page);p.html=JSON.stringify(model)})
  }
 }})
 assert.equal(jobs.length,29)
 assert.ok(jobs.every(j=>j.jobId!=='17874183'))
 assert.equal(audits[0].nativeRecords.length,100)
 assert.equal(audits[0].indiaNativeRecords.length,30)
 assert.equal(audits[0].finalNativeRecords.length,99)
 assert.equal(audits[0].finalIndiaNativeRecords.length,29)
 assert.ok(audits[0].openingPublicDetails.some(f=>f.row.id==='17874183'&&f.description.length>2000))
 assert.equal(audits[0].inventoryStable,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
