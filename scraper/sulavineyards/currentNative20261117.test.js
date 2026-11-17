import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const realNetwork=globalThis.fetch;before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regressions')}});after(()=>{globalThis.fetch=realNetwork})
function replay(edit=(p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.method,p.method??'GET');if(p.requestBody){assert.deepEqual(JSON.parse(init.body),p.requestBody);for(const[k,v]of Object.entries(p.requestHeaders))assert.equal(new Headers(init.headers).get(k),v)}const count=(counts.get(url)??0)+1;counts.set(url,count);reads.push(String(url));const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response((r.status??p.status)===302?null:r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('sulavineyards actual current native models remain unknown inventory with exact original authority and no fabricated vacancy zero',async()=>{const real=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Real network forbidden in regression')};try{const{reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.ok(n);assert.equal(n.observedVacancyCount,null);assert.equal(n.companyIndiaTotal,null);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.applicationSubmitted,false);assert.equal(n.browserEquivalenceComplete,false);assert.ok(n.nativeOpeningModel);assert.ok(n.nativeClosingModel);assert.equal(n.retainedResponses.length,reads.length);return true});assert.equal(reads.length,18)}finally{globalThis.fetch=real}})
export{fixture,replay}
test('Sula current narrow empty query preserves Artisan legal employer and full signed passive disagreement without company zero',async()=>{
 const{options}=replay((p,s,count)=>p.url.includes('/CareerPortal/')&&count===2?s.replace('Cover-Vineyard.png?','Cover-Vineyard.png?unreviewedPassiveContext=retained&'):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.equal(n.sourceEmployerMatchesNativeLegalEmployer,false);assert.equal(n.nativeOpeningModel.fullPortalDTO.portalDetails[0].companyName,'Artisan Spirits Pvt Ltd');assert.equal(n.nativeOpeningModel.fullPortalDTO.portalDetails[0].websiteName,'SULA VINEYARDS LIMITED');assert.equal(n.queriedNativeOpeningRowCount,0);assert.equal(n.queriedNativeClosingRowCount,0);assert.equal(n.closingFullPortalDTOMatches,false);assert.equal(n.closingQueriedRowsMatch,true);assert.notEqual(n.nativeOpeningModel.fullPortalDTOText,n.nativeClosingModel.fullPortalDTOText);return true})
})
test('Sula unreviewed native rows, unknown criteria and saturated pagination stay held as whole original DTOs',async()=>{
 const rows=Array.from({length:15},(_,i)=>({encryptedPositionId:'future-'+i,jobTitle:'Native future role '+i,country:'IN',legalEmployer:'Different own legal employer',qualification:{unknownFullField:'Requirements remain held'},applicationURL:'https://foreign.invalid/no-fetch'})),{options}=replay((p,s)=>p.method==='POST'?JSON.stringify(rows):s)
 await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');const n=e.nativeCollectionEvidence;assert.deepEqual(n.nativeOpeningModel.fullNativeQueriedRows,rows);assert.deepEqual(n.nativeClosingModel.fullNativeQueriedRows,rows);assert.equal(n.nativeQueryPaginationProven,false);assert.equal(n.observedVacancyCount,null);assert.equal(n.publicEligibility,null);assert.equal(n.lifecycleCleanupAllowed,false);return true})
})
test('Sula rejects inactive/foreign recruitment authority, mixed client deployments and whole programme drift',async()=>{
 for(const mode of['inactive-handoff','foreign-handoff','mixed-runtime','changed-client']){const{options}=replay((p,s)=>{
  if(p.url.endsWith('/careers.php')&&mode==='inactive-handoff')return s.replace('href="https://hr1.to//48353d"','hidden href="https://hr1.to//48353d"')
  if(p.url.endsWith('/careers.php')&&mode==='foreign-handoff')return s.replace('https://hr1.to//48353d','https://foreign.invalid/48353d')
  if(p.url.includes('/career-portal?')&&mode==='mixed-runtime')return s.replace('runtime.e1dcfa1dbf970e90.js','runtime.unreviewed.js')
  if(p.url.endsWith('/main.e3fa9a0389ba5822.js')&&mode==='changed-client')return s+'\nwindow.unreviewedNativeEmployer=true;';return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('Sula stops observed HTTP denial without legacy host fallback and preserves exact caller cancellation',async()=>{
 const denied=replay((_p,s)=>({body:s,status:403}));await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,1)
 const reason=Object.freeze({owner:'Sula current native'}),c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No fetch after caller abort')}}),e=>e===reason)
})
