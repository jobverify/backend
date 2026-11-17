import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const realNetwork=globalThis.fetch;before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regressions')}});after(()=>{globalThis.fetch=realNetwork})
function replay(edit=(p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.method,p.method??'GET');if(p.requestBody){assert.deepEqual(JSON.parse(init.body),p.requestBody);for(const[k,v]of Object.entries(p.requestHeaders))assert.equal(new Headers(init.headers).get(k),v)}const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response((r.status??p.status)===302?null:r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('polymed actual current native models remain unknown inventory with exact original authority and no fabricated vacancy zero',async()=>{const real=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Real network forbidden in regression')};try{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.ok(n.nativeOpeningModel);assert.ok(n.nativeClosingModel);assert.equal(n.retainedResponses.length,reads.length);return true});assert.equal(reads.length,8)}finally{globalThis.fetch=real}})
export{fixture,replay}
test('Polymed retains full conflicting published form rules and changing unselected schema context without eligibility promotion',async()=>{
 const{options}=replay((p,s,count)=>p.url.endsWith('/feedback/schema')&&count===2?JSON.stringify({...JSON.parse(s),unreviewedMandatoryContext:{newNativeField:'Full native context stays held'}}):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.closingApplicationModelsMatch,false);assert.match(n.nativeOpeningModel.displayedResumeLabel.join(' '),/30MB/);assert.equal(n.nativeOpeningModel.nativeResumeFileRules.find(r=>r.rule==='maxfilesize').threshold,'10485760');assert.equal(n.nativeClosingModel.fullApplicationSchema.unreviewedMandatoryContext.newNativeField,'Full native context stays held');return true})
})
test('Polymed rejects foreign canonical, inactive form, changed whole client and changed native API initialization',async()=>{
 for(const mode of['canonical','inert-form','client','api-config']){const{options}=replay((p,s)=>{
  if(p.url.endsWith('/careers/')&&mode==='canonical')return s.replace('rel="canonical" href="https://www.polymedicure.com/careers/"','rel="canonical" href="https://foreign.invalid/careers/"')
  if(p.url.endsWith('/careers/')&&mode==='inert-form')return s.replace('<form action="/careers/#wpcf7-f68721-o1"','<form hidden action="/careers/#wpcf7-f68721-o1"')
  if(p.url.includes('/includes/js/index.js')&&mode==='client')return s+'\nwindow.unreviewedNativeCriteria=true;'
  if(p.url.endsWith('/careers/')&&mode==='api-config')return s.replace('contact-form-7\\/v1','foreign-form\\/v1');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('Polymed stops observed denial at the first request and preserves exact opaque caller cancellation',async()=>{
 const denied=replay((_p,s)=>({body:s,status:403}));await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,1)
 const reason=Object.freeze({owner:'Polymed source'}),c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No fetch after caller abort')}}),e=>e===reason)
})
