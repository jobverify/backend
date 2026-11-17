import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Public network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url)??fixture.responses[1];return Buffer.from(p.bodyBase64,'base64').toString()},fetchPage:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url);return{status:p.status,url:p.url,html:Buffer.from(p.bodyBase64,'base64').toString()}},fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declared URL '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');reads.push(String(url));const count=(counts.get(url)??0)+1;counts.set(url,count);const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response(r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('mcmenonengineeringservices actual current declared full native originals retain inventory and country scope holds',async()=>{const {reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');assert.equal(e.nativeCollectionEvidence.lifecycleCleanupAllowed,false);assert.equal(e.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(e.nativeCollectionEvidence.browserEquivalenceComplete,false);return true});assert.equal(reads.length,fixture.responses.length*2)})
export {fixture,replay}

test('McMenon literal current empty claim/general HR and complete Flight context stay source-owned held observations, never company zero',async()=>{
 const {options}=replay();await assert.rejects(run(options),e=>{const n=e.nativeCollectionEvidence,o=n.nativeOpeningModel;assert.equal(o.publishedNoCurrentVacanciesClaim,true);assert.equal(o.publishedClaimIsCompanyInventoryProof,false);assert.equal(o.currentGeneralHR.attrs.href,'mailto:hradmin@mcmenon.com');assert.match(o.careers.fullNativeHTML,/self\.__next_f/);assert.equal(n.verifiedEmpty,false);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.hrMessageSent,false);return true})
})

test('McMenon future native vacancy/criteria and whole closing Flight context stay retained and unequal without email or zero fallback',async()=>{
 const {reads,options}=replay((p,s,count)=>p.url.endsWith('/careers/')&&count===2?s.replace('There are no current vacancies at the moment.','New native Engineering vacancy: country unknown, full criteria pending.'):s);await assert.rejects(run(options),e=>{const n=e.nativeCollectionEvidence;assert.equal(n.nativeClosingModel.publishedNoCurrentVacanciesClaim,false);assert.match(n.nativeClosingModel.careers.fullNativeHTML,/full criteria pending/);assert.equal(n.closingFullNativeModelMatches,false);assert.equal(n.lifecycleCleanupAllowed,false);return e.failureKind==='source_inventory_unavailable'});assert.equal(reads.length,4)
})

test('McMenon current own active carrier binding rejects inactive, foreign or mixed historical HR',async()=>{
 for(const mode of ['inactive','foreign','old-hr']){const {options}=replay((p,s)=>p.url==='https://www.mcmenon.com/'?mode==='inactive'?s.replaceAll('href="/careers/"','hidden href="/careers/"'):mode==='foreign'?s.replaceAll('href="/careers/"','href="https://foreign.invalid/careers/"'):s:mode==='old-hr'?s.replaceAll('hradmin@mcmenon.com','hr@mcmenon.com'):s);await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})

test('McMenon native access challenge and exact frozen caller stop before email or alternate source',async()=>{
 const denied=replay((p,s)=>({body:s,headers:{...p.headers,'x-amzn-waf-action':'challenge'}}));await assert.rejects(run(denied.options),e=>e.httpStatus===200&&e.failureKind==='blocked_or_access_denied');assert.equal(denied.reads.length,1);const caller=new AbortController(),reason=Object.freeze({owner:'McMenon'});caller.abort(reason);await assert.rejects(run({signal:caller.signal,fetchImpl:async()=>{throw Error('No fetch')}}),e=>e===reason)
})
