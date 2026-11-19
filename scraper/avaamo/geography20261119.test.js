import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,explicitAvaamoCountry,AVAAMO_COLLECTION_EVIDENCE} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=change=>{const counts=new Map(),reads=[];return{reads,options:{fetchImpl:async(url,init)=>{
 const count=counts.get(url)??0;counts.set(url,count+1)
 const row=fixture.responses.filter(r=>r.requestedUrl===url)[count];assert.ok(row,'Only genuine source opening/closing reads '+url)
 assert.equal(init.redirect,'manual');reads.push(url)
 const original=Buffer.from(row.bodyBase64,'base64').toString(),body=change?change(url,original,count):original
 return Object.defineProperty(new Response(body,{status:row.status,headers:row.headers}),'url',{value:row.url})
}}}}

test('seven complete Avaamo India roles qualify from exact own worksite labels with all twelve raw observations and closing full criteria retained',async()=>{
 const io=replay(),jobs=await run(io.options),india=jobs.filter(j=>j.country==='India'),evidence=jobs[AVAAMO_COLLECTION_EVIDENCE]
 assert.equal(india.length,7)
 assert.equal(jobs.length,11)
 assert.ok(india.every(j=>j.sourceCountryEvidence.kind==='reviewed-whole-native-workplace-geography'&&j.sourceClosingQualified===true))
 assert.ok(india.every(j=>j.sourceDetailComplete&&j.sourceNativePayload.detail.rawHtml.length>100000&&j.sourceNativeClosingDetail.rawHtml.length>100000))
 assert.ok(india.every(j=>j.postingDate===null&&j.closingDate===null&&j.requisitionId===null&&j.nativeLegalEmployer==='Avaamo, Inc.'))
 assert.equal(evidence.observedVacancyCount,12);assert.equal(evidence.excludedDetailJobs,1)
 assert.equal(evidence.exclusions[0].reason,'missing-role-criteria')
 assert.equal(evidence.companyIndiaTotal,null);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(evidence.openingDetailModels.length,12);assert.equal(evidence.closingDetailModels.length,12)
 assert.equal(io.reads.length,26)
 const assessed=assessSoftFailureAcquisition({source:'avaamo',companyName:'Avaamo'},jobs)
 assert.equal(assessed.indiaJobs,7);assert.equal(assessed.runnerOutcome.success,true);assert.equal(assessed.cleanupOptions.replaceExisting,false)
})

test('Avaamo whole location qualifications preserve foreign and unknown multi-country alternatives',()=>{
 for(const label of ['Bangalore','Bangalore or Pune (remote)','Bangalore or Mumbai'])assert.equal(explicitAvaamoCountry(label),'India')
 for(const label of ['Bangalore / Singapore','Bangalore, United States','Bangalore or London','Worldwide remote','Greater Bangalore'])assert.notEqual(explicitAvaamoCountry(label),'India')
 assert.equal(explicitAvaamoCountry('United States (remote)'),'United States')
})

test('closing own criteria and application handoff drift cannot publish India jobs',async()=>{
 for(const mode of ['criteria','application']){
  const io=replay((url,html,count)=>url.endsWith('/applied-ai-engineer')&&count===1?mode==='criteria'?html.replace('About Avaamo','About Avaamo changed'):html.replaceAll('jayanth.babu@avaamo.ai','different@avaamo.ai'):html)
  await assert.rejects(run(io.options),/closing.*(?:criteria|application|detail)|opening.*closing/i)
 }
})

test('explicit foreign country or employer criteria cannot borrow the exact Bangalore worksite',async()=>{
 for(const line of ['Country: United States','Employer: Another Company','Location: Houston, Texas','Candidates must reside in United States.']){
  const io=replay((url,html)=>url.endsWith('/applied-ai-engineer')?html.replace('About Avaamo','Country and employer review</h3><p>'+line+'</p><h3>About Avaamo'):html)
  await assert.rejects(run(io.options),/country|employer|workplace/i)
 }
})

test('a newly published JobPosting country model cannot be ignored in favor of an earlier city qualification',async()=>{
 const io=replay((url,html)=>url.endsWith('/applied-ai-engineer')?html.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","title":"Applied AI Engineer","jobLocation":{"address":{"addressCountry":"US"}}}</script></head>'):html)
 await assert.rejects(run(io.options),/JobPosting|country|structured/i)
})

test('opaque caller cancellation still wins before any Avaamo native requests',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'avaamo-geography'});controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchImpl:async()=>assert.fail('No fetch after caller cancellation')}),error=>error===reason)
})
