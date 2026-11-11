import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentScraper} from '../scraper/2u/currentNative.js'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {createTwoUOriginalReader} from './helpers/twoUCurrentFixture20261110.js'

const provider=getScraperCatalog().find(p=>p.source==='2u')
const registered=options=>createCatalogScraper(provider).run(options)
const folder=new URL('../scraper-support/tests/fixtures/twoUCurrent20261110/',import.meta.url)
const fixture=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'))
const originals=new Map(fixture.records.map(row=>{
 const body=gunzipSync(fs.readFileSync(new URL(row.bodyFile,folder)))
 assert.equal(body.length,row.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),row.sha256)
 return[row.requestedUrl,{url:row.finalUrl,status:row.status,headers:row.headers,bodyBase64:body.toString('base64'),requestedAt:row.sourceRequestedAt,completedAt:row.sourceCompletedAt}]
}))
const now=()=>fixture.captureCompletedAt
const noReads=()=>assert.fail('Caller limits must prevent public acquisition')
const reader=()=>{const calls=[],readOriginal=createTwoUOriginalReader();return{calls,fetchPage:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
 assert.ok(originals.has(url),'Only retained original public endpoints: '+url)
 calls.push(url);return readOriginal(url)
}}}
const assertSkip=jobs=>{
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.firstParty,false)
 assert.equal(evidence.pagesFetched,0);assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.verifiedAt,null)
 assert.equal(audit.observations.length,0);assert.equal(audit.originalPages.length,0)
 assert.equal(audit.requestCount,0);assert.equal(audit.aggregateBytes,0);assert.equal(audit.observedAt,null)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.closingMatches,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(readSourceObservationEvidence(jobs,'2u').observedRecordCount,0)
}

for(const option of ['maxJobs','maxPages']){
 test('2U registered '+option+' zero skips acquisition and observation clocks',async()=>{
  let audit
  const jobs=await registered({[option]:0,fetchImpl:noReads,fetchPage:noReads,now:()=>assert.fail('No clock for a skipped observation'),onAudit:value=>{audit=value}})
  assertSkip(jobs);assert.equal(audit,jobs.nativeCollectionEvidence)
 })
 test('2U factory '+option+' zero survives undefined runtime override',async()=>{
  const jobs=await createCurrentScraper({[option]:0,fetchPage:noReads}).run({[option]:undefined,now:noReads})
  assertSkip(jobs)
 })
 test('2U explicit null '+option+' removes only its factory zero cap',async()=>{
  const io=reader(),jobs=await createCurrentScraper({[option]:0}).run({...io,[option]:null,now})
  assert.equal(io.calls.length,18);assert.equal(jobs.nativeCollectionEvidence.observations.length,2)
  assert.equal(jobs.nativeCollectionEvidence.observations.find(row=>row.id==='8871017002').country,'United States')
  assert.equal(jobs.nativeCollectionEvidence.observations.find(row=>row.id==='8871017002').sourceDetailComplete,true)
  assert.equal(jobs.nativeCollectionEvidence.closingMatches,true);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 })
}
for(const value of [-1,1.5,NaN,Infinity,'1',false,Number.MAX_SAFE_INTEGER+1]){
 test('2U invalid page cap rejects before callbacks: '+String(value),async()=>{
  await assert.rejects(registered({maxPages:value,fetchPage:noReads,now:noReads}),e=>e.code==='TWO_U_INVALID_OPTIONS')
 })
}
for(const value of [false,0,'',true,'2026-11-07T06:00:00.000Z']){
 test('2U invalid observation clock type rejects before IO: '+JSON.stringify(value),async()=>{
  await assert.rejects(registered({now:value,fetchPage:noReads}),e=>e.code==='TWO_U_INVALID_OPTIONS')
 })
}
for(const key of ['onAudit','fetchPage','fetchImpl']){
 test('2U invalid '+key+' callback rejects before clock and IO',async()=>{
  await assert.rejects(registered({[key]:true,now:noReads}),e=>e.code==='TWO_U_INVALID_OPTIONS')
 })
}
test('2U caller cancellation outranks zero limits and every callback',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'cancelled before skipped scan'});controller.abort(reason)
 await assert.rejects(registered({signal:controller.signal,maxJobs:0,maxPages:0,now:noReads,fetchPage:noReads,onAudit:noReads}),e=>e===reason)
})
test('2U zero-cap audit callback is bounded without public acquisition',async()=>{
 let audited=false
 await assert.rejects(registered({maxJobs:0,fetchPage:noReads,auditTimeoutMs:5,onAudit:()=>{audited=true;return new Promise(()=>{})}}),e=>e.code==='TWO_U_PUBLIC_AUDIT_TIMEOUT')
 assert.equal(audited,true)
})
test('2U caller cancellation interrupts a hung zero-cap audit callback exactly',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'stop skipped audit'})
 await assert.rejects(registered({maxPages:0,signal:controller.signal,fetchPage:noReads,onAudit:()=>{queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})}}),e=>e===reason)
})
test('2U finite page budget1 stops before the second original GET',async()=>{
 const io=reader();let audit
 await assert.rejects(registered({...io,maxPages:1,now,onAudit:value=>{audit=value}}),e=>e.code==='TWO_U_PUBLIC_PAGE_BUDGET')
 assert.equal(io.calls.length,1);assert.equal(audit.originalPages.length,1)
 assert.equal(audit.observations.length,0);assert.equal(audit.closingMatches,false)
})
test('2U page budget15 retains its opening positive without closing or inventory claims',async()=>{
 const io=reader();let audit
 await assert.rejects(registered({...io,maxPages:15,now,onAudit:value=>{audit=value}}),e=>e.code==='TWO_U_PUBLIC_PAGE_BUDGET')
 assert.equal(io.calls.length,15);assert.equal(audit.originalPages.length,15)
 assert.equal(audit.observations.length,2);assert.equal(audit.observations.find(row=>row.id==='8871017002').id,'8871017002')
 assert.equal(audit.observations.find(row=>row.id==='8871017002').country,'United States');assert.equal(audit.observations.find(row=>row.id==='8871017002').sourceDetailComplete,true)
 assert.equal(audit.closingMatches,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
})
test('2U page budget18 closes all retained current models and full role criteria',async()=>{
 const io=reader(),jobs=await registered({...io,maxPages:18,maxJobs:1,now})
 assert.equal(io.calls.length,18);assert.equal(jobs.length,0)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.closingMatches,true);assert.equal(audit.observations.length,2)
 for(const [index,page]of audit.originalPages.entries()){
  assert.equal(page.requestedURL,fixture.records[index].requestedUrl)
  assert.equal(page.requestedAt,fixture.records[index].sourceRequestedAt)
  assert.equal(page.completedAt,fixture.records[index].sourceCompletedAt)
 }
 assert.equal(audit.observations.find(row=>row.id==='8871017002').sourceDetailComplete,true)
 assert.ok(audit.observations.find(row=>row.id==='8871017002').jobDescription.includes('2U is an equal opportunity employer'))
 assert.equal(audit.observations.find(row=>row.id==='8871017002').country,'United States')
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})
test('2U finite page cap cannot bypass the independent lower request ceiling',async()=>{
 const io=reader()
 await assert.rejects(registered({...io,maxPages:16,maxRequests:2,now}),e=>e.code==='TWO_U_PUBLIC_REQUEST_BUDGET')
 assert.equal(io.calls.length,2)
})
test('2U null removes a factory page skip while undefined preserves its hard request ceiling',async()=>{
 const io=reader()
 await assert.rejects(createCurrentScraper({maxPages:0,maxRequests:2}).run({...io,maxPages:null,maxRequests:undefined,now}),e=>e.code==='TWO_U_PUBLIC_REQUEST_BUDGET')
 assert.equal(io.calls.length,2)
})
