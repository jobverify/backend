import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const realNetwork=globalThis.fetch;before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regressions')}});after(()=>{globalThis.fetch=realNetwork})
function replay(edit=(p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.method,p.method??'GET');if(p.requestBody){assert.deepEqual(JSON.parse(init.body),p.requestBody);for(const[k,v]of Object.entries(p.requestHeaders))assert.equal(new Headers(init.headers).get(k),v)}const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response((r.status??p.status)===302?null:r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('torrentgas actual current native models remain unknown inventory with exact original authority and no fabricated vacancy zero',async()=>{const real=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Real network forbidden in regression')};try{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.ok(n.nativeOpeningModel);assert.ok(n.nativeClosingModel);assert.equal(n.retainedResponses.length,reads.length);return true});assert.equal(reads.length,10)}finally{globalThis.fetch=real}})
export{fixture,replay}
test('Torrent Gas retains differing full native account verification context rather than normalizing it into closing equality',async()=>{
 const{options}=replay((p,s,count)=>p.url.endsWith('/User/Account/Login')&&count===2?s.replace('name="__RequestVerificationToken" type="hidden" value="','name="__RequestVerificationToken" type="hidden" value="different-current-native-token-'):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.closingLoginModelMatches,false);assert.equal(n.unmatchedAccountChallengeContextHeld,true);assert.notEqual(n.nativeOpeningModel.login.fullNativeHTML,n.nativeClosingModel.login.fullNativeHTML);assert.equal(n.authenticationAttempted,false);assert.equal(n.captchaRequestedOrSolved,false);return true})
})
test('Torrent Gas follows only active owned login declaration and exact current native programmes',async()=>{
 for(const mode of['foreign-login','inert-login','client','extra-program']){const{options}=replay((p,s)=>{
  if(p.url.endsWith('/User/Home')&&mode==='foreign-login')return s.replace('href="/User/Account/Login"','href="https://foreign.invalid/User/Account/Login"')
  if(p.url.endsWith('/User/Home')&&mode==='inert-login')return s.replace('class="nav-link fw-semibold"','hidden class="nav-link fw-semibold"')
  if(p.url.endsWith('/assets/js/main.js')&&mode==='client')return s+'\nwindow.unreviewedJobListings=true;'
  if(p.url.endsWith('/User/Home')&&mode==='extra-program')return s.replace('</body>','<script hidden>window.unreviewedJobListings=true</script></body>');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('Torrent Gas stops observed denial at the first request and preserves exact frozen caller cancellation',async()=>{
 const denied=replay((_p,s)=>({body:s,status:403}));await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,1)
 const reason=Object.freeze({owner:'Torrent Gas'}),c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No fetch after caller abort')}}),e=>e===reason)
})
