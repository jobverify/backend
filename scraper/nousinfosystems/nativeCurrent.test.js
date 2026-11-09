import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,createNousInfosystemsScraper,extractJobsFromAssetText} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=b=>createHash('sha256').update(b).digest('hex'),compressed=fs.readFileSync(new URL('./test-data-20261107/discovery.json.gz',import.meta.url))
assert.equal(sha(compressed),'693380ecbdab407ad81e658fa09b827a1fc646880f6115c706eba5b409c0d6af')
const fixture=JSON.parse(gunzipSync(compressed)),now='2026-11-06T23:40:00.000Z'
assert.equal(fixture.closingResponseReuse,true)
for(const[hash,value]of Object.entries(fixture.entities))assert.equal(sha(Buffer.from(value,'base64')),hash)
for(const p of fixture.packets)assert.equal(Buffer.from(fixture.entities[p.bodySHA256],'base64').length,p.bodyBytes)
const originalFetch=globalThis.fetch
test.before(()=>{globalThis.fetch=()=>{throw Error('Nous offline network tripwire')}})
test.after(()=>{globalThis.fetch=originalFetch})
function replay(mutate=()=>{}){
 const calls=[],counts=new Map()
 const fetchImpl=async(input,init={})=>{
  const url=String(input),p=fixture.packets.find(p=>p.url===url)
  assert.ok(p,'Unrecorded source request or obsolete legacy prerequisite: '+url)
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const headers=new Headers(init.headers);assert.equal(headers.get('user-agent'),'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36')
  assert.equal(headers.has('authorization'),false);assert.equal(headers.has('cookie'),false)
  const count=(counts.get(url)??0)+1;counts.set(url,count);const row={url,count,packet:p,init};calls.push(row)
  const base={bytes:Buffer.from(fixture.entities[p.bodySHA256],'base64'),status:p.status,type:p.contentType,finalURL:p.finalURL},value={...base,...mutate({...base,row})}
  const response=new Response(value.bytes,{status:value.status,headers:{'content-type':value.type}});Object.defineProperty(response,'url',{value:value.finalURL});return response
 }
 return {calls,fetchImpl}
}

test('current reciprocal rebrand and complete native roles retain fourteen country-unknown observations without city inference (controlled closing reuse)',async t=>{
 const io=replay();t.mock.method(globalThis,'fetch',io.fetchImpl)
 const jobs=await run({fetchImpl:io.fetchImpl,now:()=>now})
 assert.equal(jobs.length,0,'No native country is published for these fourteen roles; this is not an India-zero certificate')
 assert.equal(io.calls.length,44);assert.equal(io.calls.some(c=>c.url.includes('nousinfosystems.com')),false)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observations.length,14);assert.equal(audit.heldNativeRows.length,14)
 assert.deepEqual(audit.observations.map(o=>o.nativeOpeningRecord),fixture.rawNativeModels)
 assert.ok(audit.observations.every(o=>o.country===null&&o.postedDate===null&&o.workplaceMode===null&&o.nativeStatus===null&&o.qualificationIssues.includes('native-country-unpublished')))
 for(const o of audit.observations){assert.deepEqual(o.nativeOpeningRecord,o.nativeClosingRecord);assert.deepEqual(o.ownOpeningModel,o.ownClosingModel);assert.equal(o.legalHiringOrganization,null);assert.equal(o.activeApplyVerified,false)}
 assert.equal(readSourceObservationEvidence(jobs,'nousinfosystems').observedVacancyCount,14)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(inventoryCleanupOptions({inventoryEvidence:readInventoryEvidence(jobs)}).replaceExisting,false)
 assert.equal(audit.wholeObservedNativeBoardClosingReconciled,true)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})

const HOME='https://www.artizent.com/',STORY=HOME+'about/our-story',CAREERS=HOME+'insights/careers',OPENINGS=CAREERS+'/openings',DATA=HOME+'assets/jobs-Bj5fZx4-.js',ROLE=OPENINGS+'/java-fullstack-developer-ai'
const textChange=(url,change)=>({row,bytes})=>row.url===url?{bytes:Buffer.from(change(bytes.toString('utf8'),row))}:undefined
function dataChange(change){return textChange(DATA,(text,row)=>{const models=structuredClone(fixture.rawNativeModels);change(models,row);return 'const e='+JSON.stringify(models)+';export{e as JOBS};'})}
async function rejects(mutate,pattern){const io=replay(mutate);await assert.rejects(run({fetchImpl:io.fetchImpl,now:()=>now}),pattern);assert.ok(io.calls.length<=48);assert.equal(io.calls.some(c=>c.url.includes('nousinfosystems.com')),false);return io}
test('exported factory uses the same current bounded partial reader and preserves historical pure-parser city uncertainty',async()=>{const io=replay(),jobs=await createNousInfosystemsScraper({now:()=>now}).run({fetchImpl:io.fetchImpl});assert.equal(jobs.length,0);assert.equal(io.calls.length,44);assert.equal(readSourceObservationEvidence(jobs,'nousinfosystems').observedVacancyCount,14);const packet=fixture.packets.find(p=>p.url===DATA),rows=extractJobsFromAssetText(Buffer.from(fixture.entities[packet.bodySHA256],'base64').toString());assert.equal(rows.length,14);assert.ok(rows.every(r=>r.city===null))})

for(const[label,url,change]of[
 ['missing current former-name affirmation',STORY,s=>s.replaceAll('Previously Nous Infosystems','Different company')],
 ['hidden former-name affirmation',STORY,s=>s.replaceAll('Previously Nous Infosystems','<span hidden>Previously Nous Infosystems</span>')],
 ['missing current continuity affirmation',STORY,s=>s.replaceAll('After more than thirty years as Nous','After more than thirty years as Another Company')],
 ['changed story identity canonical',STORY,s=>s.replace('href="https://www.artizent.com/about/our-story"','href="https://example.org/about/our-story"')],
 ['missing corporate careers handoff',HOME,s=>s.replaceAll('href="/insights/careers"','href="/other-careers"')],
 ['missing current story/careers reciprocity',STORY,s=>s.replaceAll('Join the team','Different destination')],
 ['missing career to own board declaration',CAREERS,s=>s.replaceAll('href="/insights/careers/openings"','href="/different-board"')],
 ['foreign current main module',CAREERS,s=>s.replaceAll('/assets/index-Bln9X1qC.js','https://example.org/assets/index-Bln9X1qC.js')],
 ['unreviewed base authority',HOME,s=>s.replace('<head>','<head><base href="https://example.org/">')],
 ['duplicate native canonical',HOME,s=>s.replace('</head>','<link rel="canonical" href="https://www.artizent.com/"></head>')],
 ['unknown JobPosting country authority',ROLE,s=>s.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting","jobLocation":{"addressCountry":"IN"}}</script></head>')],
 ['missing visible whole-list role',OPENINGS,s=>s.replaceAll('/insights/careers/openings/java-fullstack-developer-ai','/insights/careers/openings/different-slug')],
])test('fails closed on '+label,()=>rejects(textChange(url,change)))

for(const url of [HOME+'assets/index-Bln9X1qC.js',HOME+'assets/JobOpenings-DvlYhWC5.js',HOME+'assets/JobDetail-CRWMO1hX.js'])test('pins the entire declared publisher client '+url.split('/').at(-1),()=>rejects(textChange(url,s=>s+'\n/* unreviewed client drift */')))
for(const[label,change]of[
 ['extra executable statement',s=>s+'globalThis.__NOUS_UNREVIEWED_EXECUTION__=true;'],
 ['second exported inventory',s=>s+'export const other=[];'],
 ['unreviewed import',s=>'import "https://example.org/not-allowed.js";'+s],
 ['changed literal declaration kind',s=>s.replace(/^const /,'let ')],
 ['changed export identity',s=>s.replace('e as JOBS','e as OTHER')],
 ['duplicate native field',s=>s.replace('slug:','country:"US",country:"IN",slug:')],
 ['unreviewed object spread',s=>s.replace('slug:','...{},slug:')],
 ['executable object value',s=>s.replace('location:"Pune"','location:(globalThis.__NOUS_UNREVIEWED_EXECUTION__=true,"Pune")')],
])test('rejects whole literal-program '+label+' without executing publisher code',async()=>{globalThis.__NOUS_UNREVIEWED_EXECUTION__=false;try{await rejects(textChange(DATA,change));assert.equal(globalThis.__NOUS_UNREVIEWED_EXECUTION__,false)}finally{delete globalThis.__NOUS_UNREVIEWED_EXECUTION__}})

for(const[label,change]of[
 ['city-only model gains unreviewed India country',rows=>{rows[0].country='IN'}],
 ['foreign country contradiction',rows=>{rows[0].country='US'}],
 ['nested country name/code/id',rows=>{rows[0].country={name:'India',code:'IN',id:'US'}}],
 ['nested address-country carrier',rows=>{rows[0].location={city:'Pune',addressCountry:'IN'}}],
 ['new legal employer alias',rows=>{rows[0].hiringOrganization={name:'Nous Infosystems'}}],
 ['extra criteria section',rows=>{rows[0].mandatoryRequirements=['Must not disappear']}],
 ['native status carrier',rows=>{rows[0].status='closed'}],
 ['unreviewed publication date',rows=>{rows[0].datePosted='2026-11-06'}],
 ['unreviewed workplace mode',rows=>{rows[0].remoteStatus='On-site'}],
 ['duplicate literal identity',rows=>{rows[1].slug=rows[0].slug}],
 ['unsafe role slug',rows=>{rows[0].slug='../different'}],
 ['blank native title',rows=>{rows[0].title=''}],
 ['Indiana label',rows=>{rows[0].location='Indiana'}],
 ['foreign literal location',rows=>{rows[0].location='Pune, United States'}],
 ['multiple native workplaces',rows=>{rows[0].location=['Pune','Singapore']}],
 ['zero native openings',rows=>{rows[0].openings=0}],
 ['blank mandatory description',rows=>{rows[0].description=[]}],
 ['non-string description criterion',rows=>{rows[0].description=[{required:'Do not coerce this criterion'}]}],
 ['missing required skills',rows=>{rows[0].skills=[]}],
 ['replaced mandatory criterion',rows=>{rows[0].description[0]='Different complete native criterion requiring careful parity validation'}],
 ['over-bound native scope',rows=>{rows.push({...rows[0],slug:'extra-role'})}],
])test('holds no false India output on '+label,()=>rejects(dataChange(change)))

for(const[label,change]of[
 ['full description missing a native criterion',s=>s.replaceAll(fixture.rawNativeModels[0].description[0],'')],
 ['skills missing mandatory AI criterion',s=>s.replace('AI skills (mandatory)','')],
 ['hidden advertised mandatory criterion',s=>s.replace('AI skills (mandatory)','<span hidden>AI skills (mandatory)</span>')],
 ['extra visible mandatory criteria',s=>s.replace('</main>','<p>Additional mandatory qualifications cannot be discarded.</p></main>')],
 ['extra inert mandatory criteria carrier',s=>s.replace('</main>','<template>Additional mandatory qualifications cannot be discarded.</template></main>')],
 ['affirmative own closure notice',s=>s.replace('</main>','<p>This role is closed.</p></main>')],
 ['new own-country attribute',s=>s.replace('<main ','<main data-country="IN" ')],
 ['new own foreign countryCode attribute',s=>s.replace('<main ','<main data-countrycode="US" ')],
 ['new own countryName carrier',s=>s.replace('<main ','<main data-countryname="United States" ')],
 ['new own countryId carrier',s=>s.replace('<main ','<main data-countryid="US" ')],
 ['new own nested address country',s=>s.replace('</main>','<div><span itemprop="addressCountry" content="US"></span></div></main>')],
 ['changed native role canonical ID',s=>s.replace('href="'+ROLE+'"','href="'+OPENINGS+'/wrong-role"')],
 ['disabled public application tab',s=>s.replace('id="job-tab-application"','id="job-tab-application" disabled')],
 ['missing public application entry',s=>s.replace('id="job-tab-application"','id="different-tab"')],
])test('rejects role-owned '+label,()=>rejects(textChange(ROLE,change)))

test('empty optional country attributes remain raw uncertainty without inference',async()=>{const io=replay(textChange(ROLE,s=>s.replace('<main ','<main data-country="" '))),jobs=await run({fetchImpl:io.fetchImpl,now:()=>now});assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,14);assert.ok(jobs.nativeCollectionEvidence.observations[0].ownOpeningHTML.includes('data-country=""'))})
test('footer closure boilerplate is not promoted to role status',async()=>{const io=replay(textChange(ROLE,s=>s.replace('</footer>','<p>This role is closed.</p></footer>'))),jobs=await run({fetchImpl:io.fetchImpl,now:()=>now});assert.equal(jobs.nativeCollectionEvidence.observations.length,14);assert.ok(jobs.nativeCollectionEvidence.observations.every(o=>o.nativeStatus===null))})
test('changed closing native model cannot certify a reconciled partial audit',()=>rejects(dataChange((rows,row)=>{if(row.count>1)rows[0].description.push('A new closing criterion')}),/Opening\/closing/))
test('changed closing full own role cannot certify a reconciled partial audit',()=>rejects(textChange(ROLE,(s,row)=>row.count>1?s.replace('</main>','<p>Closing-only new criterion</p></main>'):s)))
test('changed closing rebrand cannot certify a reconciled partial audit',()=>rejects(textChange(STORY,(s,row)=>row.count>1?s.replaceAll('Previously Nous Infosystems','Previously Another Company'):s)))
test('wrong native MIME remains a contract failure',()=>rejects(({row})=>row.url===DATA?{type:'text/html'}:undefined,/representation/))
test('changed final URL remains an authority failure',()=>rejects(({row})=>row.url===DATA?{finalURL:'https://example.org/jobs.js'}:undefined,/authority/))
test('primary HTTP403 retains exact body evidence without a false empty inventory',async()=>{const io=replay(()=>({status:403}));await assert.rejects(run({fetchImpl:io.fetchImpl}),e=>{assert.equal(e.status,403);assert.equal(e.cause.status,403);assert.equal(e.recruitmentObservations.receipts.length,1);assert.ok(e.recruitmentObservations.receipts[0].bodySHA256);assert.equal(e.recruitmentObservations.sourceScopeComplete,false);assert.equal(e.inventoryEvidence,undefined);return true});assert.equal(io.calls.length,1)})
test('denied response body failure retains primary HTTP403',async()=>{await assert.rejects(run({fetchImpl:async()=>{const response=new Response(new ReadableStream({start(c){c.error(Error('body failed'))}}),{status:403});Object.defineProperty(response,'url',{value:HOME});return response}}),e=>{assert.equal(e.status,403);assert.equal(e.cause.status,403);assert.equal(e.recruitmentObservations.receipts[0].status,403);return true})})
test('prelaunch abort returns exact frozen caller object with zero fetch callbacks',async()=>{const caller=new AbortController(),reason=Object.freeze({caller:'opaque'});let calls=0;const promise=run({signal:caller.signal,fetchImpl:()=>{calls++;throw Error('must not fetch')}});caller.abort(reason);await assert.rejects(promise,e=>e===reason);assert.equal(calls,0)})
test('pending headers abort returns opaque Symbol and cancels late body exactly once',async()=>{const caller=new AbortController(),reason=Symbol('opaque');let resolve,cancel=0,calls=0;const promise=run({signal:caller.signal,fetchImpl:()=>{calls++;return new Promise(r=>{resolve=r})}});await new Promise(setImmediate);caller.abort(reason);await assert.rejects(promise,e=>e===reason);resolve(new Response(new ReadableStream({cancel(){cancel++}})));await new Promise(setImmediate);assert.equal(cancel,1);assert.equal(calls,1)})
test('pending body abort preserves frozen caller reason and disposes once',async()=>{const caller=new AbortController(),reason=Object.freeze({body:'opaque'});let cancel=0;const promise=run({signal:caller.signal,fetchImpl:async()=>{const r=new Response(new ReadableStream({cancel(){cancel++}}),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:HOME});return r}});await new Promise(setImmediate);caller.abort(reason);await assert.rejects(promise,e=>e===reason);assert.equal(cancel,1)})
test('aggregate deadline stops pending headers without later native reads',async()=>{let calls=0;await assert.rejects(run({timeoutMs:5,fetchImpl:()=>{calls++;return new Promise(()=>{})}}),/Nous aggregate request deadline/);assert.equal(calls,1)})
for(const phase of ['headers','body'])test('fifteen-second per-read bound cancels pending '+phase,async()=>{const original=setTimeout;let calls=0,cancel=0;globalThis.setTimeout=(callback,ms,...args)=>original(callback,ms===15000?5:ms,...args);try{await assert.rejects(run({fetchImpl:()=>{calls++;if(phase==='headers')return new Promise(()=>{});const r=new Response(new ReadableStream({cancel(){cancel++}}),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:HOME});return r}}),/Nous native request deadline/);assert.equal(calls,1);if(phase==='body')assert.equal(cancel,1)}finally{globalThis.setTimeout=original}})
test('read caps and aggregate budget increases cannot claim completion',async()=>{await assert.rejects(run({maxJobs:1}),/Read caps/);await assert.rejects(run({timeoutMs:90001}),/bounded clock\/deadline/)})

test('exact fresh default44 original opening and closing bodies reproduce every native business field and partial audit',async t=>{
 const bytes=fs.readFileSync(new URL('./test-data-20261107/default-current.json.gz',import.meta.url))
 assert.equal(sha(bytes),'5d606c82e59d6cb4e9f8ae1c7e7c8dd4f8b5d9c450c86e2b8f56eec9c1643cc2')
 const captured=JSON.parse(gunzipSync(bytes)),expected=captured.expected
 assert.equal(captured.closingResponseReuse,false);assert.equal(captured.freshCapturePrecedesFinalCountryNameIdGuard,true)
 assert.equal(captured.requests.length,44);assert.equal(Object.keys(captured.entities).length,22)
 assert.equal(captured.requests.reduce((n,p)=>n+p.bodyBytes,0),2782168)
 for(const[hash,value]of Object.entries(captured.entities))assert.equal(sha(Buffer.from(value,'base64')),hash)
 let index=0
 const RealDate=globalThis.Date
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[expected.inventory.verifiedAt]))}static now(){return RealDate.parse(expected.inventory.verifiedAt)}}
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const p=captured.requests[index++];assert.ok(p,'No unrecorded request may reach the network')
  assert.equal(String(input),p.url);assert.equal(init.method,p.method);assert.equal(init.credentials,p.credentials);assert.equal(init.redirect,p.redirect);assert.equal(init.body,undefined)
  assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.sourceHeaders)
  assert.deepEqual(Object.fromEntries(new Request(input,init).headers),p.wireRequestHeaders)
  assert.equal(sha(Buffer.alloc(0)),p.wireRequestBodySHA256)
  const body=Buffer.from(captured.entities[p.bodySHA256],'base64');assert.equal(body.length,p.bodyBytes)
  const response=new Response(body,{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.finalURL});return response
 })
 let jobs
 try{jobs=await run()}finally{globalThis.Date=RealDate}
 const omitExecutionClocks=audit=>({...audit,originalResponses:audit.originalResponses.map(({startedAt,completedAt,...receipt})=>receipt)})
 assert.equal(index,44);assert.deepEqual(jobs,expected.jobs);assert.deepEqual(readInventoryEvidence(jobs),expected.inventory)
 assert.deepEqual(readSourceObservationEvidence(jobs,'nousinfosystems'),expected.observations)
 assert.deepEqual(omitExecutionClocks(jobs.nativeCollectionEvidence),omitExecutionClocks(expected.nativeCollectionEvidence))
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,14)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false)
 assert.equal(inventoryCleanupOptions({inventoryEvidence:readInventoryEvidence(jobs)}).replaceExisting,false)
})

// Independent review controls: document authority and scripts remain relevant
// even when their HTML declaration is hidden or outside visible role text.
for(const[label,url,change]of[
 ['hidden document base',HOME,s=>s.replace('<head>','<head><base hidden href="https://foreign.invalid/">')],
 ['hidden additional canonical',HOME,s=>s.replace('<head>','<head><link hidden rel="canonical" href="https://foreign.invalid/">')],
 ['additional classic head program',HOME,s=>s.replace('</head>','<script>addEventListener("DOMContentLoaded",()=>{document.querySelector("main").innerHTML="Changed mandatory criteria"})</script></head>')],
 ['additional inline module program',HOME,s=>s.replace('</head>','<script type="module">addEventListener("DOMContentLoaded",()=>{document.querySelector("main").innerHTML="Changed mandatory criteria"})</script></head>')],
])test('rejects independently reported '+label,()=>rejects(textChange(url,change)))

for(const[label,url,change]of[
 ['hidden role-page base',ROLE,s=>s.replace('<head>','<head><base hidden href="https://foreign.invalid/">')],
 ['hidden mixed-case canonical declaration',HOME,s=>s.replace('</head>','<link hidden rel="CANONICAL" href="https://foreign.invalid/"></head>')],
 ['hidden external classic program',HOME,s=>s.replace('</head>','<script hidden src="https://foreign.invalid/carriers.js"></script></head>')],
 ['template-contained head program',HOME,s=>s.replace('</head>','<template><script>globalThis.__NOUS_UNREVIEWED_EXECUTION__=true</script></template></head>')],
 ['changed whole inline analytics program',HOME,s=>s.replaceAll('GTM-PDZ6DHXZ','GTM-UNREVIEWED')],
 ['unreviewed runtime config source',HOME,s=>s.replaceAll('/runtime-config.js','/different-config.js')],
 ['inline body on declared external config',HOME,s=>s.replace('<script src="/runtime-config.js"></script>','<script src="/runtime-config.js">globalThis.__NOUS_UNREVIEWED_EXECUTION__=true</script>')],
 ['nonempty HTML event handler',HOME,s=>s.replace('<body>','<body onload="document.body.innerHTML=\'changed criteria\'">')],
 ['HTTP equivalent redirect authority',HOME,s=>s.replace('</head>','<meta http-equiv="refresh" content="0;url=https://foreign.invalid/"></head>')],
])test('rejects adjacent retained HTML authority drift: '+label,()=>rejects(textChange(url,change)))

for(const[label,change]of[
 ['hidden ordinary mandatory role text',s=>s.replace('</main>','<div hidden>Additional mandatory qualification: possession of current clearance.</div></main>')],
 ['named country metadata',s=>s.replace('</main>','<meta name="country" content="India"></main>')],
 ['property addressCountry metadata',s=>s.replace('</main>','<meta property="addressCountry" content="IN"></main>')],
])test('rejects independently reported role-owner '+label,()=>rejects(textChange(ROLE,change)))

for(const[label,markup]of[
 ['named hiring organization','<meta name="hiringOrganization" content="Different employer">'],
 ['nested property address payload','<span property="address"><meta name="code" content="IN"></span>'],
 ['nested typed country code','<span itemtype="https://schema.org/Country"><meta name="code" content="IN"></span>'],
 ['itemprop employer foreign authority','<span itemprop="employer"><a href="https://different.invalid/"></a></span>'],
])test('rejects unreviewed semantic role-owner '+label,()=>rejects(textChange(ROLE,s=>s.replace('</main>',markup+'</main>'))))

for(const[label,markup]of[
 ['empty named and property metadata','<meta name="country" content=""><meta property="addressCountry" content=" ">'],
 ['empty typed country and employer nodes','<span itemtype="https://schema.org/Country"></span><span itemprop="hiringOrganization" content=""></span>'],
])test('retains raw '+label+' as unknown without inventing facts',async()=>{
 const io=replay(textChange(ROLE,s=>s.replace('</main>',markup+'</main>'))),jobs=await run({fetchImpl:io.fetchImpl,now:()=>now})
 assert.equal(io.calls.length,44);assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,14)
 const first=jobs.nativeCollectionEvidence.observations[0]
 assert.ok(first.ownOpeningHTML.includes(markup));assert.ok(first.ownClosingHTML.includes(markup))
 assert.equal(first.country,null);assert.equal(first.legalHiringOrganization,null)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})
