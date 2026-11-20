import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runFrugalNative,frugalRole,APPLICATION} from './native.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=change=>{const counts=new Map(),reads=[];return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
 const index=counts.get(url)??0;counts.set(url,index+1)
 const row=fixture.responses.filter(r=>r.requestedUrl===url)[index];assert.ok(row,'Only genuine declared source reads '+url)
 assert.equal(init.method??'GET','GET');assert.equal(init.redirect,'manual');reads.push(url)
 const html=Buffer.from(row.bodyBase64,'base64').toString(),body=change?change(url,html,index):html
 return Object.defineProperty(new Response(body,{status:row.status,headers:row.headers}),'url',{value:row.url})
}}}}

test('three full Hyderabad roles qualify only with the same-role Gachibowli relocation form and matching closing native records',async()=>{
 const io=replay(),jobs=await runFrugalNative(io.options)
 assert.equal(jobs.filter(j=>j.country==='India').length,3)
 assert.ok(jobs.every(j=>j.location==='Hyderabad'&&j.city==='Hyderabad'&&j.sourceClosingQualified&&j.sourceDetailComplete))
 assert.ok(jobs.every(j=>j.sourceCountryEvidence.kind==='native-role-and-same-role-relocation-worksite-geography'))
 assert.ok(jobs.every(j=>j.sourceApplicationHandoff.roleOption.value===j.jobId&&j.sourceApplicationHandoff.roleOption.title===j.title))
 assert.ok(jobs.every(j=>j.sourceApplicationHandoff.activationVerified===false&&j.postingDate===null&&j.closingDate===null&&j.requisitionId===null))
 assert.equal(io.reads.length,10)
 const assessed=assessSoftFailureAcquisition({source:'frugaltesting',companyName:'Frugal Testing'},jobs)
 assert.equal(assessed.indiaJobs,3);assert.equal(assessed.runnerOutcome.success,true);assert.equal(assessed.cleanupOptions.replaceExisting,false)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
})

test('Hyderabad alone remains unresolved without the independent native same-role relocation proof',()=>{
 const row=fixture.responses.find(r=>r.requestedUrl.endsWith('/sales-executive'))
 assert.equal(frugalRole(row.requestedUrl,Buffer.from(row.bodyBase64,'base64').toString()).country,null)
})

test('unknown or mixed foreign whole worksite labels do not inherit the verified application city',async()=>{
 const io=replay((url,html)=>url.endsWith('/sales-executive')?html.replaceAll('>Hyderabad<','>Hyderabad / Singapore<'):html)
 const jobs=await runFrugalNative(io.options),job=jobs.find(j=>j.jobId==='sales-executive')
 assert.ok(job);assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true)
})

test('changed closing criteria, changed listing or changed application location never publish unqualified India observations',async()=>{
 for(const mode of ['criteria','listing','application']){
  const io=replay((url,html,index)=>index===1?(mode==='criteria'&&url.endsWith('/sales-executive')?html.replace('Managing organizational sales','Changed native organizational sales'):mode==='listing'&&url.endsWith('/careers')?html.replaceAll('/job-openings/sales-executive','/job-openings/removed-sales-executive'):mode==='application'&&url===APPLICATION?html.replaceAll('Gachibowli, Hyderabad','Unknown City, Singapore'):html):html)
  const jobs=await runFrugalNative(io.options)
  assert.equal(jobs.filter(j=>j.country==='India'&&(mode!=='criteria'||j.jobId==='sales-executive')).length,0,mode)
  assert.ok(jobs.nativeCollectionEvidence.observedNativeRoleRecords.length===3)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 }
})

test('explicit foreign country, employer and closed criteria remain held despite a Hyderabad metadata label',async()=>{
 for(const line of ['Country: Pakistan','Location: Hyderabad, Pakistan','Employer: Another Company','Applications are closed.','Candidates must reside in Pakistan.']){
  const io=replay((url,html)=>url.endsWith('/sales-executive')?html.replace('Managing organizational sales','<p>'+line+'</p>Managing organizational sales'):html)
  const jobs=await runFrugalNative(io.options)
  assert.equal(jobs.filter(j=>j.jobId==='sales-executive'&&j.country==='India').length,0,line)
 }
})

test('a new contradictory JobPosting model cannot be ignored in favor of native form geography',async()=>{
 const io=replay((url,html)=>url.endsWith('/sales-executive')?html.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","title":"Sales Executive","jobLocation":{"address":{"addressCountry":"PK"}}}</script></head>'):html)
 const jobs=await runFrugalNative(io.options)
 assert.equal(jobs.filter(j=>j.jobId==='sales-executive'&&j.country==='India').length,0)
})

test('unavailable or disabled same-role application options do not qualify a Hyderabad country',async()=>{
 const io=replay((url,html)=>url===APPLICATION?html.replace('value="sales-executive"','disabled value="sales-executive"'):html)
 const jobs=await runFrugalNative(io.options)
 assert.equal(jobs.filter(j=>j.jobId==='sales-executive'&&j.country==='India').length,0)
})

test('exact opaque caller cancellation is retained before geography acquisition',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'frugal-geography'});controller.abort(reason)
 await assert.rejects(runFrugalNative({signal:controller.signal,fetchImpl:async()=>assert.fail('No fetch after cancellation')}),error=>error===reason)
})
