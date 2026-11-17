import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import {run} from './script.js'
import {readCurrentNumeros} from './currentNative20261117.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const changed=(p,fn)=>({...p,bodyBase64:Buffer.from(fn(Buffer.from(p.bodyBase64,'base64').toString())).toString('base64')})
function replay(change=p=>p){const calls=[],counts=new Map();return {calls,requestIntervalMs:0,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined)
 const matches=fixture.originals.filter(p=>p.requestedURL===url),n=counts.get(url)??0;assert.ok(n<matches.length,'No guessed URL or extra request: '+url);counts.set(url,n+1);const p=change(structuredClone(matches[n]));calls.push(p)
 return Object.defineProperty(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})
}}}
test('registered Numeros current original acquisition preserves all19 authored signals, raw cards/popup and rendering/criteria/country/scope holds',async()=>{
 const io=replay(),provider=getScraperCatalog().find(p=>p.source==='numerosmotors'),jobs=await createCatalogScraper(provider).run(io),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(io.calls.length,10);assert.equal(audit.observations.length,19)
 assert.deepEqual(readSourceObservationEvidence(jobs,'numerosmotors'),{source:'numerosmotors',recordKind:'hiring-signals',observedRecordCount:19,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(audit.completeRawCardsClosingReconciled,true);assert.equal(audit.completePopupClosingReconciled,true);assert.equal(audit.rawFullPublisherModelsClosingReconciled,false);assert.equal(audit.closingQualified,false);assert.deepEqual(audit.excludedClosingPaths,[])
 assert.equal(audit.observations.filter(o=>o.allConfiguredViewportClassesHidden).length,9)
 for(const o of audit.observations){assert.equal(o.country,null);assert.equal(o.city,null);assert.equal(o.location,null);assert.equal(o.jobDescription,null);assert.equal(o.sourceDetailComplete,false);assert.equal(o.lifecycleCleanupAllowed,false);assert.ok(o.nativeSectionModel.attrs['data-id']);assert.ok(o.nativeBriefText.includes('Year of Exp.'))}
 assert.equal(audit.opening.application.formModel.attrs.method,'post');assert.equal(audit.opening.application.positionFieldModel.attrs.value,'');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const a=assessSoftFailureAcquisition(provider,jobs);assert.equal(a.runnerOutcome.rawRecords,0);assert.equal(a.runnerOutcome.sourceObservations.observedRecordCount,19);assert.equal(a.eligibleJobs,0);assert.equal(a.cleanupOptions.replaceExisting,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
test('same typed source can observe a changed bounded role title without pinning19 current titles',async()=>{
 const io=replay(p=>p.requestedURL==='https://numerosmotors.com/open-positions/'?changed(p,s=>s.replaceAll('Assistant Company Secretary','Assistant Company Secretary II')):p),jobs=await run(io)
 assert.ok(jobs.nativeCollectionEvidence.observations.some(o=>o.title==='Assistant Company Secretary II'));assert.equal(jobs.length,0)
})
for(const [name,change,pattern]of [
 ['missing official careers declaration',p=>p.requestedURL==='https://numerosmotors.com/'?changed(p,s=>s.replaceAll('https://numerosmotors.com/careers/','https://example.com/careers/').replaceAll('href="/careers"','href="/other"').replaceAll('href="https://numerosmotors.com/careers"','href="https://example.com/careers"')):p,/careers/],
 ['missing declared own positions handoff',p=>p.requestedURL==='https://numerosmotors.com/careers/'?changed(p,s=>s.replaceAll('href="/open-positions"','href="/other"')):p,/positions handoff/],
 ['wrong WordPress role publisher ID',p=>p.requestedURL.endsWith('/open-positions/')?changed(p,s=>s.replaceAll('data-elementor-id="13323"','data-elementor-id="13324"')):p,/publisher/],
 ['declared executable program drift',p=>p.requestedURL.includes('/litespeed/js/')?changed(p,s=>s+'\n/*changed*/'):p,/program/],
 ['declared stylesheet drift',p=>p.requestedURL.includes('/litespeed/ucss/')?changed(p,s=>s+'\n/*changed*/'):p,/stylesheet/],
 ['closing original card criteria drift',p=>p.phase==='closing'&&p.requestedURL.endsWith('/open-positions/')?changed(p,s=>s.replaceAll('04--06 Year of Exp.','05--07 Year of Exp.')):p,/closing.*card|card.*closing/],
 ['closing application upload constraint drift',p=>p.phase==='closing'&&p.requestedURL.endsWith('/open-positions/')?changed(p,s=>s.replace('accept="audio/*,video/*,image/*"','accept="application/pdf"')):p,/closing.*popup|popup.*closing/],
 ['closing full hidden-class model drift',p=>p.phase==='closing'&&p.requestedURL.endsWith('/open-positions/')?changed(p,s=>s.replaceAll('elementor-hidden-widescreen','changed-hidden-class')):p,/closing.*card|card.*closing/],
])test(name,async()=>{await assert.rejects(run(replay(change)),pattern)})
test('original source zero cap has no reads or invented observation/zero-inventory proof',async()=>{const jobs=await run({maxJobs:0,fetchImpl:async()=>assert.fail('no request')});assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'numerosmotors'),null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)})
test('body-only callbacks cannot qualify this current source',async()=>{await assert.rejects(readCurrentNumeros({fetchText:async()=>'<html>India</html>'}),/original HTTP metadata|body-only/i)})
test('opaque preaborted caller reason survives with no native request',async()=>{const c=new AbortController(),reason=Object.freeze({owner:'numeros'});c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>assert.fail('no request')}),e=>e===reason)})
for(const status of [403,429,202])test('observed '+status+' denial wins over stalled body/local deadline',async()=>{await assert.rejects(run({requestTimeoutMs:20,requestIntervalMs:0,fetchImpl:async url=>({status,url,headers:new Headers({'content-type':'text/html',...(status===202?{'x-amzn-waf-action':'challenge'}:{})}),body:{cancel:()=>new Promise(()=>{}),getReader:()=>assert.fail('no denied body read')}})}),e=>(e.status??e.httpStatus)===status)})
for(const mode of ['caller','source-deadline'])test('paced native reads preserve '+mode+' and start no second fetch',async()=>{
 const io=replay(),c=new AbortController(),reason=Object.freeze({owner:'numeros-pacing'});let timer
 if(mode==='caller')timer=setTimeout(()=>c.abort(reason),100)
 try{await assert.rejects(run({...io,signal:c.signal,requestIntervalMs:500,sourceTimeoutMs:mode==='caller'?2000:100}),e=>mode==='caller'?e===reason:e.name==='TimeoutError');assert.equal(io.calls.length,1)}finally{clearTimeout(timer)}
})
test('source owns in-flight cancellation while preserving frozen caller reason',async()=>{
 const c=new AbortController(),reason=Object.freeze({owner:'inflight'});let canceled=0
 const pending=run({signal:c.signal,requestIntervalMs:0,fetchImpl:async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:new ReadableStream({pull(){},cancel(){canceled++}})})})
 await delay(20);c.abort(reason);await assert.rejects(pending,e=>e===reason);await delay(1);assert.equal(canceled,1)
})
