import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,extractCareerJobs} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
mock.method(globalThis,'fetch',async()=>{throw Error('Uncaptured network disabled in source-backed tests')})
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals
const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{assert.equal(init.redirect,'manual');const p=structuredClone(originals[i++%14]);assert.equal(url,p.requestedURL);change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('current declared Framer CMS4historic candidates and general intake form remain observations with whole closing',async()=>{
 const io=replay(),jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),28);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(a.nativeCmsRecords.length,4);assert.equal(a.intakeForms.length,1);assert.equal(a.fullNativeClosingEqual,true);assert.equal(a.nativeCmsRecords[0].nativeId,'kPJSJ5vUt');assert.equal(a.nativeCmsRecords[0].nativePublishedTitle,'Bussiness Analyst')
 assert.ok(a.nativeCmsRecords.every(r=>r.country===null&&r.jobDescription===null&&r.sourceDetailComplete===false&&r.nativeListedOn==='2025-05-01T00:00:00.000Z'));assert.equal(a.nativeCmsRecords.filter(r=>r.nativeLink==='https://www.framer.com/careers/').length,3)
 assert.deepEqual(a.intakeForms[0].selectPreferences.map(s=>s.options.map(o=>o.text)),[['Apply for','Internship','Full-time role','Research position'],['Select Area of Interest','AI Research','Cybersecurity','Cloud Computing','Internet Technologies','Software Engineering','Data Science']])
 const obs=readSourceObservationEvidence(jobs,'innspark');assert.equal(obs.observedRecordCount,5);assert.equal(obs.recordKind,'hiring-signals');assert.equal(obs.observedVacancyCount,0);assert.equal(obs.sourceScopeComplete,false)
})
test('exact308 handoff and complete native entity/closing drift remain held',async()=>{
 for(const target of [1,15,23,28]){const io=replay((p,i)=>{if(i!==target)return;if(i===1||i===15)p.status=200;else p.bodyBase64=Buffer.concat([Buffer.from(p.bodyBase64,'base64'),Buffer.from(' changed')]).toString('base64')});await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/308|native|profile|closing/i)}
})
test('legacy body-only callbacks and inferred India publication stay unavailable',async()=>{
 await assert.rejects(run({fetchText:async()=>'<p>Innspark</p>'}),/metadata|unsupported/i)
 const historical=fs.readFileSync(new URL('../../scraper-support/tests/fixtures/innspark/careers.html',import.meta.url),'utf8'),rows=extractCareerJobs(historical);assert.equal(rows.length,11);assert.ok(rows.every(r=>r.country===null&&r.city===null&&r.jobDescription===null))
})
test('same-count changed CMS criteria and native detail IDs do not pass their source bindings',async()=>{
 for(const target of [9,11]){const io=replay((p,i)=>{if(i!==target)return;const bytes=Buffer.from(p.bodyBase64,'base64');if(i===9){const at=bytes.indexOf(Buffer.from("We're seeking"));assert.ok(at>0);bytes[at]=90;p.bodyBase64=bytes.toString('base64')}else p.bodyBase64=Buffer.from(bytes.toString().replaceAll('kPJSJ5vUt','differentID')).toString('base64')});await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/description|identity/i)}
})
test('caller/source ownership is rechecked after the last synchronous native model decode',async()=>{
 for(const mode of ['deadline','caller']){
  let clock=0,lastModels=0;const owner=new AbortController(),reason=Object.freeze({owner:'last-native-model'}),originalParse=JSON.parse,clockMock=mock.method(performance,'now',()=>clock),parseMock=mock.method(JSON,'parse',(value,...rest)=>{
   const parsed=Reflect.apply(originalParse,JSON,[value,...rest]);if(typeof value==='string'&&value.includes('"collectionItemId":"iqBzqWOV0"')&&++lastModels===2){if(mode==='deadline')clock=10001;else owner.abort(reason)}return parsed
  })
  try{const io=replay();await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0,sourceTimeoutMs:10000,signal:owner.signal}),e=>mode==='caller'?e===reason:e.name==='TimeoutError');assert.equal(io.reads(),28)}finally{parseMock.mock.restore();clockMock.mock.restore()}
 }
})
