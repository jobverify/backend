import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchPage:async url=>({ok:true,status:200,url,text:Buffer.from(fixture.responses[0].bodyBase64,'base64').toString()}),fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));const changed=edit(p,Buffer.from(p.bodyBase64??'','base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response([301,302,304].includes(r.status??p.status)?null:r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('iball actual current declared source stays explicit unknown inventory instead of stale parser or fabricated company empty',async()=>{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.ok(n.nativeOpeningModel);assert.ok(n.nativeClosingModel);assert.equal(n.retainedResponses.length,reads.length);return true});assert.equal(reads.length,2)})
export{fixture,replay}
test('iBall general mailto is active and exact; hidden or foreign HR hints cannot supply recruitment identity',async()=>{
 for(const mode of['foreign','inactive','canonical']){const{options}=replay((_p,s)=>mode==='foreign'?s.replace('mailto:hr@iball.co.in','mailto:hr@foreign.invalid'):mode==='inactive'?s.replace('href="mailto:hr@iball.co.in"','hidden href="mailto:hr@iball.co.in"'):s.replace('rel="canonical" href="https://iball.co.in/"','rel="canonical" href="https://foreign.invalid/"'));await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('iBall retains differing whole published context and future unreviewed native role/schema fields without inferring country or empty inventory',async()=>{
 const{options}=replay((_p,s,count)=>count===2?s.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","identifier":"future-native-id","jobLocation":{"addressCountry":"IN"},"qualifications":{"unreviewed":"Complete raw field held"}}</script></body>'):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.closingFullNativeModelMatches,false);assert.ok(n.nativeClosingModel.corporate.fullJSONModels.some(m=>m.value?.identifier==='future-native-id'));assert.equal(n.observedVacancyCount,null);assert.equal(n.publicEligibility,null);assert.equal(n.hrMessageSent,false);assert.equal(n.nativeOpeningModel.generalRecruitmentIntake.perRoleApplication,false);return true})
})
test('iBall stops actual denial or exact opaque/null caller cancellation without guessed careers routes',async()=>{
 const denied=replay((_p,s)=>({body:s,status:429}));await assert.rejects(run(denied.options),e=>e.status===429);assert.equal(denied.reads.length,1)
 for(const reason of[Object.freeze({owner:'iBall'}),null]){const c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No request after abort')}}),e=>e===reason)}
})
