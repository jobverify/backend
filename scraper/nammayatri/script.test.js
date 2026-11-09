import assert from 'node:assert/strict'
import test from 'node:test'
import {createNammaYatriScraper,run} from './script.js'
const response=(url,body,status=200)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:url});return r}
for(const [name,invoke] of [['factory',o=>createNammaYatriScraper(o).run()],['export',run]])test(name+' forwards injected transport and rejects unknown inventory',async()=>{
 let called=0
 await assert.rejects(invoke({fetchImpl:async()=>{called++;throw Error('offline')}}),e=>e.code==='NAMMAYATRI_COVERAGE_GAP'&&e.lifecycleCleanupAllowed===false)
 assert.equal(called,1)
})
test('aggregate deadline bounds pending fetch and stalled streaming body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>response(url,new ReadableStream({start(){}}))])await assert.rejects(run({fetchImpl,timeoutMs:10}),/deadline/i)
})
test('caller abort preserves exact reason',async()=>{const c=new AbortController(),reason=Error('caller');const pending=run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort(reason);await assert.rejects(pending,e=>e===reason)})
test('failed status and changed final URL cancel unread bodies',async()=>{
 for(const changed of [false,true]){let canceled=false;await assert.rejects(run({fetchImpl:async url=>response(changed?url+'other':url,new ReadableStream({cancel(){canceled=true}}),changed?200:403)}));assert.equal(canceled,true)}
})
test('stream byte limit cancels body',async()=>{let canceled=false;await assert.rejects(run({fetchImpl:async url=>response(url,new ReadableStream({pull(c){c.enqueue(new Uint8Array(4000001))},cancel(){canceled=true}}))}),/coverage gap/);assert.equal(canceled,true)})
test('late response after caller abort is canceled unread',async()=>{
 const c=new AbortController(),reason={stage:'late'};let deliver,canceled=false
 const pending=run({signal:c.signal,fetchImpl:()=>new Promise(resolve=>{deliver=resolve})});c.abort(reason);await assert.rejects(pending,e=>e===reason)
 deliver(response('https://www.nammayatri.in/',new ReadableStream({cancel(){canceled=true}})));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(canceled,true)
})
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const receipts=()=>['official-pages','linkedin-pages'].flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+f+'.json.gz',import.meta.url)))))
const replay=(mutate=r=>r)=>async url=>{const r=mutate({...receipts().find(r=>r.url===url)});assert.ok(r.body,'Unexpected request '+url);return response(r.finalUrl,r.body,r.status)}
test('actual native receipts recover five active exact employer India roles with unknown whole scope',async()=>{
 const jobs=await run({fetchImpl:replay(),now:new Date('2026-10-23T12:00:00Z')});assert.equal(jobs.length,5)
 assert.ok(jobs.every(j=>j.country==='India'&&j.company==='Namma Yatri'&&j.activeApplyVerified&&j.lifecycleCleanupAllowed===false))
 assert.equal(jobs.find(j=>j.jobId==='4472886513').postingDate,'2026-10-02')
 const e=readInventoryEvidence(jobs);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.listingComplete,false)
})
test('identity scope hidden markup new schemas country publication expiry and disabled Apply fail closed',async()=>{
 for(const mutate of [
 r=>r.url.includes('/company/')?{...r,body:r.body.replaceAll('urn:li:organization:91666279','urn:li:organization:1')}:r,
 r=>r.url.includes('/search/')?{...r,body:'<div hidden>'+r.body+'</div>'}:r,
 r=>r.url.includes('/jobs/view/')?{...r,body:r.body+'<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23"}</script>'}:r,
 r=>r.url.includes('/jobs/view/')?{...r,body:r.body+'<span itemprop="addressCountry">Canada</span>'}:r,
 r=>r.url.includes('/jobs/view/')?{...r,body:r.body+'<meta name="datePosted" content="2026-10-23">'}:r,
 r=>r.url.includes('/jobs/view/')?{...r,body:r.body+'<meta name="validThrough" content="2026-10-01">'}:r,
 r=>r.url.includes('/jobs/view/')?{...r,body:r.body.replaceAll('<button','<button disabled')}:r,
 ])await assert.rejects(run({fetchImpl:replay(mutate)}),e=>e.code==='NAMMAYATRI_COVERAGE_GAP')
})

import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {spawnSync} from 'node:child_process'
test('missing substantive description retains eligible native role as null partial',async()=>{
 const jobs=await run({fetchImpl:replay(r=>{
  if(!r.url.includes('/jobs/view/'))return r
  const d=document(r.body),markup=d.nodes(n=>d.hasClass(n,'show-more-less-html__markup'))[0]
  return {...r,body:r.body.replace(d.outer(markup),'<div class="show-more-less-html__markup"><h2>Responsibilities</h2></div>')}
 })})
 assert.equal(jobs.length,5);assert.ok(jobs.every(j=>j.jobDescription===null&&j.sourceDetailStatus==='partial'&&j.activeApplyVerified))
})
test('same-role employer social publication cannot refresh earlier public age',async()=>{
 const jobs=await run({fetchImpl:replay(r=>r.url.includes('/company/')?{...r,body:r.body.replaceAll('2026-10-03T11:36:09.013Z','2026-09-01T11:36:09.013Z')}:r)})
 assert.equal(jobs.find(j=>j.jobId==='4472886513').postingDate,'2026-09-01T11:36:09.013Z')
})
test('import with unrelated dry-run argument has no scrape or persistence side effects',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',"globalThis.fetch=()=>{throw Error('import requested network')};await import('./scraper/nammayatri/script.js');console.log('import-safe')",'--','--dry-run'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',timeout:10000})
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'import-safe')
})
test('new employer structured country or expiry cannot be silently ignored',async()=>{
 for(const property of ['addressCountry','validThrough','dateModified'])await assert.rejects(run({fetchImpl:replay(r=>r.url.includes('/company/')?{...r,body:r.body.replace('"@type":"SocialMediaPosting"','"'+property+'":"2026-10-01","@type":"SocialMediaPosting"')}:r)}),e=>e.code==='NAMMAYATRI_COVERAGE_GAP')
})

test('every retained raw capture and navigation observation has reproducible SHA256',()=>{
 const dir=new URL('./fixtures/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('capture-manifest.json',dir))),hash=b=>createHash('sha256').update(b).digest('hex')
 for(const f of [...manifest.evidence,...manifest.navigationObservations]){
  const gz=readFileSync(new URL(f.file,dir)),raw=gunzipSync(gz);assert.equal(hash(gz),f.sha256);assert.equal(hash(raw),f.uncompressedSha256)
  for(const record of f.responses||[]){const receipt=JSON.parse(raw).find(r=>r.url===record.url);assert.equal(hash(receipt.body),record.bodySHA256);assert.equal(receipt.finalUrl,record.finalUrl);assert.equal(receipt.status,record.status);assert.equal(receipt.capturedAt,record.capturedAt)}
 }
})
test('new primary role time cannot silently refresh or hide first publication',async()=>{
 await assert.rejects(run({fetchImpl:replay(r=>r.url.includes('/jobs/view/')?{...r,body:r.body.replace('</h1>','</h1><time datetime="2025-01-01">First published January 1, 2025</time>')}:r)}),e=>e.code==='NAMMAYATRI_COVERAGE_GAP')
})
test('captured primary roles retain literal native identifiers titles and earliest public dates',async()=>{
 const jobs=await run({fetchImpl:replay(),now:new Date('2026-10-23T12:00:00Z')})
 assert.deepEqual(jobs.map(j=>[j.jobId,j.title,j.postingDate]),[
  ['4472886513','Visual Designer','2026-10-02'],
  ['4477569889','Senior Administrative Assistant','2026-10-12'],
  ['4479981010','Product Manager','2026-10-19'],
  ['4477593172','Content Writer - Intern','2026-10-12'],
  ['4477586488','Content Editor & Cameraman - Intern','2026-10-12'],
 ])
})
