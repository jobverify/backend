import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createTataNeuScraper,SOURCE,COMPANY,PROVIDER_METADATA} from './script.js'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const url='https://www.linkedin.com/company/tata-digital/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createTataNeuScraper(options).run()]]){
 test(`Tata Neu ${name} uses injected fetch and rejects a shell`,async()=>{
  let calls=0
  await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>Tata Neu</title><div id="root"></div></html>')}}),{code:'TATANEU_COVERAGE_GAP'})
  assert.equal(calls,1)
 })
}
test('Tata Neu cancels unread responses rejected by HTTP or final URL',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  const body=new ReadableStream({cancel(){cancelled=true}})
  await assert.rejects(run({fetchImpl:async()=>response(body,status,finalUrl)}),{code:'TATANEU_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('Tata Neu caps streamed bytes and cancels the reader',async()=>{
 let cancelled=false
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}})
 await assert.rejects(run({fetchImpl:async()=>response(body)}),{code:'TATANEU_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Tata Neu aggregate deadline includes pending fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])
  await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'TATANEU_COVERAGE_GAP'})
})
test('Tata Neu preserves exact caller abort reason and cancels late response',async()=>{
 const controller=new AbortController(),reason=new Error('caller reason');let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason)
 await assert.rejects(promise,error=>error===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r))
 assert.equal(cancelled,true)
})
test('Tata Neu pre-abort avoids transport and preserves a non-Error reason',async()=>{
 const signal=AbortSignal.abort({reason:'stop'});let fetched=false
 await assert.rejects(run({signal,fetchImpl:async()=>{fetched=true}}),error=>error===signal.reason)
 assert.equal(fetched,false)
})
test('Tata Neu deadline cancels a pending body reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'TATANEU_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})


test('Tata Neu never falls back to an unbounded text response',async()=>{let read=false,cancelled=false;await assert.rejects(run({fetchImpl:async()=>({status:200,url,body:{cancel(){cancelled=true}},text(){read=true;return 'unbounded'}})}),{code:'TATANEU_COVERAGE_GAP'});assert.equal(read,false);assert.equal(cancelled,true)})

const rows=['linkedin-pages','form-api-pages'].flatMap(file=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+file+'.json.gz',import.meta.url)))))
const replay=mutate=>async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,'Unexpected URL '+url);return response(mutate?mutate(row):row.body,row.status,row.finalUrl)}
test('Tata Neu replays native employer responses and preserves unknown brand inventory',async()=>{
 for(const execute of [options=>run(options),options=>createTataNeuScraper(options).run()]){
  const jobs=await execute({fetchImpl:replay()});assert.equal(jobs.length,0)
  const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.firstParty,false)
  assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,4);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 }
})
test('Tata Neu rejects employer, brand association, filter and native structured eligibility drift',async()=>{
 const mutations=[r=>r.body.replaceAll('urn:li:organization:26653083','urn:li:organization:999'),r=>r.body.replaceAll('debut offering, Tata Neu','debut offering, Another Brand'),r=>r.body.replaceAll('checked','unchecked'),r=>r.body.replace('</body>','<article class="job-search-card">Opening</article></body>'),...['<span itemprop="addressCountry">IN</span>','<meta name="dateModified" content="2026-10-23">','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23"}</script>','<article itemscope itemtype="https://schema.org/JobPosting"></article>'].map(markup=>r=>r.body.replace('</body>',markup+'</body>'))]
 for(const mutate of mutations)await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'TATANEU_COVERAGE_GAP'})
})
test('Tata Neu import with unrelated dry-run argument has no transport or persistence effect',async()=>{
 const {spawnSync}=await import('node:child_process');const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected transport')};await import('./scraper/tataneu/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr)
})

test('Tata Neu candidate metadata keeps exact brand scope and unknown inventory',()=>{assert.equal(SOURCE,'tataneu');assert.equal(COMPANY,'Tata Neu');assert.equal(PROVIDER_METADATA.companyName,'Tata Neu');assert.equal(PROVIDER_METADATA.verifiedIndiaJobCount,null);assert.equal(PROVIDER_METADATA.verifiedPublicJobCount,null);assert.equal(PROVIDER_METADATA.exactCompanyMatchOnly,true);assert.equal(PROVIDER_METADATA.lifecycleCleanupAllowed,false);assert.equal(PROVIDER_METADATA.sourceListingComplete,false)})

test('Tata Neu keeps real active parent form as excluded without country, publication or exact brand binding',async()=>{const jobs=await run({fetchImpl:replay()});const candidates=jobs.nativeCollectionEvidence.excludedNativeCandidates;assert.equal(candidates.length,1);assert.equal(candidates[0].title,'Lead Visual Designer');assert.equal(candidates[0].nativeApplicationStatus,'Active');assert.equal(candidates[0].nativeFormCreatedDate,'2026-10-08T05:01:28.317Z');assert.equal(candidates[0].postingDate,null);assert.equal(candidates[0].country,null);assert.equal(candidates[0].brandScopeVerified,false);assert.equal(candidates[0].activeApplyVerified,false);assert.deepEqual(candidates[0].exclusionReasons,['exact-Tata-Neu-role-binding-unproven','missing-explicit-job-country','missing-public-role-publication'])})

test('Tata Neu reviews new form geography/publication/expiry and changed title/access before projection',async()=>{for(const field of [{country:'India'},{datePosted:'2026-10-23'},{validThrough:'2026-11-01'},{title:'Senior Visual Designer | Application'},{status:'Closed'}])await assert.rejects(run({fetchImpl:replay(r=>{if(!r.url.includes('formapi'))return r.body;const data=JSON.parse(r.body);Object.assign(data.form,field);return JSON.stringify(data)})}),{code:'TATANEU_COVERAGE_GAP'})})

test('Tata Neu reviews newly supplied country or publication in form prose',async()=>{for(const change of [data=>data.form.description+=' Located in India. Published 2026-10-23.',data=>data.form.questions[0].subtitle+=' Job location: India.'])await assert.rejects(run({fetchImpl:replay(r=>{if(!r.url.includes('formapi'))return r.body;const data=JSON.parse(r.body);change(data);return JSON.stringify(data)})}),{code:'TATANEU_COVERAGE_GAP'})})

test('Tata Neu verifies every compressed capture and true response body against manifest',()=>{const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)));const hash=value=>createHash('sha256').update(value).digest('hex');for(const file of manifest.files){const bytes=fs.readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(hash(bytes),file.sha256);assert.equal(hash(gunzipSync(bytes)),file.uncompressedSHA256)}for(const row of manifest.responses){const records=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.file,import.meta.url))));const actual=records.find(r=>r.url===row.url);assert.ok(actual);assert.equal(actual.status??null,row.status);assert.equal(actual.finalUrl??null,row.finalUrl);assert.equal(typeof actual.body==='string'?hash(actual.body):null,row.bodySHA256)}})
