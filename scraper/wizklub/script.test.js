import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createWizKlubScraper} from './script.js'
const url='https://dev.wizklub.com/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createWizKlubScraper(options).run()]])test(`WizKlub ${name} uses injected transport and fails closed on a shell`,async()=>{
 let calls=0
 await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>WizKlub</title><div id="root"></div></html>')}}),{code:'WIZKLUB_COVERAGE_GAP'})
 assert.equal(calls,1)
})
test('WizKlub rejects HTTP and redirects while cancelling unread bodies',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({cancel(){cancelled=true}}),status,finalUrl)}),{code:'WIZKLUB_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('WizKlub bounds streamed bytes and cancels reader',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))}),{code:'WIZKLUB_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('WizKlub aggregate deadline includes fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'WIZKLUB_COVERAGE_GAP'})
})
test('WizKlub exact caller abort and late response cancellation',async()=>{
 const controller=new AbortController(),reason={reason:'caller'};let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason)
 await assert.rejects(promise,e=>e===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true)
})
test('WizKlub exact pre-abort has no transport',async()=>{
 const signal=AbortSignal.abort('caller');let calls=0
 await assert.rejects(run({signal,fetchImpl:async()=>{calls++}}),e=>e===signal.reason);assert.equal(calls,0)
})
test('WizKlub deadline cancels pending reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'WIZKLUB_COVERAGE_GAP'});assert.equal(cancelled,true)
})
test('WizKlub import with unrelated dry-run argument has no fetch or persistence side effect',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected transport')};await import('./scraper/wizklub/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const receiptRows=()=>['official-pages','linkedin-pages','futurz-pages','infinity-pages','parent-employer-pages'].flatMap(name=>{
 const path=new URL(`./fixtures/${name}.json`,import.meta.url),gz=new URL(path.href+'.gz')
 return fs.existsSync(gz)?JSON.parse(gunzipSync(fs.readFileSync(gz))):fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):[]
})
const replay=(mutate,rows=receiptRows())=>async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,`No actual receipt for ${url}`);return response(mutate?mutate(row):row.body,row.status,row.finalUrl)}
test('WizKlub actual receipts extract native brand candidates and preserve unknown company inventory',async()=>{
 const jobs=await run({fetchImpl:replay(),now:new Date('2026-10-23T12:00:00Z')})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.ok(jobs.nativeCollectionEvidence.nativeCandidates.length>=3)
 assert.ok(jobs.nativeCollectionEvidence.nativeCandidates.some(c=>c.id==='4477806380'&&c.activeApplyVerified===false))
 assert.deepEqual(jobs.map(j=>[j.jobId,j.postingDate]),[['4480357313','2026-10-16'],['4478763469','2026-10-13']])
 assert.ok(jobs.every(j=>j.country==='India'&&j.activeApplyVerified&&j.company==='WizKlub'&&j.sourceListingComplete===false))
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-23')}).eligibleJobs.length,2)
})
test('WizKlub factory forwards capture replay and run overrides factory options',async()=>{
 const jobs=await createWizKlubScraper({fetchImpl:()=>{throw Error('factory override unused')}}).run({fetchImpl:replay()})
 assert.equal(jobs.length,2)
})
test('WizKlub allows missing description when native brand identity and all other gates remain proven',async()=>{
 const jobs=await run({fetchImpl:replay(row=>row.url.includes('/jobs/view/')?row.body.replace(/(<div[^>]*class="[^"]*show-more-less-html__markup[^>]*>)[\s\S]*?(<\/div>)/,'$1<h2>About WizKlub</h2>$2'):row.body)})
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(j=>j.jobDescription===null&&j.sourceDescription===null&&j.sourceDetailStatus==='partial'&&j.sourceDetailFailureKind==='missing-content'))
 assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-23')}).eligibleJobs.length,2)
})
test('WizKlub chooses earliest absolute native publication across India and Worldwide',async()=>{
 const jobs=await run({fetchImpl:replay(row=>row.url.includes('f_C=78106236&location=Worldwide')?row.body.replaceAll('2026-10-16','2026-09-16'):row.body)})
 assert.equal(jobs.find(j=>j.jobId==='4480357313').postingDate,'2026-09-16')
})
test('WizKlub excludes active role when explicit job country becomes ambiguous in both listing and detail',async()=>{
 const jobs=await run({fetchImpl:replay(row=>row.body.replaceAll('Ambur, Tamil Nadu, India','Ambur, Tamil Nadu'))})
 assert.equal(jobs.length,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeCandidates.find(c=>c.id==='4480357313').country,null)
})
test('WizKlub cannot emit a closed or disabled application role',async()=>{
 const jobs=await run({fetchImpl:replay(row=>row.url.includes('/jobs/view/')?row.body.replaceAll('public_jobs_apply-link-onsite','unreviewed-apply'):row.body)})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('WizKlub rejects employer, brand, scope, structured date/country/expiry and primary absolute-time drift',async()=>{
 const mutations=[
  row=>row.body.replaceAll('urn:li:organization:78106236','urn:li:organization:24988334'),
  row=>row.url.includes('f_C=78106236')?row.body.replaceAll('checked','unchecked'):row.body,
  row=>row.url.includes('/jobs/view/')?row.body.replaceAll('infinity-learn-by-sri-chaitanya','infinity-learn'):row.body,
  row=>row.url.includes('/jobs/view/')?row.body.replaceAll('About WizKlub','About Another Brand').replaceAll('About Wizklub','About Another Brand'):row.body,
  row=>row.body.replaceAll('support@infinitylearn.com','support@example.com'),
  ...['<span itemprop="addressCountry">IN</span>','<meta name="dateModified" content="2026-10-23">','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23","jobLocation":{"address":{"addressCountry":"IN"}}}</script>','<article itemscope itemtype="https://schema.org/JobPosting"></article>','<span itemprop="validThrough">2026-10-01</span>'].map(markup=>row=>row.body.replace('</body>',markup+'</body>')),
  row=>row.url.includes('/jobs/view/')?row.body.replace(/(class="top-card-layout__entity-info\s[^>]*>)/,'$1<time datetime="2026-10-10">Earlier native publication</time>'):row.body,
 ]
 for(const [index,mutate] of mutations.entries())await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'WIZKLUB_COVERAGE_GAP'},`mutation ${index}`)
})
test('WizKlub ignores unrelated recommended-job dates on detail pages',async()=>{
 const jobs=await run({fetchImpl:replay(row=>row.url.includes('/jobs/view/')?row.body.replaceAll(/datetime="\d{4}-\d{2}-\d{2}"/g,'datetime="2001-01-01"'):row.body)})
 assert.deepEqual(jobs.map(j=>j.postingDate),['2026-10-16','2026-10-13'])
})
test('WizKlub retained capture manifest validates compressed and response body hashes',async()=>{
 const {createHash}=await import('node:crypto'),hash=v=>createHash('sha256').update(v).digest('hex')
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 for(const file of manifest.files){const bytes=fs.readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(hash(bytes),file.sha256);assert.equal(hash(gunzipSync(bytes)),file.uncompressedSHA256)}
 for(const row of manifest.responses){const records=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.file,import.meta.url)))),actual=records.find(r=>r.url===row.url);assert.ok(actual);assert.equal(actual.status??null,row.status);assert.equal(actual.finalUrl??null,row.finalUrl);assert.equal(typeof actual.body==='string'?hash(actual.body):null,row.bodySHA256)}
})
test('WizKlub reviews any new primary role time even when datetime is missing',async()=>{
 await assert.rejects(run({fetchImpl:replay(row=>row.url.includes('/jobs/view/')?row.body.replace(/(class="top-card-layout__entity-info\s[^>]*>)/,'$1<time>October 1, 2026</time>'):row.body)}),{code:'WIZKLUB_COVERAGE_GAP'})
})
