import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s){const reads=[];return{reads,options:{requestIntervalMs:0,fetchPage:async url=>{const p=fixture.responses.find(p=>p.url===url);assert.ok(p,'Only actual public declaration '+url);return{status:p.status,url:p.url,html:Buffer.from(p.bodyBase64,'base64').toString()}},fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.url===String(url));assert.ok(p,'Only actual public declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');reads.push(String(url));return Object.defineProperty(new Response(edit(p,Buffer.from(p.bodyBase64,'base64').toString()),{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
test('Deskera current declared LinkedIn keyword search retains every foreign candidate and never promotes namesakes or certifies zero',async()=>{
 const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.companyIndiaTotal,null);assert.equal(n.observedVacancyCount,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.unqualifiedNativeCandidates.length,60);assert.equal(n.sourceEmployerBindingsProven,false);assert.equal(n.closingVacancyInventoryMatch,false);return true});assert.equal(reads.length,5)
})
test('Deskera inactive or foreign Careers link is not current recruitment authority',async()=>{
 for(const mode of['inert','foreign']){const{options}=replay((p,s)=>p.url.endsWith('/in')?mode==='inert'?s.replaceAll('href="https://www.linkedin.com/jobs/deskera-jobs"','hidden href="https://www.linkedin.com/jobs/deskera-jobs"'):s.replaceAll('https://www.linkedin.com/jobs/deskera-jobs','https://foreign.invalid/jobs'):s)
  await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)
 }
})
test('Deskera namesake keyword candidates remain unqualified and native access denial keeps status without empty success',async()=>{
 const{options}=replay((p,s)=>p.url.includes('linkedin')?s.replaceAll('Zendesk','Deskera'):s);await assert.rejects(run(options),e=>e.failureKind==='source_inventory_unavailable'&&e.nativeCollectionEvidence.unqualifiedNativeCandidates.length===60)
 let reads=0;const base=replay();await assert.rejects(run({...base.options,fetchImpl:async(url,init)=>{reads++;if(String(url).includes('linkedin'))return Object.defineProperty(new Response('Denied',{status:429,headers:{'content-type':'text/html'}}),'url',{value:String(url)});return base.options.fetchImpl(url,init)}}),e=>e.httpStatus===429&&e.failureKind==='blocked_or_access_denied');assert.equal(reads,3)
})
