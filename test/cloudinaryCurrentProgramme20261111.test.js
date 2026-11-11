import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readCurrentCloudinaryProgramme,runCurrentCloudinaryProgramme} from '../scraper/cloudinary/currentProgramme.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
const bytes=fs.readFileSync(new URL('./fixtures/cloudinary-current-programme-20261111.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/cloudinary-current-programme-20261111.manifest.json',import.meta.url))),sha=x=>createHash('sha256').update(x).digest('hex')
assert.equal(sha(bytes),manifest.fixtureSHA256)
const now=()=>fixture.capturedAtLast,API=fixture.responses[2].requestedURL
const native=(text,change)=>JSON.stringify(change(JSON.parse(text)))
function replay(change=(p)=>p,options={}){
 const calls=[],mutated=[],unexpected=[]
 const readPage=async(url,init)=>{const index=calls.length;calls.push({url,init});const original=fixture.responses[index];if(!original||url!==original.requestedURL){unexpected.push(url);assert.fail('Uncaptured/out-of-order source read '+url)}const body=Buffer.from(original.bodyBase64,'base64');assert.equal(sha(body),original.bodySHA256)
  const page={url:original.finalURL,status:original.status,headers:structuredClone(original.headers),body:Buffer.from(body)},changed=change(page,{index,url,original,text:body.toString('utf8')})
  if(!(changed.body instanceof Uint8Array)||sha(changed.body)!==sha(body)||JSON.stringify(changed.headers)!==JSON.stringify(page.headers)||changed.url!==original.finalURL||changed.status!==original.status)mutated.push(index)
  return changed}
 return{calls,mutated,unexpected,run:()=>readCurrentCloudinaryProgramme({readPage,now,...options})}
}
const modelChange=change=>(p,c)=>c.url===API?{...p,body:Buffer.from(native(c.text,change))}:p
async function held(name,change,pattern,options={}){const r=replay(change,options);await assert.rejects(r.run(),pattern,name);assert.equal(r.unexpected.length,0,'A safe hold cannot come from an uncaptured request');assert(r.mutated.length>0,'Control must actually reach and mutate an acquired packet: '+name);return r}
test('six actual HTTP packets qualify only the complete8-record API-published foreign programme',async()=>{const r=replay(),jobs=await r.run(),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence;assert.equal(jobs.length,0);assert.equal(r.calls.length,6);assert.equal(e.status,'complete-inventory');assert.equal(e.listingComplete,true);assert.equal(e.reportedTotal,8);assert.equal(e.indiaFacetCount,0);assert.equal(e.lifecycleCleanupAllowed,false);assert(sourceLifecycleCleanupForbidden(jobs));assert.equal(a.currentDeclaredSourceProgramComplete,true);assert.equal(a.publisherBrand,'Cloudinary');assert.equal(a.nativePayload.length,8);assert.deepEqual(a.nativePayload,JSON.parse(Buffer.from(fixture.responses[2].bodyBase64,'base64')));assert.equal(a.rawPages.length,6);assert.equal(a.sourceScopeComplete,false);assert.equal(a.companyGlobalScopeQualified,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null);assert.equal(a.nativePerRoleEmployerFieldQualified,false);assert.equal(a.legalEmployerQualified,false);assert.equal(a.ownRoleUIQualified,false);assert.equal(a.schemaQualified,false);assert.equal(a.screeningQualified,false);assert.equal(a.publicationDate,null);assert.equal(a.remoteStatus,null);assert.equal(readSourceObservationEvidence(jobs,'cloudinary').observedVacancyCount,8);for(const row of a.nativePayload)assert(row.createdAt&&row.categories.allLocations.length===1);assert(r.calls.every(c=>c.init.method==='GET'&&c.init.cache==='no-store'&&c.init.credentials==='omit'&&c.init.redirect==='manual'))})
test('a consistent actual-record removal8→7 derives dynamic counts without a native count pin',async()=>{const r=replay(modelChange(rows=>rows.slice(0,-1))),jobs=await r.run();assert.equal(r.mutated.length,2);assert.equal(readInventoryEvidence(jobs).reportedTotal,7);assert.equal(jobs.nativeCollectionEvidence.nativePayload.length,7);assert.equal(readSourceObservationEvidence(jobs,'cloudinary').observedRecordCount,7)})
const countries=[
 ['primary India',rows=>{rows[0].country='IN';rows[0].categories.location='India';rows[0].categories.allLocations=['India'];return rows}],
 ['foreign primary with additional India',rows=>{rows[0].categories.allLocations.push('India');return rows}],
 ['unknown additional location',rows=>{rows[0].categories.allLocations.push('Unqualified additional worksite');return rows}],
 ['unknown typed country',rows=>{rows[0].country='ZZ';return rows}],
 ['contradictory country/location',rows=>{rows[0].categories.location='India';rows[0].categories.allLocations=['India'];return rows}],
 ['authored India applicant condition',rows=>{rows[0].additional+=' Applicants may work from India.';rows[0].additionalPlain+=' Applicants may work from India.';return rows}],
 ['new applicant country model',rows=>{rows[0].applicantLocationRequirements={addressCountry:'IN'};return rows}]
]
for(const[name,change]of countries)test(name+' holds before any zero',async()=>{const r=await held(name,modelChange(change),/country|location|India|field|schema|applicant/i);assert.equal(r.calls.length,3,'Opening native country/model gate must be reached')})
for(const[name,change,pattern]of[
 ['new mandatory criteria field',rows=>{rows[0].qualifications='All applicants must hold certification.';return rows},/field|criteria|schema/i],
 ['duplicate native identity',rows=>[...rows,structuredClone(rows[0])],/duplicate|identity/i],
 ['foreign native account',rows=>{rows[0].hostedUrl=rows[0].hostedUrl.replace('/cloudinary/','/other-employer/');return rows},/account|identity|URL/i],
 ['native role application mismatch',rows=>{rows[0].applyUrl=rows[1].applyUrl;return rows},/identity|application|URL/i],
 ['missing published full criteria',rows=>{for(const k of['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'])rows[0][k]='';rows[0].lists=[];return rows},/criteria|content/i],
 ['error envelope',()=>({error:'unavailable',jobs:[]}),/array|envelope|native/i]
])test(name+' holds the complete programme',()=>held(name,modelChange(change),pattern))
test('conflicting duplicate own JSON country key is rejected before parsing erases it',()=>held('duplicate country key',(p,c)=>c.url===API?{...p,body:Buffer.from(c.text.replace('"country":"US"','"country":"IN","country":"US"'))}:p,/duplicate|JSON/i))
test('closing existing criterion drift withholds the entire zero',()=>held('closing criteria',(p,c)=>c.index===3?{...p,body:Buffer.from(native(c.text,rows=>{rows[0].additional+='Additional required certification.';return rows}))}:p,/closing|changed/i))
test('closing native membership drift withholds the entire zero',()=>held('closing membership',(p,c)=>c.index===3?{...p,body:Buffer.from(native(c.text,rows=>rows.slice(0,-1)))}:p,/closing|changed/i))
for(const[name,change]of[
 ['corporate handoff changed',(s)=>s.replaceAll('href="https://cloudinary.com/careers/jobs"','href="https://other.example/jobs"')],
 ['additional declared programme',(s)=>s.replace('</body>','<a href="https://jobs.lever.co/other-employer">Open jobs</a></body>')],
 ['unreviewed applicant input',(s)=>s.replace('</body>','<input name="country" value="US"></body>')]
])test(name+' is not hidden by a programme-only scope',()=>held(name,(p,c)=>c.index===0?{...p,body:Buffer.from(change(c.text))}:p,/corporate|publisher|profile|declaration|programme|changed/i))
for(const[name,change]of[
 ['client country/account changed',s=>s.replace("const ACCOUNT_NAME = 'cloudinary';","const ACCOUNT_NAME = 'other-employer';")],
 ['client extra criteria projection',s=>s.replace('return jobs.filter(job => job && job.categories && job.text);','return jobs.slice(0, 1);')],
 ['CSS-hidden native list',s=>s.replace('</head>','<style>#job-listings{display:none!important}</style></head>')],
 ['duplicate inert list mount',s=>s.replace('</body>','<template><div id="job-listings"></div></template></body>')],
 ['query default filter',s=>s.replace('<option value="">Location','<option value="India" selected>Location')],
 ['pagination declaration',s=>s.replace('</head>','<link rel="next" href="/careers/jobs?page=2"></head>')]
])test(name+' holds before native delegation',async()=>{const r=await held(name,(p,c)=>c.index===1?{...p,body:Buffer.from(change(c.text))}:p,/client|profile|mount|visible|filter|programme|changed|duplicate/i);assert.equal(r.calls.length,2)})
test('closing corporate declaration drift is withheld',()=>held('closing authority',(p,c)=>c.index===5?{...p,body:Buffer.from(c.text.replace('SEE OPEN ROLES','SEE OTHER ROLES'))}:p,/closing|profile|corporate|changed/i))
test('closing native client drift is withheld',()=>held('closing renderer',(p,c)=>c.index===4?{...p,body:Buffer.from(c.text.replace('return jobs.filter(job => job && job.categories && job.text);','return jobs;'))}:p,/closing|client|profile|changed/i))
for(const[name,change]of[
 ['CF ray binding mismatch',s=>s.replace(/(r:')[a-f0-9]{16}/,"$10000000000000000")],
 ['CF new recruitment target',s=>s.replace('(function(){function c(){',"(function(){document.getElementById('job-listings');function c(){")],
 ['CF native path substitution',s=>s.replace('/cdn-cgi/challenge-platform/scripts/jsd/main.js?ray=','/careers/jobs?ray=')],
 ['CF source attribute',s=>s.replace('<script>(function(){function c(){','<script src="">(function(){function c(){')]
])test(name+' is not eligible for the exact telemetry comparison',()=>held(name,(p,c)=>c.index===4?{...p,body:Buffer.from(change(c.text))}:p,/CF|Cloudflare|profile|carrier|changed/i))
for(const[name,change,pattern]of[
 ['wrong final URL',p=>({...p,url:'https://other.example/jobs'}),/URL|identity|provenance/i],
 ['missing raw body',p=>({...p,body:undefined,html:'<h1>not original bytes</h1>'}),/original|raw|body|bytes/i],
 ['wrong MIME',p=>({...p,headers:{...p.headers,'content-type':'text/plain'}}),/MIME|type/i],
 ['redirect status',p=>({...p,status:302,headers:{...p.headers,location:'/elsewhere'}}),/HTTP|redirect|header/i],
 ['HTTP denial',p=>({...p,status:403}),/HTTP|403|denied/i],
 ['HTTP upstream error',p=>({...p,status:503}),/HTTP|503/i],
 ['refresh security header',p=>({...p,headers:{...p.headers,refresh:'0;url=/login'}}),/security|header|refresh/i],
 ['auth challenge header',p=>({...p,headers:{...p.headers,'www-authenticate':'Basic realm="private"'}}),/security|header|auth/i],
 ['challenge response header',p=>({...p,headers:{...p.headers,'cf-mitigated':'challenge'}}),/security|header|challenge/i]
])test(name+' cannot support a complete programme',async()=>{const r=replay((p,c)=>c.index===0?change(p):p);await assert.rejects(r.run(),pattern);assert.equal(r.unexpected.length,0);assert.equal(r.calls.length,1)})
test('complete request reserve is checked before reads',async()=>{const r=replay(p=>p,{maxRequests:5});await assert.rejects(r.run(),/budget|bound|request/i);assert.equal(r.calls.length,0)})
test('body byte limit uses original bytes',async()=>{const r=replay(p=>p,{maxResponseBytes:100});await assert.rejects(r.run(),/byte|bound|size/i);assert.equal(r.calls.length,1)})
test('aggregate bound is independent of individual response cap',async()=>{const r=replay(p=>p,{maxAggregateBytes:300000});await assert.rejects(r.run(),/aggregate|byte|bound/i);assert.equal(r.calls.length,3)})
test('caller abort is preserved before any resource',async()=>{const reason=new Error('stop Cloudinary');const r=replay(p=>p,{signal:AbortSignal.abort(reason)});await assert.rejects(r.run(),e=>e===reason);assert.equal(r.calls.length,0)})
test('normal runtime uses only exact captured original response bytes and safe public GET options',async()=>{let index=0;const jobs=await runCurrentCloudinaryProgramme({now,requestIntervalMs:0,fetchImpl:async(url,init)=>{const row=fixture.responses[index++];assert.equal(url,row.requestedURL);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(new Headers(init.headers).get('authorization'),null);assert.equal(new Headers(init.headers).get('cookie'),null);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response}});assert.equal(index,6);assert.equal(readInventoryEvidence(jobs).reportedTotal,8)})
test('parsed-only injected JSON cannot make the runtime fetch uncontrolled HTTP',async()=>{let calls=0;await assert.rejects(runCurrentCloudinaryProgramme({fetchJson:async()=>{calls++;return[]}}),/raw|original|transport|injected/i);assert.equal(calls,0)})

for(const[name,change]of[
 ['India in the native published role title',rows=>{rows[0].text+=' – India';return rows}],
 ['HTML entity in authored list country condition',rows=>{rows[0].lists[0].content+='<p>Applicants must be based in Ind&#105;a.</p>';return rows}],
 ['inline HTML split in authored list country condition',rows=>{rows[0].lists[0].content+='<p>Applicants must be based in Ind<span style="display:inline">ia</span>.</p>';return rows}],
 ['HTML entity in authored additional country condition',rows=>{rows[0].additional+='<p>Applicants must be based in Ind&#105;a.</p>';return rows}],
 ['encoded plain authored country condition',rows=>{rows[0].additionalPlain+=' Applicants must be based in Ind&#x69;a.';return rows}],
 ['SVG recruitment declaration in native authored HTML',rows=>{rows[0].additional+='<svg><a href="https://other-employer.example/careers">Additional careers</a></svg>';return rows}],
 ['MathML recruitment declaration in native authored HTML',rows=>{rows[0].additional+='<math><annotation-xml encoding="text/html"><a href="https://other-employer.example/careers">Additional careers</a></annotation-xml></math>';return rows}],
 ['unsupported CSS-authored country content',rows=>{rows[0].additional+='<p style="content: \'Applicants must be based in Ind\' \'ia\';">Additional applicant condition</p>';return rows}]
])test('v2 authored scope guard holds '+name,async()=>{const r=await held(name,modelChange(change),/authored|India|country|criterion|criteria|HTML|carrier|programme/i);assert.equal(r.calls.length,3,'The original native text/carrier control must reach the opening API');assert.equal(r.mutated.length,1)})

for(const[name,index,change]of[
 ['new enforced script ban',1,h=>({...h,'content-security-policy':"script-src 'none'"})],
 ['new enforced script-element ban',1,h=>({...h,'content-security-policy':h['content-security-policy'].replace("script-src-elem 'self' 'unsafe-inline'","script-src-elem 'none'")})],
 ['new enforced sandbox without scripts',1,h=>({...h,'content-security-policy':h['content-security-policy']+'; sandbox allow-same-origin'})],
 ['report-only cannot replace enforced CSP',1,h=>{const copy={...h,'content-security-policy-report-only':h['content-security-policy']};delete copy['content-security-policy'];return copy}],
 ['native cross-origin contradiction',2,h=>({...h,'access-control-allow-origin':'https://other-employer.example'})],
 ['unreviewed HTML COEP policy',1,h=>({...h,'cross-origin-embedder-policy':'require-corp'})],
 ['closing enforced CSP drift',4,h=>({...h,'content-security-policy':"script-src-elem 'none'"})],
 ['closing API CORP contradiction',3,h=>({...h,'cross-origin-resource-policy':'same-origin'})],
 ['closing API nosniff drift',3,h=>{const copy={...h};delete copy['x-content-type-options'];return copy}],
 ['closing report-only header drift',4,h=>({...h,'content-security-policy-report-only':"script-src 'none'"})]
])test(name+' holds unchanged body bytes',async()=>{const r=await held(name,(p,c)=>c.index===index?{...p,headers:change(p.headers)}:p,/security|policy|CSP|CORS|CORP|nosniff|closing/i);assert.equal(r.calls.length,index+1,'The mutated actual header must reach its intended channel')})

for(const[name,index,contentType]of[
 ['corporate nonUTF8 declaration',0,'text/html; charset=windows-1252'],
 ['inline-client page UTF16 declaration',1,'text/html; charset=utf-16le'],
 ['native JSON UTF16 declaration',2,'application/json; charset=utf-16le'],
 ['conflicting duplicate charset declaration',1,'text/html; charset=UTF-8; charset=ISO-8859-1'],
 ['folded ambiguous native content type',2,'application/json; charset=UTF-8, application/json; charset=UTF-8']
])test('v2 transport charset holds '+name,async()=>{const r=await held(name,(p,c)=>c.index===index?{...p,headers:{...p.headers,'content-type':contentType}}:p,/MIME|charset|UTF|encoding|declaration/i);assert.equal(r.calls.length,index+1)})

test('report-only script ban is recorded separately and never treated as an enforced script ban',async()=>{const r=replay((p,c)=>[1,4].includes(c.index)?{...p,headers:{...p.headers,'content-security-policy-report-only':"script-src 'none'"}}:p),jobs=await r.run();assert.equal(r.mutated.length,2);assert.equal(jobs.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,true);assert.equal(jobs.nativeCollectionEvidence.rawPages[1].securityPolicy['content-security-policy-report-only'],"script-src 'none'");assert.equal(jobs.nativeCollectionEvidence.browserCORSExecutionQualified,false);assert.equal(jobs.nativeCollectionEvidence.ownRoleUIQualified,false)})

for(const[name,change]of[
 ['foreign country label contradicts typed country',rows=>{rows[0].categories.location='Israel';rows[0].categories.allLocations=['Israel'];return rows}],
 ['country contradicts the actual native London pair',rows=>{rows[6].country='US';return rows}],
 ['missing additional-location inventory',rows=>{delete rows[0].categories.allLocations;return rows}],
 ['new structured country representation',rows=>{rows[0].country={name:'United States',identifier:'IN'};return rows}]
])test(name+' holds even if a generic API-only scope check might pass',async()=>{const r=await held(name,modelChange(change),/country|location|schema/i);assert.equal(r.calls.length,3)})

test('a denied response retains its bounded original body and exact status as evidence',async()=>{const r=replay((p,c)=>c.index===0?{...p,status:403}:p);await assert.rejects(r.run(),error=>{assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.nativeCollectionEvidence.rawPages[0].bodySHA256,fixture.responses[0].bodySHA256);assert.equal(error.nativeCollectionEvidence.rawPages[0].status,403);assert.equal(error.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false);return true});assert.equal(r.calls.length,1)})

test('caller abort during the first native callback prevents any subsequent read or output',async()=>{const controller=new AbortController(),reason=new Error('stop at own native read');let count=0;await assert.rejects(readCurrentCloudinaryProgramme({now,signal:controller.signal,readPage:async(url)=>{const row=fixture.responses[count++];assert.equal(url,row.requestedURL);if(count===3){controller.abort(reason);return new Promise(()=>{})}return{url:row.finalURL,status:row.status,headers:row.headers,body:Buffer.from(row.bodyBase64,'base64')}}}),error=>error===reason);assert.equal(count,3)})

test('caller abort after closing evidence but before return cannot publish a zero',async()=>{const controller=new AbortController(),reason=new Error('stop after closing audit'),r=replay(p=>p,{signal:controller.signal,onAudit:()=>controller.abort(reason)});await assert.rejects(r.run(),e=>e===reason&&e.nativeCollectionEvidence.currentDeclaredSourceProgramComplete===false);assert.equal(r.calls.length,6)})

test('source deadline bounds even a noncooperating callback without retry',async()=>{let calls=0;await assert.rejects(readCurrentCloudinaryProgramme({now,sourceTimeoutMs:20,readPage:()=>{calls++;return new Promise(()=>{})}}),e=>e.name==='TimeoutError');assert.equal(calls,1)})

test('elapsed source deadline is checked even when synchronous callback work delays the abort timer',async()=>{let calls=0;await assert.rejects(readCurrentCloudinaryProgramme({now,sourceTimeoutMs:20,readPage:async(url)=>{const row=fixture.responses[calls++];assert.equal(url,row.requestedURL);if(calls===1){const until=performance.now()+35;while(performance.now()<until){}}return{url:row.finalURL,status:row.status,headers:row.headers,body:Buffer.from(row.bodyBase64,'base64')}}}),e=>e.name==='TimeoutError');assert.equal(calls,1)})

test('runtime releases every original body reader after a complete actual transaction',async()=>{let index=0;const responses=[];await runCurrentCloudinaryProgramme({now,requestIntervalMs:0,fetchImpl:async(url)=>{const row=fixture.responses[index++];assert.equal(url,row.requestedURL);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});responses.push(response);return response}});assert.equal(index,6);for(const response of responses)assert.equal(response.body.locked,false,'Original response reader must not stay locked after closing')})

test('runtime bounds a stalled body and cancels/releases its original reader once',async()=>{let fetches=0,cancellations=0,response;await assert.rejects(runCurrentCloudinaryProgramme({now,requestIntervalMs:0,requestTimeoutMs:30,fetchImpl:async(url)=>{fetches++;const row=fixture.responses[0];assert.equal(url,row.requestedURL);const body=new ReadableStream({start(c){c.enqueue(Buffer.from(row.bodyBase64,'base64').subarray(0,20))},pull(){return new Promise(()=>{})},cancel(){cancellations++}});response=new Response(body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response}}),e=>e.name==='TimeoutError');await Promise.resolve();assert.equal(fetches,1);assert.equal(cancellations,1);assert.equal(response.body.locked,false)})

test('runtime enforces streamed original byte cap and releases a rejected body',async()=>{let fetches=0,cancellations=0,response;await assert.rejects(runCurrentCloudinaryProgramme({now,requestIntervalMs:0,maxResponseBytes:100,fetchImpl:async(url)=>{fetches++;const row=fixture.responses[0];assert.equal(url,row.requestedURL);let sent=false;response=new Response(new ReadableStream({pull(c){if(!sent){sent=true;c.enqueue(Buffer.from(row.bodyBase64,'base64'))}},cancel(){cancellations++}}),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response}}),/byte|bound/i);await Promise.resolve();assert.equal(fetches,1);assert.equal(cancellations,1);assert.equal(response.body.locked,false)})
