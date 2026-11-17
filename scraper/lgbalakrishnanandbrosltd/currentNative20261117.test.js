import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Public network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url)??fixture.responses[1];return Buffer.from(p.bodyBase64,'base64').toString()},fetchPage:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url);return{status:p.status,url:p.url,html:Buffer.from(p.bodyBase64,'base64').toString()}},fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declared URL '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');reads.push(String(url));const count=(counts.get(url)??0)+1;counts.set(url,count);const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response(r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('lgbalakrishnanandbrosltd actual current declared full native originals retain inventory and country scope holds',async()=>{const {reads,options}=replay();const jobs=await run(options),n=jobs.nativeCollectionEvidence;assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'lgbalakrishnanandbrosltd').observedRecordCount,10);assert.equal(readSourceObservationEvidence(jobs,'lgbalakrishnanandbrosltd').observedVacancyCount,10);assert.equal(n.nativeOpeningDetails.length,10);assert.equal(n.nativeClosingDetails.length,10);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.companyIndiaTotal,null);assert.equal(n.browserEquivalenceComplete,false);assert.equal(reads.length,fixture.responses.length*2)})
export {fixture,replay}

test('LGB retains every native requirement, dormant consent/application declaration and original location without company or India promotion',async()=>{
 const {options}=replay(),jobs=await run(options),n=jobs.nativeCollectionEvidence
 assert.equal(n.nativeOpeningModel.records.length,10);assert.equal(n.nativeOpeningModel.programmes.length,4);assert.equal(n.nativeOpeningModel.continuationCarriers.length,0)
 for(const d of n.nativeOpeningDetails){assert.equal(d.nativeCountry,null);assert.equal(d.nativeCountryQualified,false);assert.equal(d.applicationSchemaAndBrowserBehaviourQualified,false);assert.ok(d.fullNativeBody);assert.ok(d.literalApplicationDeclarations.some(f=>f.inert&&f.nativeTree.attrs.id==='resumeUpload'));assert.match(JSON.stringify(d.literalApplicationDeclarations),/consentCheckbox/)}
 const first=n.nativeOpeningDetails[0];for(const text of ['Qualifications','Languages','Relevent Experience','Age','Responsibilities','Technical Skills','Soft Skills'])assert.ok(first.publishedNativeCriteria.includes(text),text)
 assert.equal(jobs.length,0);assert.equal(n.companyGlobalTotal,null);assert.equal(n.lifecycleCleanupAllowed,false)
})

test('LGB changing native ID and published full criteria remains raw typed vacancy observations without fixed old rows or inferred country',async()=>{
 const {options}=replay((p,s)=>p.url.endsWith('/careers/')?s.replace('A1726','A9999'):p.url.includes('ed7434ee-bfdb-4a2b-9dc3-e312504ce048')?s.replace('Requirments :','Requirments : New exact native criteria noteligible.'):s),jobs=await run(options),n=jobs.nativeCollectionEvidence
 assert.equal(readSourceObservationEvidence(jobs,'lgbalakrishnanandbrosltd').observedVacancyCount,10);assert.equal(n.nativeOpeningModel.records[0].nativeId,'A9999');assert.match(n.nativeOpeningDetails[0].publishedNativeCriteria,/noteligible/);assert.equal(jobs.length,0)
})

test('LGB mixed current employer, whole programme or detail-application identity fails closed',async()=>{
 for(const mode of ['foreign-employer','programme','detail-button']){const {options}=replay((p,s)=>{
  if(p.url==='https://lgb.co.in/'&&mode==='foreign-employer')return s.replace('href="https://connectgate.lgbportal.co.in/careers/"','href="https://foreign.invalid/careers/"')
  if(p.url.endsWith('/job-search.js?v1.2')&&mode==='programme')return s+'\nwindow.unreviewedNativeSearch=true;'
  if(p.url.includes('/job_apply/')&&mode==='detail-button')return s.replace('data-mprf-pk="','data-mprf-pk="foreign-');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})

test('LGB changed closing full criteria, nontext requirements and dormant application fields remain unequal and held',async()=>{
 const {options}=replay((p,s,count)=>p.url.includes('/job_apply/')&&count===2?s.replace('Requirments :','Requirments : Changed native closing criteria.<img src="/unknown-criterion.png">').replace('id="consentCheckbox"','id="consentCheckbox" data-current-rule="changed"'):s),jobs=await run(options),n=jobs.nativeCollectionEvidence
 assert.equal(n.closingFullDetailModelsMatch,false);assert.match(n.nativeClosingDetails[0].currentPublication.fullNativeHTML,/unknown-criterion/);assert.match(JSON.stringify(n.nativeClosingDetails[0].literalApplicationDeclarations),/data-current-rule/);assert.equal(jobs.length,0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('LGB actual denial and frozen/null caller cancellation stop before old portal, auth or application fallback',async()=>{
 const denied=replay((p,s)=>p.url==='https://connectgate.lgbportal.co.in/careers/'?{body:s,status:403}:s);await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,3)
 for(const reason of [Object.freeze({owner:'LGB'}),null]){const c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No request after abort')}}),e=>e===reason)}
})

test('LGB final synchronous audit attachment rechecks exact opaque/null caller and monotonic source deadline',async t=>{
 for(const mode of ['opaque','null','deadline']){const controller=new AbortController(),reason=mode==='null'?null:Object.freeze({owner:'LGB-late-audit'}),define=Object.defineProperty;let clock=0,triggered=false;t.mock.method(performance,'now',()=>clock);t.mock.method(Object,'defineProperty',(target,key,descriptor)=>{const out=define(target,key,descriptor);if(Array.isArray(target)&&key==='nativeCollectionEvidence'&&descriptor.value?.nativeOpeningModel){triggered=true;if(mode==='deadline')clock=180001;else controller.abort(reason)}return out});const {reads,options}=replay()
  try{await assert.rejects(run({...options,signal:controller.signal}),e=>mode==='deadline'?e.name==='TimeoutError'&&e.message==='LGB source deadline exceeded':e===reason);assert.equal(triggered,true);assert.equal(reads.length,34)}finally{t.mock.restoreAll()}
 }
})
