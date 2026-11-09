import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from '../scraper/myclassboard/script.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'
import {parseCorporate,verifyDetail,mapNative} from '../scraper/myclassboard/native.js'

const names=['current-corporate-pages','keka-shell','keka-native-board','native-job-details','native-applications-and-client']
const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('../scraper/myclassboard/fixtures/'+name+'.json.gz',import.meta.url))))
const receipts=()=>names.flatMap(load)
const replay=(mutate=r=>r)=>async url=>{
 const found=receipts().find(r=>r.url===url);assert.ok(found,'Unexpected request '+url)
 const r=mutate({...found});return {url:r.finalUrl,status:r.status,body:new Response(r.body).body}
}

const gap = error => error.code === 'MYCLASSBOARD_COVERAGE_GAP' && error.lifecycleCleanupAllowed === false && error.inventoryEvidence.reportedTotal === null
test('MyClassboard transport errors never silently certify an empty employer', async () => {
 await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)
})
test('MyClassboard deadline bounds fetch and body stalls',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})]) await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)
})
test('MyClassboard preserves exact caller cancellation before and during requests',async()=>{
 for(const stage of ['before','fetch','body']) {
  const c=new AbortController(), reason={stage}
  if(stage==='before')c.abort(reason)
  await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{
   if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}
   return {url,status:200,text:()=>{c.abort(reason);return new Promise(()=>{})}}
  }}),error=>error===reason)
 }
})
test('MyClassboard exact official employer native capture replay recovers18 India roles with original dates',async()=>{
 const jobs=await run({fetchImpl:replay()})
 assert.equal(jobs.length,18);assert.equal(jobs.nativeCollectionEvidence.nativeRecordCount,21)
 assert.equal(jobs.nativeCollectionEvidence.corporateCardCount,16)
 assert.deepEqual(jobs.nativeCollectionEvidence.exclusions.map(r=>r.id),['142099','141291','141278'])
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(jobs.find(j=>j.jobId==='135633').postingDate,'2026-07-23T11:22:15.4Z')
 for(const job of jobs){assert.equal(job.country,'India');assert.ok(job.jobDescription.length>60);assert.equal(job.applyUrl,'https://mcb.keka.com/careers/applyjob/'+job.jobId)}
 const qualified=analyzePublishableJobs(jobs,{now:new Date('2026-10-23T07:30:00Z')})
 assert.equal(qualified.filterCounts.old,14)
 assert.deepEqual(qualified.eligibleJobs.map(j=>j.jobId),['143683','143062','59685','50237'])
})
test('MyClassboard application form, active button and public date drift fail closed',async()=>{
 for(const mutate of [r=>r.url.endsWith('/applyjob/143683')?{...r,body:r.body.replace('id="jobApplicationForm"','id="removed-form"')}:r,r=>r.url.endsWith('/jobdetails/143683')?{...r,body:r.body.replace('id="apply-job"','id="closed-job"')}:r,r=>r.url.includes('/active/')?{...r,body:r.body.replace('2026-10-06T10:40:21.003Z','not-a-date')}:r])await assert.rejects(run({fetchImpl:replay(mutate)}),gap)
})
test('MyClassboard hidden corporate inventory and identity drift fail closed',async()=>{
 for(const mutate of [r=>r.url.endsWith('careerportalinfo')?{...r,body:r.body.replaceAll('MyClassboard Educational Solutions Pvt Ltd','Other employer')}:r,r=>r.url==='https://www.mcbapp.com/careers/'?{...r,body:'<template>'+r.body+'</template>'}:r,r=>({...r,status:403}),r=>({...r,finalUrl:'https://other.example/'})])await assert.rejects(run({fetchImpl:replay(mutate)}),gap)
})
test('MyClassboard inherited content-visibility hiding removes actual corporate role inventory',async()=>{
 await assert.rejects(run({fetchImpl:replay(r=>r.url==='https://www.mcbapp.com/careers/'?{...r,body:'<div style="content-visibility: hidden !important"><div>'+r.body+'</div></div>'}:r)}),gap)
})
test('MyClassboard hidden/inert/comment-only/heading-only JD becomes null after all other role gates',()=>{
 const data=receipts(),row=JSON.parse(data.find(r=>r.url.includes('/active/')).body)[0]
 const original=data.find(r=>r.url.endsWith('/jobdetails/'+row.id)).body
 for(const body of ['<div hidden>Responsibilities: build systems and own delivery with the team.</div>','<template><p>Responsibilities: build systems and own delivery with the team.</p></template>','<!-- Responsibilities: build systems and own delivery with the team. -->','<h2>Responsibilities build systems and own delivery with the team</h2>','<div style="content-visibility: hidden"><div><p>Responsibilities build systems and own delivery with the engineering team every day.</p></div></div>','<div><h2>Responsibilities build systems and own delivery with the engineering team every day.</h2></div>','<div><div><strong>Responsibilities build systems and own delivery with the engineering team every day.</strong></div></div>']){
  const html=original.replace(/(<div class="job-description-container [^"]*">)[\s\S]*?(<\/div>\s*<\/div>\s*<div class="col-lg-4)/,'$1'+body+'$2')
  const jd=verifyDetail(html,row);assert.equal(jd,null);const job=mapNative(row,jd);assert.equal(job.jobDescription,null)
  assert.equal(job.jobId,String(row.id));assert.equal(job.country,'India');assert.equal(job.postingDate,row.publishedOn)
  assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceDetailStatus,'partial');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(analyzePublishableJobs([job],{now:new Date('2026-10-23T07:30:00Z')}).eligibleJobs.length,1)
 }
})
test('MyClassboard rejects future and impossible native dates, expiry shape drift and contradictory country',()=>{
 const row=JSON.parse(receipts().find(r=>r.url.includes('/active/')).body)[0]
 for(const changed of [
  {...row,publishedOn:'2099-10-06T10:40:21.003Z'},
  {...row,publishedOn:'2026-02-30T10:40:21.003Z'},
  {...row,validThrough:'2026-10-22T00:00:00Z'},
  {...row,closingDate:'2026-10-22'},
  {...row,jobLocations:[{...row.jobLocations[0],state:'Singapore'}]},
  {...row,jobLocations:[{...row.jobLocations[0],countryCode:'US'}]},
 ])assert.throws(()=>mapNative(changed,'Verified source description',{now:new Date('2026-10-23T07:30:00Z')}))
})
test('MyClassboard rejects introduced detail structured posting or expiry metadata for renewed verification',()=>{
 const data=receipts(),row=JSON.parse(data.find(r=>r.url.includes('/active/')).body)[0]
 const html=data.find(r=>r.url.endsWith('/jobdetails/'+row.id)).body
 for(const metadata of ['<script type="application/ld+json">{"@type":"JobPosting","validThrough":"2026-10-22","jobLocation":{"address":{"addressCountry":"Singapore"}}}</script>','<meta itemprop="validThrough" content="2026-10-22">'])assert.throws(()=>verifyDetail(html+metadata,row))
})
test('MyClassboard streamed body limits cancel oversized or stalled streams',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async url=>({url,status:200,body:new ReadableStream({pull(c){c.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}})})}),gap)
 assert.equal(cancelled,true)
 cancelled=false
 await assert.rejects(run({timeoutMs:10,fetchImpl:async url=>({url,status:200,body:new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}})})}),gap)
 assert.equal(cancelled,true)
 const controller=new AbortController(),reason={source:'caller-stream'}
 cancelled=false
 await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>({url,status:200,body:new ReadableStream({pull(){controller.abort(reason);return new Promise(()=>{})},cancel(){cancelled=true}})})}),error=>error===reason)
 assert.equal(cancelled,true)
})
test('MyClassboard exact raw capture and response body hashes verify',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../scraper/myclassboard/fixtures/capture-manifest.json',import.meta.url)))
 const hash=x=>createHash('sha256').update(x).digest('hex')
 for(const item of manifest.evidence){const gz=readFileSync(new URL('../scraper/myclassboard/fixtures/'+item.file,import.meta.url)),raw=gunzipSync(gz);assert.equal(hash(gz),item.sha256);assert.equal(hash(raw),item.uncompressedSha256);const rows=[JSON.parse(raw)].flat();for(const r of item.responses){const receipt=rows.find(x=>x.url===r.url);assert.equal(hash(receipt.body),r.bodySHA256);assert.ok(receipt.capturedAt)}}
})
