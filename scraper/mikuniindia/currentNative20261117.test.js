import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Public network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url)??fixture.responses[1];return Buffer.from(p.bodyBase64,'base64').toString()},fetchPage:async url=>{const p=fixture.responses.find(p=>p.requestedURL===url);return{status:p.status,url:p.url,html:Buffer.from(p.bodyBase64,'base64').toString()}},fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declared URL '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');reads.push(String(url));const count=(counts.get(url)??0)+1;counts.set(url,count);const changed=edit(p,Buffer.from(p.bodyBase64,'base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response(r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('mikuniindia actual current declared full native originals retain inventory and country scope holds',async()=>{const {reads,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');assert.equal(e.nativeCollectionEvidence.lifecycleCleanupAllowed,false);assert.equal(e.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(e.nativeCollectionEvidence.browserEquivalenceComplete,false);return true});assert.equal(reads.length,fixture.responses.length*2)})
export {fixture,replay}

test('Mikuni full own published page DTOs, native grid, dormant form widget and dates remain raw without role-country or empty-company promotion',async()=>{
 const {options}=replay();await assert.rejects(run(options),e=>{const n=e.nativeCollectionEvidence,o=n.nativeOpeningModel;assert.equal(o.publishedNoPostsFound,true);assert.equal(o.activeApplicationForms.length,0);assert.deepEqual(o.publications.map(p=>p.nativePublicationDTO.id),[1163,556]);assert.equal(o.publications[0].nativePublicationDTO.modified,'2024-02-22T09:58:54');assert.equal(o.publications[0].perRoleCountryOrDatesNotInferred,true);assert.ok(o.programme.fullAST);assert.equal(o.externalNaukriNavigationPerformed,false);assert.equal(n.verifiedEmpty,false);assert.equal(n.observedVacancyCount,null);return true})
})

test('Mikuni whole HTML/publication IDs, declared API URLs and full native programme cannot mix with foreign or changed profiles',async()=>{
 for(const mode of ['foreign-handoff','json-id','json-link','programme']){const {options}=replay((p,s)=>{
  if(p.url==='https://mikuni.co.in/'&&mode==='foreign-handoff')return s.replaceAll('href="https://mikuni.co.in/vacant-positions/"','href="https://foreign.invalid/jobs/"')
  if(p.url.endsWith('/pages/1163')&&mode==='json-id')return JSON.stringify({...JSON.parse(s),id:1164})
  if(p.url.endsWith('/pages/556')&&mode==='json-link')return JSON.stringify({...JSON.parse(s),link:'https://foreign.invalid/apply/'})
  if(p.url.includes('/eael-1163.js?')&&mode==='programme')return s+'\nwindow.unknownNativeGrid=true;';return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})

test('Mikuni future native grid/DTO criteria and nontext requirements remain fully retained, unequal and unqualified',async()=>{
 const {options}=replay((p,s,count)=>{
  if(count===2&&p.url.endsWith('/vacant-positions/'))return s.replace('<p class="no-posts-found">No posts found!</p>','<article class="eael-grid-post"><h2>New native role</h2><p>noteligible</p><img src="/unproven-criteria.png"></article>')
  if(count===2&&p.url.endsWith('/pages/1163'))return JSON.stringify({...JSON.parse(s),unreviewedNativeCriteria:{description:'not eligible',country:null}});return s
 });await assert.rejects(run(options),e=>{const n=e.nativeCollectionEvidence;assert.equal(n.nativeClosingModel.publishedNoPostsFound,false);assert.equal(n.nativeClosingModel.publications[0].nativePublicationDTO.unreviewedNativeCriteria.description,'not eligible');assert.match(n.nativeClosingModel.publications[0].publication.fullNativeHTML,/noteligible/);assert.match(n.nativeClosingModel.publications[0].publication.fullNativeHTML,/unproven-criteria/);assert.equal(n.closingFullNativeModelMatches,false);assert.equal(n.lifecycleCleanupAllowed,false);return e.failureKind==='source_inventory_unavailable'})
})

test('Mikuni native denial and exact opaque/null caller stop before nonexistent forms, Naukri or guessed routes',async()=>{
 const denied=replay((p,s)=>p.url.endsWith('/pages/1163')?{body:s,status:403}:s);await assert.rejects(run(denied.options),e=>e.httpStatus===403);assert.equal(denied.reads.length,4)
 for(const reason of [Object.freeze({owner:'Mikuni'}),null]){const caller=new AbortController();caller.abort(reason);await assert.rejects(run({signal:caller.signal,fetchImpl:async()=>{throw Error('No fetch')}}),e=>e===reason)}
})
