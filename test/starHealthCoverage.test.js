import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/starhealth/script.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'

const files=['official-careers','native-employer-jobs']
const receipts=()=>files.flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL('../scraper/starhealth/fixtures/'+f+'.json.gz',import.meta.url)))))
const replay=(mutate=r=>r)=>async url=>{
 const found=receipts().find(r=>r.url===url);assert.ok(found,'Unexpected request '+url)
 const r=mutate({...found}),response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response
}
const clock=new Date('2026-10-23T08:00:00Z')

test('Star Health resolves to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nStar Health\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Star Health', 'starhealth', 'Star Health']],
  )
})

const gap = error => error.code === 'STARHEALTH_COVERAGE_GAP' && error.lifecycleCleanupAllowed === false && error.inventoryEvidence.reportedTotal === null
test('Star Health transport failure leaves inventory unknown', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)
})
test('Star Health aggregate deadline bounds fetch and body', async () => {
  for (const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})]) await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)
})
test('Star Health preserves exact caller abort before fetch and during fetch/body',async()=>{
 for(const stage of ['before','fetch','body']){
  const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason)
  await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return {url,status:200,text:()=>{c.abort(reason);return new Promise(()=>{})}}}}),e=>e===reason)
 }
})
test('Star Health cancels oversized and stalled streamed bodies',async()=>{
 for(const oversized of [true,false]){
  let cancelled=false
  await assert.rejects(run({timeoutMs:10,fetchImpl:async url=>({url,status:200,body:new ReadableStream({pull(c){if(oversized)c.enqueue(new Uint8Array(4000001));else return new Promise(()=>{})},cancel(){cancelled=true}})})}),gap)
  assert.equal(cancelled,true)
 }
})
test('Star Health disposes unread actual Response bodies on rejected HTTP and redirects',async()=>{
 for(const [status,finalUrl] of [[403,null],[429,null],[200,'https://other.example/']]){
  let cancelled=false,calls=0
  await assert.rejects(run({fetchImpl:async url=>{
   if(calls++)throw Error('Stop after rejected corporate response')
   const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status})
   Object.defineProperty(response,'url',{value:finalUrl||url});return response
  }}),gap)
  assert.equal(cancelled,true)
 }
})
test('Star Health disposes a response delivered after exact caller cancellation',async()=>{
 const c=new AbortController(),reason={stage:'late-response'};let cancelled=false,deliver
 const pending=run({signal:c.signal,fetchImpl:()=>new Promise(resolve=>{deliver=resolve})})
 c.abort(reason);await assert.rejects(pending,e=>e===reason)
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}))
 Object.defineProperty(response,'url',{value:'https://www.starhealth.in/careers/'})
 deliver(response);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(cancelled,true)
})
test('Star Health captured native exact employer recovers two independently published India jobs',async()=>{
 const jobs=await run({fetchImpl:replay(),now:clock})
 assert.deepEqual(jobs.map(j=>[j.jobId,j.postingDate,j.country]),[['4479493315','2026-10-22','India'],['4481318868','2026-10-23','India']])
 assert.equal(analyzePublishableJobs(jobs,{now:clock}).eligibleJobs.length,2)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecordCount,2)
 const e=readInventoryEvidence(jobs);assert.equal(e.firstParty,false);assert.equal(e.listingComplete,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null)
 for(const j of jobs){assert.ok(j.jobDescription.length>500);assert.equal(j.activeApplyVerified,true);assert.equal(j.lifecycleCleanupAllowed,false)}
})
test('Star Health employer, final URL, impossible/future dates, application and metadata drift fail closed',async()=>{
 for(const mutate of [
  r=>({...r,finalUrl:'https://other.example/'}),
  r=>r.url.includes('/company/')?{...r,body:r.body.replaceAll('urn:li:organization:521366','urn:li:organization:111111')}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body.replaceAll('datetime="2026-10-22"','datetime="2099-10-22"')}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body.replaceAll('datetime="2026-10-22"','datetime="2026-02-30"')}:r,
  r=>r.url.includes('/view/')?{...r,body:r.body.replaceAll('public_jobs_apply-link-simple_onsite','disabled-apply')}:r,
  r=>r.url.includes('/view/')?{...r,body:r.body+'<meta itemprop="validThrough" content="2026-10-22">'}:r,
  r=>r.url.includes('/view/')?{...r,body:r.body+'<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2025-01-01","validThrough":"2026-10-22"}</script>'}:r,
 ])await assert.rejects(run({fetchImpl:replay(mutate),now:clock}),gap)
})
test('Star Health hidden listing or country without explicit India cannot certify empty inventory',async()=>{
 for(const mutate of [r=>r.url.includes('/search/')?{...r,body:'<template>'+r.body+'</template>'}:r,r=>r.url.includes('/search/')||r.url.includes('/view/')?{...r,body:r.body.replaceAll('Hyderabad, Telangana, India','Hyderabad, Telangana').replaceAll('Kanpur, Uttar Pradesh, India','Kanpur, Uttar Pradesh')}:r])await assert.rejects(run({fetchImpl:replay(mutate),now:clock}),gap)
})
test('Star Health hidden/comment/inert/template/heading-only descriptions remain nullable eligible partial jobs',async()=>{
 for(const replacement of ['<!-- This prose is unavailable and must not be a source description -->','<template><p>This prose is unavailable and must not be a source description.</p></template>','<div hidden>This prose is unavailable and must not be a source description.</div>','<div inert>This prose is unavailable and must not be a source description.</div>','<div style="content-visibility: hidden !important"><p>This prose is unavailable and must not be a source description.</p></div>','<div><h2>This heading is unavailable and must not be a source description.</h2></div>']){
  const jobs=await run({now:clock,fetchImpl:replay(r=>{if(!r.url.includes('/view/'))return r;const d=document(r.body),n=d.nodes(n=>d.hasClass(n,'show-more-less-html__markup'))[0];assert.ok(n);return {...r,body:r.body.slice(0,n.openEnd)+replacement+r.body.slice(n.closeStart)}})})
  assert.equal(jobs.length,2);for(const j of jobs){assert.equal(j.jobDescription,null);assert.equal(j.sourceDetailComplete,false)}assert.equal(analyzePublishableJobs(jobs,{now:clock}).eligibleJobs.length,2)
 }
})
test('Star Health exact gzip captures and body hashes verify',()=>{
 const dir=new URL('../scraper/starhealth/fixtures/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('capture-manifest.json',dir))),hash=x=>createHash('sha256').update(x).digest('hex')
 for(const item of manifest.evidence){const gz=readFileSync(new URL(item.file,dir)),raw=gunzipSync(gz),rows=JSON.parse(raw);assert.equal(hash(gz),item.sha256);assert.equal(hash(raw),item.uncompressedSha256);for(const r of item.responses){const row=rows.find(x=>x.url===r.url);assert.equal(hash(row.body),r.bodySHA256);assert.equal(row.status,r.status);assert.equal(row.finalUrl,r.finalUrl);assert.ok(row.capturedAt)}}
 for(const item of manifest.navigationObservations){const gz=readFileSync(new URL(item.file,dir)),raw=gunzipSync(gz);assert.equal(hash(gz),item.sha256);assert.equal(hash(raw),item.uncompressedSha256);assert.equal(JSON.parse(raw).url,item.finalUrl);assert.equal(new URL(item.finalUrl).hostname,'www.starhealth.in');assert.equal(item.kind,'browser-navigation-observation-not-http-receipt')}
})
