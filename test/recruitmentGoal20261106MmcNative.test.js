import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from '../scraper/mmcinfotechservices/script.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/mmc-native-quality.json.gz',import.meta.url))))
const q=fixture.packet,sha=v=>createHash('sha256').update(v).digest('hex'),date='2026-11-05T19:30:00.000Z'
async function replay(t,{html=q.bodyText,status=200,options={},registered=false}={}){
 const calls=[],audits=[],fetchImpl=async(url,init={})=>{assert.equal(String(url),source.CAREERS_URL,'Unreviewed MMC URL');calls.push({url:String(url),init})
  const r=new Response(html,{status,headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r}
 t.mock.method(globalThis,'fetch',fetchImpl)
 const settings={fetchImpl,now:()=>date,...options,onAudit:async a=>{audits.push(a);await options.onAudit?.(a)}}
 let jobs,error;try{jobs=await(registered?createCatalogScraper(getScraperCatalog().find(p=>p.source==='mmcinfotechservices')).run(settings):source.createMmcInfotechServicesScraper(settings).run())}catch(e){error=e}
 return {calls,audits,jobs,error}
}
test('MMC original fixture retains the current public page without replay or edited bytes',()=>{
 assert.equal(q.status,200);assert.equal(q.replayed,false);assert.equal(Buffer.byteLength(q.bodyText),q.bodyBytes);assert.equal(sha(q.bodyText),q.bodySHA256)
})
test('MMC published fields do not invent work country, posting IDs or requisitions from role labels',()=>{
 const rows=source.extractListingCards(q.bodyText);assert.equal(rows.length,4)
 for(const j of rows){assert.equal(j.country,null);assert.equal(j.location,null);assert.equal(j.city,null);assert.equal(j.jobId,null);assert.equal(j.requisitionId,null)
  assert.equal(j.sourceUrl,source.CAREERS_URL);assert.equal(j.nativeCanonicalRoleURL,null);assert.ok(j.applyUrl.includes('/form.php?job_posting='))}
})
test('MMC mandatory criteria in a later native paragraph survive complete panel extraction',()=>{
 const requirement='An advanced professional certification is mandatory.'
 const html=q.bodyText.replace('</ol>','</ol><p>'+requirement+'</p>'),rows=source.extractListingCards(html)
 assert.ok(rows[0].jobDescription.includes(requirement));assert.ok(rows[0].nativeSourceRecord.panel)
})
test('MMC equal published titles cannot silently collapse separate native panels',()=>{
 const html=q.bodyText.replaceAll('Customer Support','Voice Operations'),rows=source.extractListingCards(html)
 assert.equal(rows.length,4);assert.equal(rows.filter(j=>j.title==='Voice Operations').length,2)
})
test('MMC unreviewed application declarations cannot become another publisher role source',()=>{
 assert.throws(()=>source.extractListingCards(q.bodyText.replace('form.php?job_posting=Voice Operations','https://unreviewed.example/form.php?job_posting=Voice Operations')),/application|publisher|handoff|unreviewed/)
})
test('MMC hidden or delegated eligibility cannot silently disappear from native panels',()=>{
 for(const addition of ['<p hidden>Compulsory professional certification required</p>','<iframe src="https://www.mmcinfotech.com/extra-criteria"></iframe>']){
  assert.throws(()=>source.extractListingCards(q.bodyText.replace('<h3>Job Description</h3>',addition+'<h3>Job Description</h3>')),/hidden|delegated|unreviewed/)
 }
})
test('MMC newly published structured job fields require review before normalized claims',()=>{
 assert.throws(()=>source.extractListingCards(q.bodyText.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"address":{"addressCountry":"France"}}}</script></head>')),/structured|unreviewed/)
})
test('MMC keeps every original panel and original page with explicitly partial unknown-country observations',async t=>{
 const {jobs,error,calls,audits}=await replay(t);assert.ifError(error);assert.equal(jobs.length,4);assert.equal(calls.length,1);assert.equal(audits.length,1)
 for(const j of jobs){assert.equal(j.sourceRawNativeHTML,q.bodyText);assert.equal(j.sourceRawNativeHTMLSHA256,q.bodySHA256);assert.ok(j.nativeSourceRecord.panel)
  assert.equal(j.country,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceScopeComplete,false)
  assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.nativeRoleClosingReconciled,false)}
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('MMC zero cap and exact caller pre-cancellation perform no reads',async t=>{
 const z=await replay(t,{options:{maxJobs:0}});assert.ifError(z.error);assert.equal(z.jobs.length,0);assert.equal(z.calls.length,0)
 const reason=Error('Cancel MMC before reads'),r=await replay(t,{options:{signal:AbortSignal.abort(reason)}});assert.equal(r.error,reason);assert.equal(r.calls.length,0)
})
test('MMC positive cap preserves all observed native panel counts without company-total authority',async t=>{
 const {jobs,error,audits}=await replay(t,{options:{maxJobs:1}});assert.ifError(error);assert.equal(jobs.length,1);assert.equal(audits[0].nativeRecords,4);assert.equal(audits[0].returnedRecords,1)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('MMC registered normalization cannot refill unknown country or synthetic native IDs',async t=>{
 const {jobs,error}=await replay(t,{registered:true});assert.ifError(error);assert.equal(jobs.length,4)
 assert.ok(jobs.every(j=>j.country===null&&j.location===null&&j.jobId===null&&j.requisitionId===null&&j.sourceDetailComplete===false))
})
test('MMC exact anonymous read never visits the declared application forms',async t=>{
 const {error,calls}=await replay(t);assert.ifError(error);assert.equal(calls.length,1)
 const {init}=calls[0];assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.ok(!init.body)
})
for(const status of [202,403,429])test('MMC first HTTP '+status+' stops without retry or empty success',async t=>{
 const {jobs,error,calls}=await replay(t,{status});assert.ok(!jobs);assert.ok(error);assert.equal(calls.length,1);assert.equal(error.status,status)
})
test('MMC factory and run overrides honor the selected transport and observation clock',async t=>{
 let defaults=0,overrides=0;const response=()=>{const r=new Response(q.bodyText,{headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r}
 const scraper=source.createMmcInfotechServicesScraper({fetchImpl:async()=>{defaults++;return response()},now:()=>date})
 const a=await scraper.run();assert.equal(a[0].scrapedAt,date);assert.equal(defaults,1)
 const other='2026-11-05T20:00:00.000Z',b=await scraper.run({fetchImpl:async()=>{overrides++;return response()},now:()=>other})
 assert.equal(b[0].scrapedAt,other);assert.equal(overrides,1);assert.equal(defaults,1)
})
test('MMC body-only transports and unsupported page caps are rejected before reads',async t=>{
 for(const options of [{fetchText:async()=>q.bodyText},{maxPages:1}]){const {error,calls}=await replay(t,{options});assert.ok(error);assert.equal(calls.length,0)}
})
test('MMC pending audit callback honors exact cancellation once',async()=>{
 const c=new AbortController(),reason=Error('Cancel pending MMC audit');let start,release,callbacks=0
 const began=new Promise(resolve=>{start=resolve}),pending=source.createMmcInfotechServicesScraper({maxJobs:0,signal:c.signal,onAudit:()=>{callbacks++;start();return new Promise(resolve=>{release=resolve})}}).run()
 await began;c.abort(reason);const result=await Promise.race([pending.then(jobs=>({jobs}),error=>({error})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),200))])
 release?.();await pending.catch(()=>{});assert.equal(result.error,reason);assert.equal(callbacks,1)
})
for(const target of ['role-label','application-declaration'])test('MMC hidden '+target+' cannot establish a public role observation',()=>{
 const html=target==='role-label'?q.bodyText.replace('<ul class="tabs">','<ul class="tabs" hidden>'):
  q.bodyText.replace('href="form.php?job_posting=Voice Operations"','hidden href="form.php?job_posting=Voice Operations"')
 assert.ok(html!==q.bodyText,'Native control mutation was applied')
 assert.throws(()=>source.extractListingCards(html),/hidden|visible|unreviewed/)
})
