import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async()=>Buffer.from(fixture.responses[0].bodyBase64,'base64').toString(),fetchPage:async url=>({status:fixture.responses[0].status,url,html:Buffer.from(fixture.responses[0].bodyBase64,'base64').toString()}),fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');reads.push(String(url));const count=(counts.get(url)??0)+1;counts.set(url,count);const changed=edit(p,Buffer.from(p.bodyBase64??'','base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response(r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('juzgodigital actual current original models retain typed source observations and fail closed on unknown role eligibility and company scope',async()=>{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n.nativeOpeningModel);assert.ok(n.nativeClosingModel);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.equal(n.retainedResponses.length,reads.length);return true});assert.equal(reads.length,fixture.responses.length*2)})
export{fixture,replay}
test('JuzGoDigital general Gmail CV declaration must stay active and exact without becoming a per-role application',async()=>{
 for(const mode of['foreign-recipient','inactive','foreign-team']){const{options}=replay((p,s)=>{
  if(p.url.endsWith('/team.html')&&mode==='foreign-recipient')return s.replace('to=hr@juzgodigital.com','to=foreign@example.invalid')
  if(p.url.endsWith('/team.html')&&mode==='inactive')return s.replace('href="https://mail.google.com/mail/?view=cm','hidden href="https://mail.google.com/mail/?view=cm')
  if(p.url.endsWith('.com/')&&mode==='foreign-team')return s.replace('href="team.html"','href="https://foreign.invalid/team.html"');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('JuzGoDigital changed full native team/schema context stays retained and unequal with vacancy/company totals unknown',async()=>{
 const{options}=replay((p,s,count)=>p.url.endsWith('/team.html')&&count===2?s.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","identifier":"unreviewed-current-role","addressCountry":"IN","qualifications":{"fullUnknownField":"held"}}</script></body>'):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.closingFullNativeModelMatches,false);assert.ok(n.nativeClosingModel.team.fullJSONModels.some(m=>m.value?.identifier==='unreviewed-current-role'));assert.equal(n.gmailNavigationPerformed,false);assert.equal(n.hrMessageSent,false);assert.equal(n.nativeOpeningModel.generalCVDeclaration.perRoleApplication,false);return true})
})
test('JuzGoDigital actual current denial and caller cancellation stop before Gmail or guessed career routes',async()=>{
 const denied=replay((_p,s)=>({body:s,status:403}));await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,1)
 const c=new AbortController(),reason=Object.freeze({owner:'JuzGo'});c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No request after abort')}}),e=>e===reason)
})
