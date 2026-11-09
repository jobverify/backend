import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'

const names=['official-employer-pages','native-employer-pages','gohire-board-pages','gohire-detail-pages','native-job-api-pages']
const captures=names.flatMap(n=>JSON.parse(gunzipSync(fs.readFileSync(new URL(`fixtures/${n}.json.gz`,import.meta.url))))).filter(r=>r.body)
const replay=(mutate=r=>r)=>async url=>{
 const row=captures.find(r=>r.url===url);assert.ok(row,'Uncaptured '+url)
 const r=mutate({...row});return Object.defineProperty(new Response(r.body,{status:r.status}),'url',{value:r.finalUrl})
}
const fresh=r=>{
 r.body=r.body.replaceAll('13 June, 2026','20 October, 2026').replaceAll('June 13th, 2026','October 20th, 2026').replaceAll('2026-06-13','2026-10-20').replaceAll('2026-09-13','2026-12-20');return r
}
const options={now:()=> '2026-10-23T10:00:00Z'}
test('SuperGaming actual native board/detail/application record preserves expiry despite active form',async()=>{
 const jobs=await run({...options,fetchImpl:replay()})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeCandidates.length,1)
 const candidate=jobs.nativeCollectionEvidence.nativeCandidates[0]
 assert.equal(candidate.id,'291433');assert.equal(candidate.postingDate,'2026-06-13');assert.equal(candidate.closingDate,'2026-09-13')
 assert.equal(candidate.country,'India');assert.equal(candidate.exclusionReason,'native-expired')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('SuperGaming native future-date fixture demonstrates otherwise eligible missing JD retention',async()=>{
 const jobs=await run({...options,fetchImpl:replay(r=>{
  fresh(r)
  if(r.url.includes('widget-job?')){const p=JSON.parse(r.body);p.description=null;r.body=JSON.stringify(p)}
  if(r.url.includes('/roblox-game-developer-')){
   const d=document(r.body),n=d.nodes(n=>d.hasClass(n,'jp-text'))[0]
   r.body=r.body.replace(d.outer(n),'<div class="jp-text"></div>').replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(m,a,b,c)=>{const p=JSON.parse(b);p.description=null;return a+JSON.stringify(p)+c})
  }
  return r
 })})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceDetailStatus,'partial')
 assert.equal(jobs[0].postingDate,'2026-10-20');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(options.now())}).eligibleJobs.length,1)
})
test('SuperGaming elapsed deadline includes final application parsing when timers are starved',async t=>{
 let elapsed=0;const original=JSON.parse
 t.mock.method(performance,'now',()=>elapsed)
 t.mock.method(JSON,'parse',(value,...rest)=>{const result=original(value,...rest);if(typeof value==='string'&&value.includes('"isGeneralPool"'))elapsed=1000;return result})
 await assert.rejects(run({...options,timeoutMs:500,fetchImpl:replay()}),e=>e.code==='SUPERGAMING_COVERAGE_GAP'&&/deadline/.test(e.message))
})
test('SuperGaming rejects native country disagreement and hidden extra JobPosting evidence',async()=>{
 for(const mutate of [r=>{if(r.url.includes('widget-job?')){const p=JSON.parse(r.body);p.country={...p.country,code:'US',name:'United States'};r.body=JSON.stringify(p)}return r},r=>{if(r.url.includes('/roblox-game-developer-'))r.body+='<script hidden type="application/ld+json">{"@graph":[{"@type":"JobPosting","datePosted":"2020-01-01"}]}</script>';return r}])
  await assert.rejects(run({...options,fetchImpl:replay(mutate)}),{code:'SUPERGAMING_COVERAGE_GAP'})
})
test('SuperGaming reads new native requisition IDs without a captured-ID allowlist',async()=>{
 const changed=captures.map(r=>({...r,url:r.url.replaceAll('291433','999999'),finalUrl:r.finalUrl.replaceAll('291433','999999'),body:r.body.replaceAll('291433','999999')}))
 const jobs=await run({...options,fetchImpl:async url=>{const r=changed.find(r=>r.url===url);assert.ok(r,url);return Object.defineProperty(new Response(r.body,{status:r.status}),'url',{value:r.finalUrl})}})
 assert.equal(jobs.nativeCollectionEvidence.nativeCandidates[0].id,'999999')
 assert.equal(jobs.nativeCollectionEvidence.nativeCandidates[0].exclusionReason,'native-expired')
})
test('SuperGaming never refreshes an earlier board publication from newer structured dates',async()=>{
 const jobs=await run({...options,fetchImpl:replay(r=>{
  if(r.url.includes('/roblox-game-developer-'))fresh(r)
  return r
 })})
 assert.equal(jobs.length,1);assert.equal(jobs[0].postingDate,'2026-06-13')
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(options.now())}).eligibleJobs.length,0)
})
test('SuperGaming reviews hidden country carriers and rejects any future public date',async()=>{
 for(const mutate of [r=>{if(r.url.includes('/roblox-game-developer-'))r.body+='<meta hidden name="addressCountry" content="US">';return r},r=>{if(r.url.includes('/roblox-game-developer-'))r.body=r.body.replace('"datePosted": "2026-06-13"','"datePosted": "2027-01-01"');return r}])
  await assert.rejects(run({...options,fetchImpl:replay(mutate)}),{code:'SUPERGAMING_COVERAGE_GAP'})
})
test('SuperGaming reconciles visible job country and reviews new role timeline fields',async()=>{
 for(const mutate of [r=>{if(r.url.includes('/roblox-game-developer-'))r.body=r.body.replaceAll('>Pune, India<','>San Francisco, United States<');return r},r=>{if(r.url.includes('/roblox-game-developer-'))r.body+='<div class="jp-sidebar-item"><p class="jp-sidebar-item-title">Closing Date</p><p class="jp-sidebar-item-data">January 1st, 2020</p></div>';return r}])
  await assert.rejects(run({...options,fetchImpl:replay(mutate)}),{code:'SUPERGAMING_COVERAGE_GAP'})
})
test('SuperGaming marks placeholder descriptions partial without dropping an eligible role',async()=>{
 const jobs=await run({...options,fetchImpl:replay(r=>{
  fresh(r)
  if(r.url.includes('widget-job?')){const p=JSON.parse(r.body);p.description='Job description';r.body=JSON.stringify(p)}
  if(r.url.includes('/roblox-game-developer-')){
   const d=document(r.body),n=d.nodes(n=>d.hasClass(n,'jp-text'))[0]
   r.body=r.body.replace(d.outer(n),'<div class="jp-text">Job description</div>').replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(m,a,b,c)=>{const p=JSON.parse(b);p.description='Job description';return a+JSON.stringify(p)+c})
  }
  return r
 })})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceDetailStatus,'partial')
})
test('SuperGaming retains eligible roles when the description container is absent or hidden',async()=>{
 for(const replacement of ['', '<div hidden class="jp-text">Hidden content</div>']){
  const jobs=await run({...options,fetchImpl:replay(r=>{
   fresh(r)
   if(r.url.includes('widget-job?')){const p=JSON.parse(r.body);p.description=null;r.body=JSON.stringify(p)}
   if(r.url.includes('/roblox-game-developer-')){
    const d=document(r.body),n=d.nodes(n=>d.hasClass(n,'jp-text'))[0]
    r.body=r.body.replace(d.outer(n),replacement).replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(m,a,b,c)=>{const p=JSON.parse(b);p.description=null;return a+JSON.stringify(p)+c})
   }
   return r
  })})
  assert.equal(jobs.length,1);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceDetailStatus,'partial')
  assert.equal(analyzePublishableJobs(jobs,{now:new Date(options.now())}).eligibleJobs.length,1)
 }
})
