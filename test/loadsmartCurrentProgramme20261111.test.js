import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import vm from 'node:vm'
import {readCurrentLoadsmartProgramme,runCurrentLoadsmartProgramme} from '../scraper/loadsmart/currentProgramme.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/loadsmart-current-programme-20261111.json.gz',import.meta.url))))
const original=JSON.parse(Buffer.from(fixture.responses[3].bodyBase64,'base64'))
const routes=fixture.responses.map(p=>p.requestedURL),order=[0,1,2,3,3,2,1,0],now=()=> '2026-11-11T17:00:00.000Z'
const sha=b=>createHash('sha256').update(b).digest('hex')
// Every closing below reuses an original opening as a CONTROLLED response.
// The immutable fixture expressly contains no fresh closing acquisition.
function replay(change=p=>p,extra={}){
 const calls=[],mutated=[]
 const options={now,...extra,readPage:async(url,init)=>{
  const index=calls.length,row=fixture.responses[order[index]];assert(row,'No unrecorded extra read');assert.equal(url,row.requestedURL)
  calls.push({url,init});const p={url:row.finalURL,status:row.status,headers:structuredClone(row.headers),...(row.headerEntries?{headerEntries:structuredClone(row.headerEntries)}:{}),body:Buffer.from(row.bodyBase64,'base64')}
  const context={index,url,text:p.body.toString('utf8'),kind:row.kind,opening:index<4}
  const result=await change(p,context);if(result!==p)mutated.push(index);return result
 }}
 return{calls,mutated,options,run:()=>readCurrentLoadsmartProgramme(options)}
}
const native=(change)=> (p,c)=>c.kind==='native-api'?{...p,body:Buffer.from(JSON.stringify(change(JSON.parse(c.text))))}:p
const htmlAt=(index,change)=>(p,c)=>c.index===index?{...p,body:Buffer.from(change(c.text))}:p
async function held(change,extra={}){const r=replay(change,extra);await assert.rejects(r.run(),error=>{assert.equal(error.failureKind,'coverage_gap');assert.equal(error.nativeCollectionEvidence?.currentDeclaredSourceProgramComplete,false);return true});assert(r.calls.length<=8);return r}

test('actual four opening channels qualify only a controlled finite foreign-publication replay',async()=>{
 const r=replay(),jobs=await r.run(),a=jobs.nativeCollectionEvidence,i=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0);assert.equal(i.status,'complete-inventory');assert.equal(i.listingComplete,true);assert.equal(i.indiaFacetCount,0);assert.equal(i.reportedTotal,null);assert.equal(i.lifecycleCleanupAllowed,false);assert(sourceLifecycleCleanupForbidden(jobs))
 assert.deepEqual(a.nativePayload,original);assert.equal(a.observedVacancyCount,11);assert.equal(a.nativeProgrammeRequests,8);assert.equal(a.currentDeclaredSourceProgramComplete,true);assert.equal(a.allOpeningReadsBeforeClosing,true);assert.equal(a.archiveNativeCollectionEvidence,true);assert.equal(a.source,'loadsmart')
 assert.equal(a.publisherBrand,'Loadsmart');assert.deepEqual(a.nativeCountries.reduce((x,r)=>(x[r.country]=(x[r.country]??0)+1,x),{}),{US:7,PH:1,BR:3})
 for(const k of['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','legalEmployerQualified','nativePerRoleEmployerFieldQualified','ownVacancyUIQualified','applicationVisited','screeningQualified','browserCORSExecutionQualified','otherHiringChannelsQualified','publisherScriptsExecuted','unacquiredChildrenQualified'])assert.equal(a[k],false,k)
 for(const k of['companyGlobalTotal','companyIndiaTotal','publicationDate','firstEverPostedAt','closingDate'])assert.equal(a[k],null,k)
 assert.equal(a.board.postings.length,11);assert.equal(a.listingScript.sourceSHA256,'369919145cbce28d907a75a8c1da873f3cf62eafbb7fb8c323c18fdd2a8d1f76')
 assert.deepEqual(readSourceObservationEvidence(jobs,'loadsmart'),{source:'loadsmart',recordKind:'vacancy-rows',observedRecordCount:11,observedVacancyCount:11,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.deepEqual(a.rawPages.map(p=>p.bodySHA256),order.map(j=>fixture.responses[j].bodySHA256));assert.equal(a.rawPages[0].headerEntries,null,'Missing original corporate entry view must not be invented')
 assert.equal(a.rawPages[1].requestMetadataCertificate.comparisonOnly,true);assert.deepEqual(JSON.parse(JSON.stringify(a)),a)
 assert.deepEqual(r.calls.map(c=>c.url),order.map(i=>routes[i]));assert(r.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='manual'&&c.init.credentials==='omit'&&c.init.cache==='no-store'))
})

test('dynamic reconciled ten rows are observed rather than pinned to eleven',async()=>{
 const id=original.at(-1).id,remove=html=>{const re=new RegExp('<div class="posting" data-qa-posting-id="'+id+'">[\\s\\S]*?</span></div></a></div>');assert.equal([...html.matchAll(new RegExp(re,'g'))].length,1);return html.replace(re,'')}
 const r=replay((p,c)=>c.kind==='native-api'?{...p,body:Buffer.from(JSON.stringify(JSON.parse(c.text).filter(row=>row.id!==id)))}:c.kind==='board'?{...p,body:Buffer.from(remove(c.text))}:p),jobs=await r.run()
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,10);assert.equal(jobs.nativeCollectionEvidence.board.postings.length,10);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('original complete array and arbitrary flat response order are retained',async()=>{const r=replay(native(rows=>rows.reverse())),jobs=await r.run();assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,original.toReversed())})
test('unreviewed plain-only numeric criterion contradiction holds',()=>held(native(rows=>{assert(rows[0].descriptionBodyPlain.includes('0-1+ years'));rows[0].descriptionBodyPlain=rows[0].descriptionBodyPlain.replace('0-1+ years','10-11+ years');return rows})))
test('company overview without role-specific body or lists cannot qualify a vacancy inventory',()=>held(native(rows=>{const row=rows[0];row.description=row.opening;row.descriptionPlain=row.openingPlain;row.descriptionBody='';row.descriptionBodyPlain='';row.lists=[];return rows})))
test('copying company overview into role-specific body cannot substitute criteria',()=>held(native(rows=>{const row=rows[0];row.descriptionBody=row.opening;row.descriptionBodyPlain=row.openingPlain;row.description=row.opening;row.descriptionPlain=row.openingPlain;row.lists=[];return rows})))

for(const[name,change]of[
 ['primary India',rows=>{rows[0].country='IN';return rows}],['unknown country',rows=>{rows[0].country='ZZ';return rows}],
 ['country object contradiction',rows=>{rows[0].country={name:'US',identifier:'IN'};return rows}],['conflicting observed worksite country',rows=>{rows[0].country='BR';return rows}],
 ['additional India',rows=>{rows[0].categories.allLocations.push('India');return rows}],['extra foreign worksite',rows=>{rows[0].categories.allLocations.push('Other location');return rows}],
 ['missing allLocations',rows=>{delete rows[0].categories.allLocations;return rows}],['India title',rows=>{rows[0].text+=' India';return rows}],
 ['entity India plain',rows=>{rows[0].additionalPlain+=' Work country: Ind&#105;a.';return rows}],['inline split India',rows=>{rows[0].additional+='<p>Applicants must be based in Ind<span>ia</span>.</p>';return rows}],
 ['hidden-X geography',rows=>{rows[0].additional+='<p>I<span style="display:none">X</span>ndia</p>';return rows}],['zero-font geography',rows=>{rows[0].additional+='<p>I<span style="font-size:0">X</span>ndia</p>';return rows}],
 ['India city uncertainty',rows=>{rows[0].additional+='<p>Work location: Bengaluru, Karnataka.</p>';return rows}],['new applicant country criterion',rows=>{rows[0].applicantLocationRequirements={country:'IN'};return rows}],
 ['foreign account',rows=>{rows[0].hostedUrl=rows[0].hostedUrl.replace('/loadsmart/','/other/');return rows}],['wrong apply identity',rows=>{rows[0].applyUrl=rows[1].applyUrl;return rows}],
 ['duplicate role',rows=>[...rows,structuredClone(rows[0])]],['new pagination envelope',rows=>({postings:rows,hasMore:true})],
 ['missing complete criteria',rows=>{for(const k of['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'])rows[0][k]='';rows[0].lists=[];return rows}],
 ['missing criteria field',rows=>{delete rows[0].additionalPlain;return rows}],['new salary condition',rows=>{rows[0].salaryRange.applicantCountry='India';return rows}],
 ['unreviewed SVG criteria',rows=>{rows[0].additional+='<svg><a href="/jobs">India jobs</a></svg>';return rows}],['unreviewed MathML criteria',rows=>{rows[0].additional+='<math><mtext>India</mtext></math>';return rows}],
 ['native empty array without authored empty proof',()=>[]]
])test(name+' withholds rather than promoting API rows',()=>held(native(change)))

for(const[name,change]of[
 ['new corporate careers channel',s=>s.replace('</body>','<a href="https://jobs.lever.co/other/">Other careers</a></body>')],
 ['corporate handoff changed',s=>s.replaceAll('jobs.lever.co/loadsmart/','jobs.lever.co/other/')]
])test(name+' withholds current whole publisher',()=>held(htmlAt(0,change)))

for(const[name,change]of[
 ['hidden posting',s=>s.replace('class="posting" data-qa-posting-id=','class="posting" hidden data-qa-posting-id=')],
 ['inert posting',s=>s.replace('class="posting" data-qa-posting-id=','class="posting" inert data-qa-posting-id=')],
 ['additional unlinked card',s=>s.replace('</body>','<div class="posting">India Engineering</div></body>')],
 ['raw template shadow',s=>s.replace('</body>','<template><div class="posting" data-qa-posting-id="shadow">India</div></template></body>')],
 ['native new intake',s=>s.replace('</body>','<a href="https://jobs.lever.co/loadsmart/intake">Join talent pool</a></body>')],
 ['SVG recruitment declaration',s=>s.replace('</body>','<svg><a href="https://jobs.lever.co/other">India jobs</a></svg></body>')],
 ['unknown filter default',s=>s.replace('Filter by Location: All','Filter by Location: India')],
 ['selected foreign filter',s=>s.replace('class="category-link selected" href="?"','class="category-link selected" href="?location=Chicago"')],
 ['new paging',s=>s.replace('</head>','<link rel="next" href="?page=2"></head>')],
 ['unknown client',s=>s.replace('src="/js/list.js"','src="/js/unknown.js"')],
 ['inactive list client',s=>s.replace('src="/js/list.js"','nomodule src="/js/list.js"')],
 ['whole visible card extra India',s=>s.replace('Forward Deployed Engineer</h5>','Forward Deployed Engineer</h5><span>Remote India</span>')],
 ['card title drift',s=>s.replace('Forward Deployed Engineer</h5>','Other Engineer</h5>')],
 ['stylesheet-hidden board',s=>s.replace('</head>','<style>.postings-wrapper{display:none!important}</style></head>')],
 ['client fetching subset',s=>s.replace('</body>','<script>fetch("/api/other")</script></body>')]
])test(name+' is an unsupported/unreconciled native board',()=>held(htmlAt(1,change)))

test('unknown complete list consumer cannot authorize a programme',()=>held(htmlAt(2,s=>s+'\nfetch("/new-vacancies");')))
for(const[name,fragment]of[
 ['iframe','<iframe src="https://jobs.lever.co/loadsmart/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"></iframe>'],
 ['object','<object data="https://jobs.lever.co/loadsmart/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"></object>'],
 ['HTML script','<script src="/js/unreviewed-vacancies.js"></script>'],
 ['SVG anchor','<svg><a href="https://jobs.lever.co/loadsmart/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">Other India jobs</a></svg>'],
 ['ordinary role anchor','<a href="https://jobs.lever.co/loadsmart/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"></a>'],
 ['inline styled carrier','<span style="display:none">India opening</span>']
])test('nested '+name+' card title content cannot disappear from whole-card reconciliation',()=>held((p,c)=>c.kind==='board'?{...p,body:Buffer.from(c.text.replace(/(<h5\b[^>]*>)([\s\S]*?)(<\/h5>)/,(_m,open,text,close)=>open+text+fragment+close))}:p))
test('nested iframe in a card location label is also unreviewed',()=>held((p,c)=>c.kind==='board'?{...p,body:Buffer.from(c.text.replace('class="sort-by-location posting-category small-category-label location">Chicago','class="sort-by-location posting-category small-category-label location">Chicago<iframe src="/loadsmart/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"></iframe>'))}:p))
test('duplicate JSON keys are rejected before a parser erases country',()=>held((p,c)=>c.kind==='native-api'?{...p,body:Buffer.from(c.text.replace('"country":"US"','"country":"IN","country":"US"'))}:p))
for(const index of[4,5,6,7])test('complete closing entity drift phase '+index+' holds',()=>held(htmlAt(index,s=>s+' ')))

for(const[index,name,headers]of[
 [0,'corporate UTF16',{'content-type':'text/html; charset=utf-16le'}],[1,'board ambiguous charset',{'content-type':'text/html; charset=utf-8; charset=utf-16le'}],
 [2,'script MIME',{'content-type':'text/plain; charset=utf-8'}],[3,'JSON nonUTF8',{'content-type':'application/json; charset=windows-1252'}],
 ...['refresh','location','content-location','content-disposition','www-authenticate','proxy-authenticate','cf-mitigated','cf-chl-out','cf-chl-bypass','x-captcha','x-captcha-required','x-challenge'].map(k=>[1,k,{[k]:'unreviewed'}]),
 ...['content-security-policy','content-security-policy-report-only','permissions-policy','document-policy','cross-origin-embedder-policy','access-control-allow-origin'].map(k=>[1,k,{[k]:'unreviewed'}])
])test(name+' response policy holds unchanged body',()=>held((p,c)=>c.index===index?{...p,headers:{...p.headers,...headers},...(p.headerEntries?{headerEntries:[...p.headerEntries.filter(([k])=>!Object.hasOwn(headers,k)),...Object.entries(headers)]}:{})}:p))

test('missing original final URL cannot be bridged to request',()=>held((p,c)=>c.index===0?{...p,url:undefined}:p))
test('parsed-only body is ineligible',()=>held((p,c)=>c.index===0?{...p,body:undefined,html:c.text}:p))
test('board original header entry view is required by certificate',()=>held((p,c)=>c.index===1?{...p,headerEntries:undefined}:p))
test('only exact original-header-bound three literal board variation is comparison eligible',async()=>{
 const r=replay((p,c)=>{if(c.index!==6)return p
  const oldRay=p.headers['cf-ray'].split('-')[0],newRay='1234567890abcdef',seconds=Math.floor(Date.parse(p.headers.date)/1000),nextSeconds=seconds+10
  const oldTime=Buffer.from(String(seconds)).toString('base64'),newTime=Buffer.from(String(nextSeconds)).toString('base64')
  assert.equal(c.text.split(oldRay).length-1,2);assert.equal(c.text.split(oldTime).length-1,1)
  const headers={...p.headers,'cf-ray':newRay+'-LHR',date:new Date(nextSeconds*1000).toUTCString()}
  return{...p,headers,headerEntries:p.headerEntries.map(([k,v])=>[k,headers[k]??v]),body:Buffer.from(c.text.replaceAll(oldRay,newRay).replace(oldTime,newTime))}
 }),jobs=await r.run(),a=jobs.nativeCollectionEvidence
 assert.notEqual(a.rawPages[1].bodySHA256,a.rawPages[6].bodySHA256);assert.equal(a.board.comparisonFingerprint,a.boardClosing.comparisonFingerprint);assert.equal(a.openingClosingEquality.find(r=>r.URL===routes[1]).wholeRawEntityEqual,false)
})
test('raw entity byte copy does not execute or honor conversion/length hooks',async()=>{let callbacks=0;const r=replay((p,c)=>{if(c.index)return p;const body=new Uint8Array(Buffer.concat([p.body,Buffer.from('<p>New country India</p>')]));Object.defineProperty(body,'valueOf',{value:()=>{callbacks++;return p.body}});Object.defineProperty(body,'length',{get(){callbacks++;return p.body.length}});return{...p,body}});await assert.rejects(r.run(),/corporate|profile/i);assert.equal(callbacks,0)})
test('original typed bytes from another realm remain supported',async()=>{const r=replay(p=>({...p,body:vm.runInNewContext('new Uint8Array(bytes)',{bytes:[...p.body]})}));assert.equal((await r.run()).nativeCollectionEvidence.observedVacancyCount,11)})
test('complete eight-read reserve holds before IO',async()=>{const r=replay(p=>p,{maxRequests:7});await assert.rejects(r.run(),/budget|bound/i);assert.equal(r.calls.length,0)})
test('entity bytes hold bounded original prefix before qualification',()=>held(p=>p,{maxResponseBytes:100}))
test('aggregate byte limit is shared across channels',()=>held(p=>p,{maxAggregateBytes:950000}))
test('preabort does no work',async()=>{const reason=new Error('stop'),r=replay(p=>p,{signal:AbortSignal.abort(reason)});await assert.rejects(r.run(),e=>e===reason);assert.equal(r.calls.length,0)})
test('never-settling raw callback is escaped',async()=>{await assert.rejects(readCurrentLoadsmartProgramme({now,sourceTimeoutMs:20,readPage:()=>new Promise(()=>{})}),e=>e.name==='TimeoutError')})
test('per-request deadline independently escapes an uncooperative reader',async()=>{await assert.rejects(readCurrentLoadsmartProgramme({now,sourceTimeoutMs:1000,requestTimeoutMs:20,readPage:()=>new Promise(()=>{})}),e=>e.name==='TimeoutError'&&/request/i.test(e.message))})
test('CPU-starved timer still holds monotonic source deadline',async()=>{let calls=0;await assert.rejects(readCurrentLoadsmartProgramme({now,sourceTimeoutMs:10,readPage:async()=>{calls++;const until=performance.now()+25;while(performance.now()<until){}return{url:routes[0],status:200,headers:fixture.responses[0].headers,body:Buffer.from(fixture.responses[0].bodyBase64,'base64')}}}),e=>e.name==='TimeoutError');assert.equal(calls,1)})
test('observer never settles but cannot stall source',async()=>{const r=replay(p=>p,{sourceTimeoutMs:500,onAudit:()=>new Promise(()=>{})});await assert.rejects(r.run(),e=>e.name==='TimeoutError');assert.equal(r.calls.length,8)})
test('observer abort after complete closings cannot publish a result',async()=>{const controller=new AbortController(),r=replay(p=>p,{signal:controller.signal,onAudit:()=>controller.abort(new Error('stop release'))});await assert.rejects(r.run(),e=>e.message==='stop release'&&e.nativeCollectionEvidence.currentDeclaredSourceProgramComplete===false)})

test('raw runtime transport preserves full actual entities, request options and releases streams',async()=>{
 let calls=0;const responses=[]
 const jobs=await runCurrentLoadsmartProgramme({now,requestIntervalMs:0,fetchImpl:async(url,init)=>{const row=fixture.responses[order[calls++]];assert(row);assert.equal(url,row.requestedURL);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});responses.push(response);return response}})
 assert.equal(calls,8);assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,original);assert(responses.every(r=>!r.body.locked));assert(jobs.nativeCollectionEvidence.rawPages.every(r=>r.headerEntries.length>0))
})
test('parsed-only injection does not escape into global HTTP',async()=>{let calls=0;await assert.rejects(runCurrentLoadsmartProgramme({fetchJson:async()=>{calls++;return[]}}),/raw|transport|fetchImpl/i);assert.equal(calls,0)})
test('partial raw stream failure retains exact acquired original prefix',async()=>{let canceled=0,response;await assert.rejects(runCurrentLoadsmartProgramme({now,requestIntervalMs:0,fetchImpl:async url=>{let n=0;response=new Response(new ReadableStream({pull(c){if(n++===0)c.enqueue(Buffer.alloc(128,65));else c.error(new Error('actual controlled stream failure'))},cancel(){canceled++}}),{headers:fixture.responses[0].headers});Object.defineProperty(response,'url',{value:url});return response}}),e=>{const p=e.nativeCollectionEvidence.rawPages[0];assert.equal(p.bodyComplete,false);assert.equal(p.bodyBytes,128);assert.equal(p.bodySHA256,sha(Buffer.alloc(128,65)));return true});assert.equal(response.body.locked,false);assert(canceled<=1)})
test('single oversized stream chunk retains only the genuine bounded prefix',async()=>{
 let canceled=0,response
 await assert.rejects(runCurrentLoadsmartProgramme({now,requestIntervalMs:0,fetchImpl:async url=>{response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.alloc(4194305,65))},cancel(){canceled++;return new Promise(()=>{})}}),{headers:fixture.responses[0].headers});Object.defineProperty(response,'url',{value:url});return response}}),e=>{const p=e.nativeCollectionEvidence.rawPages[0];assert.equal(p.bodyComplete,false);assert.equal(p.bodyBytes,4194304);assert.equal(p.discardedOverflowBytes,1);assert.equal(p.consumedBodyBytes,4194305);assert.equal(p.bodySHA256,sha(Buffer.alloc(4194304,65)));return true})
 assert.equal(canceled,1);assert.equal(response.body.locked,false)
})
test('abort escapes an ignoring read and cancellation without leaking a completed body',async()=>{
 let canceled=0,response
 await assert.rejects(runCurrentLoadsmartProgramme({now,sourceTimeoutMs:1000,requestTimeoutMs:20,requestIntervalMs:0,fetchImpl:async url=>{response=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){canceled++;return new Promise(()=>{})}}),{headers:fixture.responses[0].headers});Object.defineProperty(response,'url',{value:url});return response}}),e=>e.name==='TimeoutError')
 assert.equal(canceled,1);assert.equal(response.body.locked,false)
})
