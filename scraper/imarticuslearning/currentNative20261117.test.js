import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async url=>Buffer.from(fixture.parentOriginals.find(p=>p.requestedURL===url)?.bodyBase64??'','base64').toString(),fetchBrowserText:async()=>{throw Error('Real browser forbidden in regression')},fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));const changed=edit(p,Buffer.from(p.bodyBase64??'','base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response([301,302,304].includes(r.status??p.status)?null:r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('imarticuslearning actual current declared source stays explicit unknown inventory instead of stale parser or fabricated company empty',async()=>{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.ok(n.nativeOpeningModel);assert.ok(n.nativeClosingModel);assert.equal(n.retainedResponses.length,reads.length);return true});assert.equal(reads.length,8)})
export{fixture,replay}
test('Imarticus current student redirect chain rejects foreign routes, article identity and inactive authority',async()=>{
 for(const mode of['redirect','canonical','inactive']){const{options}=replay((p,s)=>{
  if(p.url.endsWith('/careers/')&&mode==='redirect')return{body:s,headers:{...p.headers,location:'https://foreign.invalid/jobs/'}}
  if(p.url.includes('/building-careers-of-')&&mode==='canonical')return s.replace('rel="canonical" href="https://imarticus.org/building-careers-of-the-future-with-imarticus-rise/"','rel="canonical" href="https://foreign.invalid/"')
  if(p.url.includes('/building-careers-of-')&&mode==='inactive')return s.replace('>Building Careers Of The Future</',' hidden>Building Careers Of The Future</');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('Imarticus full course/student publication and unreviewed criteria remain retained and unequal instead of becoming employer jobs',async()=>{
 const{options}=replay((p,s,count)=>p.url.includes('/building-careers-of-')&&count===2?s.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","title":"Unreviewed native record","identifier":"unreviewed-id","qualification":{"fullUnknownField":"held"},"addressCountry":"IN"}</script></body>'):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.closingStudentPublicationMatches,false);assert.ok(n.nativeClosingModel.studentPublication.fullJSONModels.some(m=>m.value?.identifier==='unreviewed-id'));assert.equal(n.observedVacancyCount,null);assert.equal(n.studentCourseOrPlacementSignalsNotPromoted,true);assert.equal(n.leadOrStudentApplicationSubmitted,false);return true})
})
test('Imarticus observed native403 remains one request without browser fallback, login or other course crawl',async()=>{
 const denied=replay((_p,s)=>({body:s,status:403}));let browserReads=0;await assert.rejects(run({...denied.options,fetchBrowserText:async()=>{browserReads++;throw Error('Browser fallback forbidden')}}),e=>e.status===403);assert.equal(denied.reads.length,1);assert.equal(browserReads,0)
 const reason=Object.freeze({owner:'Imarticus'}),c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No request after abort')}}),e=>e===reason)
})
