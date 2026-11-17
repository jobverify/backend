import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
let wire=async()=>{throw Error('Uncaptured network disabled')}
mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
export const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%2]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('current Inspire native page8033 reconciles six full vacancy models and future intake without India or company-zero promotion',async()=>{
 const io=replay();wire=io.fetchImpl;const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence,o=readSourceObservationEvidence(jobs,'inspireai')
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),4);assert.equal(e.status,'discovery-only');assert.equal(e.firstParty,true);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(o.observedRecordCount,7);assert.equal(o.observedVacancyCount,6);assert.equal(o.recordKind,'mixed');assert.equal(a.fullNativeClosingEqual,true);assert.equal(a.records.length,7);assert.ok(a.records.every(r=>r.nativeId&&r.originalModel&&r.sourceDescription));assert.equal(a.records[6].recordKind,'hiring-signal');assert.ok(a.records.every(r=>r.country!=='India'));assert.ok(a.records.every(r=>r.sourceApplicationQualified===false))
})
test('native data is dynamic while complete published HTML and API accordion models must agree',async()=>{
 const io=replay((p,i)=>{if(i%2===1){let body=Buffer.from(p.bodyBase64,'base64').toString();body=body.replaceAll('Senior Project Manager - AI &amp; Salesforce - UK','Senior Delivery Manager - AI &amp; Salesforce - UK');p.bodyBase64=Buffer.from(body).toString('base64')}else{const j=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString());j.content.rendered=j.content.rendered.replaceAll('Senior Project Manager - AI &amp; Salesforce - UK','Senior Delivery Manager - AI &amp; Salesforce - UK');p.bodyBase64=Buffer.from(JSON.stringify(j)).toString('base64')}})
 const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0});assert.equal(jobs.nativeCollectionEvidence.records[5].title,'Senior Delivery Manager - AI & Salesforce - UK');assert.equal(jobs.length,0)
})
test('API criteria, native country, record identity, application and protected-page conflicts remain held',async()=>{
 for(const change of [j=>{j.content.rendered=j.content.rendered.replace('3–5 years','7–9 years')},j=>{j.content.rendered=j.content.rendered.replace('South Africa Based','India Based')},j=>{j.content.rendered=j.content.rendered.replaceAll('e-n-accordion-item-1142','e-n-accordion-item-1141')},j=>{j.content.rendered=j.content.rendered.replace('https://forms.gle/R7dzBjT4PE1gJNqN9','https://example.org/apply')},j=>{j.content.protected=true},j=>{j.id=8034}]){
  const io=replay((p,i)=>{if(i===2){const j=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString()),before=JSON.stringify(j);change(j);assert.notEqual(JSON.stringify(j),before,'fixture mutation must change actual original');p.bodyBase64=Buffer.from(JSON.stringify(j)).toString('base64')}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}));assert.equal(io.reads(),2)
 }
})
test('full raw closing catches changes outside selected vacancy fields as well as row criteria',async()=>{
 for(const at of [3,4]){
  const io=replay((p,i)=>{if(i===at){if(at===3)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<!-- changed complete publisher -->').toString('base64');else{const j=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString());j.meta.footnotes='changed full native metadata';p.bodyBase64=Buffer.from(JSON.stringify(j)).toString('base64')}}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/closing/);assert.equal(io.reads(),4)
 }
})
test('bare remote or country-adjacent wording cannot qualify a native India record',async()=>{
 const {parseCurrentAccordions}=await import('./currentNative20261117.js'),html=Buffer.from(fixture.originals[0].bodyBase64,'base64').toString(),rows=parseCurrentAccordions(html)
 assert.equal(rows[0].country,null);assert.equal(rows[4].country,null);assert.equal(rows[5].country,null);assert.equal(rows[2].country,'South Africa');assert.equal(rows[3].country,'Netherlands')
})
test('final synchronous audit attachment preserves exact caller and source-deadline ownership',async()=>{
 for(const cancel of [false,true]){
  const caller=new AbortController(),reason=Object.freeze({owner:'inspire-final-audit'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0
  const clockMock=mock.method(performance,'now',()=>clock()+offset),defineMock=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=2000}return result})
  try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:1000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>cancel?error===reason:error.name==='TimeoutError'&&error.message.includes('source deadline'));assert.equal(io.reads(),4)}finally{defineMock.mock.restore();clockMock.mock.restore()}
 }
})
