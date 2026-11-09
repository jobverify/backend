import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import * as source from './script.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
const BOARD='https://www.emergys.com/careers/',INDIA=BOARD+'infrastructure-engineer/',now=()=> '2026-10-23T17:30:00.000Z'
globalThis.fetch=()=>{throw Error('Public HTTP forbidden in source fixture tests')}
function replay({edit=(html,url,kind)=>html,statusFor=()=>200}={}){
 const reads=[],attempts=[];let boardReads=0
 return{reads,attempts,fetchImpl:async(url,request)=>{
  attempts.push({url,method:request.method,redirect:request.redirect})
  const p=fixture.inputs.find(p=>p.url===url);assert.ok(p,'Unlisted resource:'+url)
  const kind=url===BOARD?(++boardReads===1?'listing':'closing'):'detail',body=Buffer.from(edit(Buffer.from(p.bodyBase64,'base64').toString('utf8'),url,kind))
  reads.push({url,method:request.method,redirect:request.redirect})
  const response=new Response(body,{status:statusFor(url,kind),headers:{'content-type':'text/html; charset=UTF-8','content-length':String(body.length)}})
  Object.defineProperty(response,'url',{value:url});return response
 }}
}
const run=r=>source.run({fetchImpl:r.fetchImpl,now})
function replaceDescription(html){const d=document(html),main=d.nodes(n=>n.tag==='main')[0],block=d.nodes(n=>n.tag==='div'&&d.hasClass(n,'fusion-text'),main).find(n=>d.text(n).length>300);assert.ok(block);return html.slice(0,block.start)+'<div class="fusion-text"></div>'+html.slice(block.end)}
const batch=jobs=>jobs[0].nativeCollectionEvidence
test('Emergys preserves captured role content and clocks while reporting uncaptured advertised pages',async()=>{
 const r=replay(),jobs=await run(r);assert.equal(jobs.length,2);const b=batch(jobs)
 assert.equal(b.observedListingCount,15);assert.equal(b.nativeReportedTotal,null);assert.equal(b.candidateDetails,15);assert.equal(b.jobs.length,2);assert.equal(b.exclusions.length,13);assert.equal(b.failures.length,1)
 assert.equal(b.listingPaginationComplete,false);assert.equal(b.closingInventoryMatches,true);assert.equal(b.sourceScopeComplete,false);assert.equal(b.cleanupAllowed,false)
 assert.deepEqual(b.failures.map(failure=>failure.stage),['native-pagination'])
 assert.deepEqual(b.unknownRawFailures.map(failure=>({stage:failure.stage,url:failure.candidate.url,expectedPage:failure.candidate.expectedPage})),[{stage:'native-pagination',url:BOARD+'page/2/',expectedPage:2}])
 assert.equal(r.attempts.length,18);assert.equal(r.attempts.filter(read=>read.url===BOARD+'page/2/').length,1)
 assert.equal(r.reads.length,17);assert.ok(r.reads.every(r=>r.method==='GET'&&r.redirect==='manual'))
 const job=jobs.find(j=>j.jobId==='infrastructure-engineer');assert.equal(job.company,'Emergys');assert.equal(job.location,'Pune, India');assert.equal(job.country,'India');assert.equal(job.postingDate,'2026-08-28T12:12:01+00:00')
 assert.equal(job.nativeFacts.firstEverPublication,null);assert.equal(job.nativePublication.field,'Article.datePublished');assert.equal(job.nativePublication.isExplicitJobPostingDate,false)
 assert.ok(job.jobDescription.includes('Required Qualifications'));assert.ok(!/Apply for this position|Upload Resume|<form\b/i.test(job.jobDescription))
 assert.equal(job.applyUrl,INDIA);assert.equal(job.nativeApplicationURL,null);assert.equal(job.applicationVisited,false)
 const m=analyzePublishableJobs(jobs,{now:new Date(now())});assert.equal(m.eligibleJobs.length,0);assert.equal(m.filterCounts.old,2)
 assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)),false)
})
test('Emergys preserves country-unknown role gaps separately from the explicitly non-India role',async()=>{
 const jobs=await run(replay()),b=batch(jobs)
 assert.deepEqual(b.nativeDetailCountryCounts,{observedIndiaRows:2,excludedNonIndiaRows:1,unresolvedCountryRows:12,reconciled:false})
 assert.equal(b.exclusions.filter(r=>r.exclusionReason==='native-country-unknown').length,12)
 assert.equal(b.exclusions.filter(r=>r.exclusionReason==='native-explicit-non-India-country').length,1)
})
test('Emergys synthetic fresh native role pages qualify without using edit or observation time',async()=>{
 const r=replay({edit:(html,url)=>url===BOARD?html:html.replaceAll('2026-08-28T12:12:01+00:00','2026-10-22T12:12:01+00:00').replaceAll('2026-08-28T08:34:24+00:00','2026-10-22T08:34:24+00:00')})
 const jobs=await run(r),m=analyzePublishableJobs(jobs,{now:new Date(now())});assert.equal(jobs.length,2);assert.equal(m.eligibleJobs.length,2)
})
test('Emergys a missing complete India description leaves a detail failure and preserves the other job',async()=>{
 const r=replay({edit:(html,url)=>url===INDIA?replaceDescription(html):html}),jobs=await run(r)
 assert.equal(jobs.length,1);assert.equal(batch(jobs).failures.filter(r=>r.stage==='native-detail').length,1);assert.equal(batch(jobs).cleanupAllowed,false)
})
for(const [label,edit] of [
 ['canonical identity',(html)=>html.replace('<link rel="canonical" href="'+INDIA,'<link rel="canonical" href="'+BOARD+'wrong/')],
 ['native title',(html)=>html.replace('>Infrastructure Engineer</h1>','>Wrong Role</h1>')],
 ['native publisher',(html)=>html.replaceAll('"name":"Emergys"','"name":"Unrelated Company"')],
 ['invalid publication',(html)=>html.replaceAll('2026-08-28T12:12:01+00:00','invalid-native-publication')],
 ['future publication',(html)=>html.replaceAll('2026-08-28T12:12:01+00:00','2027-08-28T12:12:01+00:00')],
 ['missing native publication',(html)=>html.replaceAll('"datePublished":"2026-08-28T12:12:01+00:00"','"datePublished":null')]
])test('Emergys rejects changed '+label+' instead of inventing native facts',async()=>{
 const jobs=await run(replay({edit:(html,url)=>url===INDIA?edit(html):html}));assert.equal(jobs.length,1);assert.ok(batch(jobs).failures.some(r=>r.stage==='native-detail'))
})
test('Emergys unreviewed listing pagination fails closed without becoming verified zero',async()=>{
 await assert.rejects(run(replay({edit:(html,url)=>url===BOARD?html.replace('</main>','<a href="?page=2" rel="next">Next</a></main>'):html})),e=>{assert.ok(e.nativeEvidence);assert.equal(e.nativeEvidence.verifiedZeroInventory,false);return true})
})
test('Emergys an empty unverified listing remains an evidence gap',async()=>{
 await assert.rejects(run(replay({edit:(html,url)=>url===BOARD?html.replaceAll(/https:\/\/www\.emergys\.com\/careers\/[a-z0-9-]+\//g,'https://www.emergys.com/news/unqualified/'):html})),e=>{assert.ok(e.nativeEvidence);assert.equal(e.nativeEvidence.verifiedZeroInventory,false);return true})
})
test('Emergys HTTP403 stops further public reads and never requests application endpoints',async()=>{
 const r=replay({statusFor:url=>url===INDIA?403:200})
 await assert.rejects(run(r),e=>{assert.ok(e.nativeEvidence);return true});assert.equal(r.reads.at(-1).url,INDIA);assert.equal(r.reads.length,3)
})
test('Emergys closing inventory changes retain good jobs as partial evidence',async()=>{
 const jobs=await run(replay({edit:(html,url,kind)=>kind==='closing'?html.replaceAll(INDIA,BOARD+'changed-role/'):html}))
 assert.equal(jobs.length,2);assert.equal(batch(jobs).closingInventoryMatches,false);assert.equal(batch(jobs).status,'partial');assert.equal(batch(jobs).cleanupAllowed,false)
})
test('Emergys scripts are parsed as text and never executed',async()=>{
 globalThis.__emergysRemoteExecuted=false
 const jobs=await run(replay({edit:html=>html+'<script>globalThis.__emergysRemoteExecuted=true</script>'}))
 assert.equal(jobs.length,2);assert.equal(globalThis.__emergysRemoteExecuted,false)
})
test('Emergys partial maxJobs options are rejected before public reads',async()=>{
 const r=replay();await assert.rejects(source.run({fetchImpl:r.fetchImpl,now,maxJobs:1}));assert.equal(r.reads.length,0)
})
