import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async()=>Buffer.from(fixture.responses[0].bodyBase64,'base64').toString(),fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.url===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');reads.push(String(url));const count=(counts.get(url)??0)+1;counts.set(url,count);return Object.defineProperty(new Response(edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
test('Cuemath current application/public screening config is retained as unknown vacancy inventory instead of fake empty',async()=>{
 const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.companyIndiaTotal,null);assert.equal(n.observedVacancyCount,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.nativeOpeningModel.applicationConfig.openRegions[0][0],'NAM');assert.equal(n.closingFullCurrentIntakeMatch,true);assert.equal(n.applicationSubmitted,false);return true});assert.equal(reads.length,6)
})
test('Cuemath full unselected config, current client and active declaration graph reject material drift',async()=>{
 for(const mode of['closing-config','client','hidden-program']){const{options}=replay((p,s,count)=>{
  if(p.url.endsWith('/apply')&&mode==='closing-config'&&count===2)return s.replace('Science — Mathematics','Different native mandatory study field')
  if(p.url.endsWith('/coach-signup/app.js')&&mode==='client')return s+'\nwindow.unreviewedEligibility=true;'
  if(p.url.endsWith('/apply')&&mode==='hidden-program')return s.replace('</body>','<script hidden>window.unreviewedEligibility=true</script></body>');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('Cuemath actual six-response pair retains changing307 response context as held evidence while its exact native application models agree',async()=>{
 const pair=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-redirect-pair-20261117.json.gz',import.meta.url))));let index=0
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async(url,init)=>{const p=pair.responses[index++];assert.equal(String(url),p.requestedURL);assert.equal(init.redirect,'manual');return Object.defineProperty(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.url})}}),e=>{
  assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.closingNativeApplicationModelMatches,true);assert.equal(n.closingFullCurrentIntakeMatch,false);assert.equal(n.closingRedirectResponseHTMLMatches,false);assert.equal(n.lifecycleCleanupAllowed,false);assert.notEqual(n.nativeOpeningModel.redirect.html,n.nativeClosingModel.redirect.html);return true
 });assert.equal(index,6)
})
