import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchPage:async url=>{const p=fixture.parentOriginals.find(p=>p.requestedURL===url);return{status:p?.status??404,url:p?.url??url,html:Buffer.from(p?.bodyBase64??'','base64').toString()}},fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));const changed=edit(p,Buffer.from(p.bodyBase64??'','base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response([301,302,304].includes(r.status??p.status)?null:r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('falabella actual current declared source stays explicit unknown inventory instead of stale parser or fabricated company empty',async()=>{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.ok(n.nativeOpeningModel);assert.equal(e.status,404);assert.equal(n.nativeClosingModel,null);assert.equal(n.nativeHTTPFailure.status,404);return true});assert.equal(reads.length,3)})
export{fixture,replay}
test('Falabella binds only the current visible corporate handoff and stops at actual missing native source without legacy API fallback',async()=>{
 for(const mode of['foreign-handoff','inert-handoff','foreign-redirect']){const{reads,options}=replay((p,s)=>{
  if(p.url.endsWith('/falabella-cl')&&mode==='foreign-handoff')return s.replace('href="https://muevete.falabella.com/"','href="https://foreign.invalid/jobs"')
  if(p.url.endsWith('/falabella-cl')&&mode==='inert-handoff')return s.replace('href="https://muevete.falabella.com/"','hidden href="https://muevete.falabella.com/"')
  if(p.status===301&&mode==='foreign-redirect')return{body:s,headers:{...p.headers,location:'https://foreign.invalid/'}};return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode);assert.ok(reads.length<=2)}
})
test('Falabella future unreviewed current native HTML is retained as held inventory and never parsed through an unlinked historical API',async()=>{
 const{reads,options}=replay((p,s)=>p.status===404?{status:200,headers:{'content-type':'text/html'},body:'<html><body><h1>Unreviewed native openings</h1><script type="application/ld+json">{"@type":"JobPosting","country":"IN","title":"Unreviewed role"}</script></body></html>'}:s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');assert.match(e.nativeCollectionEvidence.nativeOpeningModel.unreviewedNativeResponse.fullNativeHTML,/Unreviewed role/);assert.equal(e.nativeCollectionEvidence.observedVacancyCount,null);return true});assert.equal(reads.length,3)
})
test('Falabella observed403 and caller abort never trigger corporate/legacy alternate reads',async()=>{
 const denied=replay((_p,s)=>({body:s,status:403}));await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,1)
 const c=new AbortController(),reason=Object.freeze({owner:'Falabella'});c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No request after abort')}}),e=>e===reason)
})
