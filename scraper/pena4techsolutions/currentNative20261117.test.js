import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import {runCurrentPena4,runCurrentPena4 as run} from './currentNative20261117.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const json=(p,change)=>{const value=JSON.parse(Buffer.from(p.bodyBase64,'base64'));change(value);return {...p,bodyBase64:Buffer.from(JSON.stringify(value)).toString('base64')}}
const text=(p,change)=>({...p,bodyBase64:Buffer.from(change(Buffer.from(p.bodyBase64,'base64').toString())).toString('base64')})
function replay(change=p=>p){
 const calls=[],counts=new Map()
 const fetchImpl=async(url,init={})=>{
  assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const key=JSON.stringify([String(url),init.method??'GET',init.body??null]),matches=fixture.originals.filter(p=>JSON.stringify([p.requestedURL,p.method,p.requestBody])===key),n=counts.get(key)??0
  assert.ok(n<matches.length,'No guessed URL, mutation or extra read: '+url);counts.set(key,n+1)
  const p=change(structuredClone(matches[n]));calls.push(p)
  if(String(url).startsWith('https://gateway.app.hrone.cloud/')){assert.equal(init.headers.domainCode,'pena4tech');assert.ok(init.headers.apiKey);assert.equal(init.headers.Origin,'https://career.hrone.cloud')}
  return Object.defineProperty(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})
 }
 return {calls,fetchImpl,requestIntervalMs:0}
}
test('original20261117 Pena4 observation module retains18 raw observations and its original unresolved-country holds',async()=>{
 const io=replay(),provider=getScraperCatalog().find(p=>p.source==='pena4techsolutions'),jobs=await run(io)
 assert.equal(jobs.length,0);assert.equal(io.calls.length,56)
 assert.deepEqual(readSourceObservationEvidence(jobs,'pena4techsolutions'),{source:'pena4techsolutions',recordKind:'vacancy-rows',observedRecordCount:18,observedVacancyCount:18,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observations.length,18);assert.equal(audit.rawModelsClosingReconciled,false);assert.equal(audit.closingQualified,false);assert.equal(audit.closingDifferences.length,33)
 assert.ok(audit.closingDifferences.every(d=>/\.(requestOwnerDetails\.imageVirtualPath|replacedEmployee\.\d+\.imageVirtualPath)$/.test(d.path)))
 assert.equal(audit.reader.requests,56);assert.equal(audit.listingPagesClosingReconciled,true)
 for(const o of audit.observations){assert.equal(o.country,null);assert.equal(o.city,null);assert.equal(o.location,null);assert.equal(o.sourceDetailComplete,false);assert.equal(o.sourceScopeComplete,false);assert.equal(o.lifecycleCleanupAllowed,false);assert.equal(o.nativeOwnRoleDTO.company,'Pena4 Tech Solutions India Private Ltd');assert.equal(o.nativeOwnRoleDTO.requestId,Number(o.jobId));assert.equal(o.nativeClosingOwnRoleDTO.requestId,Number(o.jobId));assert.ok(o.qualificationHolds.includes('native-work-country-unpublished;bare-city-and-India-tab-not-country-proof'))}
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider,jobs);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.runnerOutcome.rawRecords,18);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
test('current native position cohort is dynamic within the same reviewed program and tenant contract',async()=>{
 const io=replay(p=>p.requestedURL.endsWith('/CareerPosition/Details')&&JSON.parse(p.requestBody).pagination.pageNumber===2?json(p,rows=>rows.pop()):p),jobs=await run(io)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,17);assert.equal(io.calls.length,54)
})
for(const [name,change,pattern]of [
 ['India-tab frame removed',p=>p.requestedURL==='https://www.pena4.com/jobs.php'?text(p,s=>s.replace('src="https://hr-1.in/f3dff0"','src="https://example.com/"')):p,/India-tab/],
 ['foreign shortlink tenant',p=>p.requestedURL==='https://hr-1.in/f3dff0'?({...p,headers:{...p.headers,location:p.headers.location.replace('dc=pena4tech','dc=foreign')}}):p,/tenant/],
 ['whole declared client program changed',p=>p.requestedURL.endsWith('/1020.5da02bbdf228dacf.js')?text(p,s=>s+'\n/* changed */'):p,/program/],
 ['duplicate native position',p=>p.phase==='opening-inventory'&&JSON.parse(p.requestBody).pagination.pageNumber===1?json(p,rows=>rows[1]=rows[0]):p,/duplicate/],
 ['detail identity mismatch',p=>p.phase==='opening-details'?json(p,d=>d.requestId++):p,/own-role identity/],
 ['native employer mismatch',p=>p.phase==='opening-details'?json(p,d=>d.company='Other Company'):p,/employer/],
 ['closing native label model changed',p=>p.phase==='closing-labels'?json(p,rows=>rows[0].displayName+=' changed'):p,/closing.*label|label.*closing/],
 ['closing complete page ordering changed',p=>p.phase==='closing-inventory'&&JSON.parse(p.requestBody).pagination.pageNumber===1?json(p,rows=>rows.reverse()):p,/closing.*page|page.*closing/],
 ['closing own-role identity mismatch',p=>p.phase==='closing-details'?json(p,d=>d.jobCode+=' changed'):p,/own-role identity/],
])test(name,async()=>{const io=replay(change);await assert.rejects(run(io),pattern)})
test('every changed DTO field is retained as a full raw closing hold, with no staff query exclusions',async()=>{
 const io=replay(p=>p.phase==='closing-details'?json(p,d=>{d.jobDescriptionBodyWithHtml+=' changed';d.extraNativeField={criteria:'new'}}):p),jobs=await run(io),a=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(a.rawModelsClosingReconciled,false);assert.equal(a.closingQualified,false);assert.deepEqual(a.excludedClosingPaths,[])
 assert.ok(a.closingDifferences.some(d=>d.path.endsWith('.jobDescriptionBodyWithHtml')));assert.ok(a.closingDifferences.some(d=>d.path.endsWith('.extraNativeField')))
})
test('an exact raw DTO replay still holds country/full rendering/application and employer-wide scope',async()=>{
 const opening=new Map(fixture.originals.filter(p=>p.phase==='opening-details').map(p=>[p.requestedURL,p]))
 const io=replay(p=>p.phase==='closing-details'?{...p,bodyBase64:opening.get(p.requestedURL).bodyBase64}:p),jobs=await run(io),a=jobs.nativeCollectionEvidence
 assert.equal(a.rawModelsClosingReconciled,true);assert.equal(a.closingQualified,false);assert.equal(jobs.length,0);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('caller zero cap makes no request and invents no observation count',async()=>{
 let calls=0;const jobs=await run({maxJobs:0,fetchImpl:async()=>{calls++;throw Error('unexpected')}})
 assert.equal(calls,0);assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,'pena4techsolutions'),null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('caller page cap cannot turn a nonterminal native page into a complete inventory',async()=>{const io=replay();await assert.rejects(run({...io,maxPages:1}),/terminal page/);assert.equal(io.calls.filter(p=>p.phase==='opening-inventory').length,1)})
test('body-only callbacks cannot bypass HTTP metadata and source authority',async()=>{await assert.rejects(runCurrentPena4({fetchText:async()=>'<html>India</html>'}),/original HTTP metadata|body-only/i)})
test('preaborted opaque caller reason is preserved without reads',async()=>{const c=new AbortController(),reason=Object.freeze({owner:'caller'});c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>assert.fail('no read')}),e=>e===reason)})
for(const status of [403,429,202])test('observed HTTP '+status+' survives stalled error body and a local deadline',async()=>{
 const p=fixture.originals[0];let reads=0
 await assert.rejects(run({requestTimeoutMs:20,requestIntervalMs:0,fetchImpl:async()=>{reads++;return {status,url:p.requestedURL,headers:new Headers({'content-type':'text/html',...(status===202?{'x-amzn-waf-action':'challenge'}:{})}),body:{cancel:()=>new Promise(()=>{}),getReader:()=>assert.fail('denied body must not be read')}}}}),e=>(e.status??e.httpStatus)===status)
 assert.equal(reads,1)
})
test('caller opaque abort during pacing preserves ownership and starts no next fetch',async()=>{
 const c=new AbortController(),reason=Object.freeze({owner:'paced-caller'}),io=replay(),pending=run({...io,requestIntervalMs:1000,signal:c.signal})
 while(io.calls.length===0)await delay(2)
 await delay(20);c.abort(reason);await assert.rejects(pending,e=>e===reason);assert.equal(io.calls.length,1)
})
test('stalled successful body cleanup preserves a later opaque caller abort and owns its reader until disposal',async()=>{
 const c=new AbortController(),reason=Object.freeze({owner:'cleanup-caller'}),order=[]
 const pending=run({requestTimeoutMs:10,requestIntervalMs:0,signal:c.signal,fetchImpl:async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{order.push('cancel');return new Promise(()=>{})},releaseLock:()=>order.push('release')})}})})
 setTimeout(()=>c.abort(reason),40)
 await assert.rejects(pending,e=>e===reason);assert.ok(order.includes('cancel'));assert.ok(order.indexOf('cancel')<order.indexOf('release'))
})
test('request deadline is enforced after synchronously blocked transport admission',async()=>{
 const io=replay(),fetchImpl=async(...args)=>{const until=performance.now()+25;while(performance.now()<until){/* Deliberately starve timer callbacks; elapsed deadline must still hold. */}return io.fetchImpl(...args)}
 await assert.rejects(run({...io,fetchImpl,requestTimeoutMs:10}),e=>e.name==='TimeoutError');assert.equal(io.calls.length,1)
})
