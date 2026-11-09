import test from 'node:test'
import assert from 'node:assert/strict'
import {run,CAREERS_URL} from '../../scraper/alaan/script.js'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../utils/scraperOutcome.js'

// Synthetic publisher context. No original embedded browser credential is copied.
const html='<html><head><title>Join Our Team: Explore Careers at Alaan</title></head><body><h2>Open positions</h2><p>Send your resume to <a href="mailto:careers@alaan.com">careers@alaan.com</a></p><div id="kula-jobs"><div id="kula-state">Loading open roles…</div><div id="kula-list" hidden></div></div><script>globalThis.ALAAAN_SCRIPT_EXECUTED=true;var KEY="SYNTHETIC_UNUSED_CREDENTIAL";var API="https://api.kula.ai/v1/job-boards/job-posts?limit=100";</script></body></html>'
const page=(text=html,extra={})=>({url:CAREERS_URL,status:200,headers:{'content-type':'text/html;charset=utf-8',date:'Sat, 07 Nov 2026 07:39:06 GMT'},
 bodyBase64:Buffer.from(text).toString('base64'),sourceRequestedAt:'2026-11-07T07:38:34.878Z',sourceCompletedAt:'2026-11-07T07:38:42.297Z',...extra})
const failClosed=error=>{assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.lifecycleCleanupAllowed,false);return true}

test('Alaan current loading context preserves unknown inventory and never executes or follows publisher content',async()=>{
 const requests=[],jobs=await run({fetchPage:async(url,init)=>{requests.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');return page()}})
 assert.deepEqual(requests,[CAREERS_URL]);assert.equal(globalThis.ALAAAN_SCRIPT_EXECUTED,undefined);assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.firstParty,true);assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.verifiedAt,null)
 assert.equal(isFreshCompleteInventoryEvidence(evidence),false);assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
 const observed=readSourceObservationEvidence(jobs,'alaan');assert.equal(observed.recordKind,'hiring-signals');assert.equal(observed.observedVacancyCount,0)
 assert.equal(observed.observedRecordCount,2);assert.equal(observed.companyGlobalTotal,null)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.responses[0].bodyBase64,page().bodyBase64);assert.equal(audit.responses[0].sourceRequestedAt,'2026-11-07T07:38:34.878Z')
 assert.equal(audit.responses[0].sourceCompletedAt,'2026-11-07T07:38:42.297Z');assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.observations[1].kind,'loading-context')
})

test('Alaan injected unavailable transport rejects instead of returning a historical empty success',async()=>{
 const failure=Error('synthetic current document unavailable')
 await assert.rejects(()=>run({fetchPage:async()=>{throw failure}}),error=>{assert.equal(error,failure);return failClosed(error)})
})

test('Alaan frozen transport rejection remains original and evidence is delivered independently',async()=>{
 const failure=Object.freeze(Error('frozen original unavailable')),audits=[]
 await assert.rejects(()=>run({fetchPage:async()=>{throw failure},onAudit:a=>audits.push(a)}),e=>e===failure)
 assert.equal(audits.length,1);assert.equal(audits[0].inventoryEvidence.reportedTotal,null);assert.equal(audits[0].outcome,'failed')
})

test('Alaan denied status retains original bytes and clocks and holds the host without retries',async()=>{
 const held=new Set(),original=page('Forbidden',{status:403}),requests=[]
 await assert.rejects(()=>run({heldHosts:held,fetchPage:async url=>{requests.push(url);return original}}),error=>{
  assert.equal(error.status,403);assert.equal(error.sourceAudit.responses[0].bodyBase64,original.bodyBase64)
  assert.equal(error.sourceAudit.responses[0].sourceCompletedAt,original.sourceCompletedAt);return failClosed(error)
 })
 assert.deepEqual(requests,[CAREERS_URL]);assert.equal(held.has('www.alaan.com'),true)
 await assert.rejects(()=>run({heldHosts:held,fetchPage:async()=>{assert.fail('held host must not be requested')}}),failClosed)
})

for(const [label,change] of [
 ['redirect',()=>page('Redirect',{status:302,headers:{location:'https://unreviewed.invalid/'}})],
 ['wrong response identity',()=>page(html,{url:'https://unreviewed.invalid/'})],
 ['unqualified MIME',()=>page(html,{headers:{'content-type':'application/json'}})],
 ['body digest contradiction',()=>page(html,{sha256:'0'.repeat(64)})],
 ['clock contradiction',()=>page(html,{sourceCompletedAt:'2026-11-06T00:00:00Z'})],
 ['decoded text contradiction',()=>page(html,{html:'different text'})],
 ['missing original body',()=>page(html,{bodyBase64:null})],
 ['hidden identity',()=>page(html.replace('<title>','<title hidden>'))],
 ['wrong publisher identity',()=>page(html.replace('Explore Careers at Alaan','Explore Careers at Another Company'))],
])test('Alaan rejects '+label+' while retaining unknown inventory',async()=>{
 await assert.rejects(()=>run({fetchPage:async()=>change()}),failClosed)
})

test('Alaan decoded-only compatibility never becomes qualified first-party inventory or native observations',async()=>{
 const jobs=await run({fetchText:async()=>html})
 assert.equal(readInventoryEvidence(jobs).firstParty,false);assert.equal(readSourceObservationEvidence(jobs,'alaan').observedRecordCount,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Alaan default HTTP adapter consumes bytes once with anonymous bounded request settings',async()=>{
 const calls=[],jobs=await run({fetchImpl:async(url,init)=>{calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const response=new Response(html,{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:CAREERS_URL});return response
 }})
 assert.deepEqual(calls,[CAREERS_URL]);assert.equal(jobs.nativeCollectionEvidence.responses[0].bodyBase64,page().bodyBase64)
})

test('Alaan ignores late transport completion after request deadline and never reports complete inventory',async()=>{
 await assert.rejects(()=>run({requestTimeoutMs:10,sourceTimeoutMs:100,fetchPage:()=>new Promise(()=>{})}),failClosed)
})

test('Alaan entity deadline cancels a hanging native body after retaining response status',async()=>{
 let cancelled=0
 await assert.rejects(()=>run({requestTimeoutMs:100,entityTimeoutMs:10,sourceTimeoutMs:200,fetchImpl:async()=>({url:CAREERS_URL,status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>{cancelled++},releaseLock(){}})}})}),error=>{assert.equal(error.sourceAudit.responses[0].status,200);return failClosed(error)})
 assert.equal(cancelled,1)
})

test('Alaan caller cancellation preserves the exact original reason',async()=>{
 const controller=new AbortController(),reason=Error('caller stopped')
 controller.abort(reason)
 await assert.rejects(()=>run({signal:controller.signal,fetchPage:async()=>{assert.fail('pre-aborted request')}}),e=>e===reason)
})

test('Alaan rejects a callback deadline rather than claiming successful processing',async()=>{
 await assert.rejects(()=>run({fetchPage:async()=>page(),callbackTimeoutMs:10,onRecords:()=>new Promise(()=>{})}),failClosed)
})

test('Alaan response byte budget rejects oversized entities without admitting their raw body',async()=>{
 await assert.rejects(()=>run({maxResponseBytes:20,fetchPage:async()=>page()}),error=>{assert.equal(error.sourceAudit.responses[0].bodyBase64,null);return failClosed(error)})
})
