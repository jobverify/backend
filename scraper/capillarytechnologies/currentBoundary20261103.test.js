import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {run,createCapillaryTechnologiesScraper,CAREER_PAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
globalThis.fetch=async()=>{throw Error('Offline boundary tests prohibit unrecorded network')}
const body=gunzipSync(await fs.readFile(new URL('./test-data/current-20261103/careers-denied.html.gz',import.meta.url))).toString('utf8')
const pending='<html><head><title>Careers - Capillary Technologies</title></head><body><main><h1>Careers</h1><p>We are currently hand-crafting a brand-new careers experience. We will be live soon.</p></main></body></html>'
const page=(status=200,html=pending)=>({status,url:CAREER_PAGE_URL,html})

for(const status of[401,403,429])test('Capillary '+status+' is a typed source-local denial rather than a successful empty array',async()=>{
 let calls=0
 await assert.rejects(createCapillaryTechnologiesScraper().run({fetchPage:async()=>{calls++;return page(status,body)}}),error=>error.status===status&&error.failureKind==='blocked'&&error.abortRetries&&!error.abortPipeline&&!error.isPipelineFatal)
 assert.equal(calls,1)
})

test('Capillary registered run forwards supplied source options without unrecorded requests',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Test prohibits unrecorded network')}
 let calls=0
 try{await assert.rejects(run({fetchPage:async()=>{calls++;return page(403,body)}}),error=>error.status===403);assert.equal(calls,1)}finally{globalThis.fetch=original}
})

test('Capillary pending hiring entry remains unknown inventory after closing verification',async()=>{
 let calls=0,audit
 const jobs=await run({fetchPage:async()=>{calls++;return page()},onAudit:value=>{audit=value}})
 const evidence=readInventoryEvidence(jobs)
 assert.equal(calls,2)
 assert.equal(jobs.length,0)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
})

test('Capillary cancellation preserves the exact caller reason before any read',async()=>{
 const reason=Object.freeze({caller:'cancel'}),controller=new AbortController();controller.abort(reason)
 let calls=0
 await assert.rejects(createCapillaryTechnologiesScraper().run({signal:controller.signal,fetchPage:async()=>{calls++;return page()}}),error=>error===reason)
 assert.equal(calls,0)
})

test('Capillary reader and observer waits are bounded by the collection deadline',{timeout:1000},async()=>{
 await assert.rejects(createCapillaryTechnologiesScraper().run({collectionBudgetMs:15,fetchPage:()=>new Promise(()=>{})}),error=>error.code==='CAPILLARY_COLLECTION_TIMEOUT')
 await assert.rejects(createCapillaryTechnologiesScraper().run({collectionBudgetMs:15,fetchPage:async()=>page(),onAudit:()=>new Promise(()=>{})}),error=>error.code==='CAPILLARY_COLLECTION_TIMEOUT')
})

test('Capillary default response-body wait is bounded without an external caller signal',async()=>{
 await assert.rejects(run({collectionBudgetMs:15,fetchImpl:async()=>({status:200,url:CAREER_PAGE_URL,text:()=>new Promise(()=>{})})}),error=>error.code==='CAPILLARY_COLLECTION_TIMEOUT')
})

test('Capillary supplied reader signals settle without aborting the caller',async()=>{
 const controller=new AbortController(),requests=[]
 await createCapillaryTechnologiesScraper({fetchPage:async(_url,request)=>{requests.push(request);return page()}}).run({signal:controller.signal})
 assert.equal(requests.length,2)
 assert.ok(requests.every(request=>request.signal!==controller.signal&&request.signal.aborted))
 assert.equal(controller.signal.aborted,false)
})

test('Capillary comments cannot supply a current pending hiring state',async()=>{
 const html=pending.replace('<p>','<!-- <p>').replace('</p>','</p> -->')
 await assert.rejects(run({fetchPage:async()=>page(200,html)}),error=>error.code==='CAPILLARY_PUBLIC_SURFACE_CHANGED')
})

for(const [name,status,url]of[['redirect',302,CAREER_PAGE_URL],['server-error',500,CAREER_PAGE_URL],['changed-url',200,'https://www.capillarytech.com/other/']])test('Capillary '+name+' rejection cancels the body and settles its request signal',async()=>{
 let cancelled=0,requestSignal
 await assert.rejects(run({fetchImpl:async(_url,request)=>{requestSignal=request.signal;return{status,url,body:{cancel:async()=>{cancelled++}},text:async()=>pending}}}),error=>error.code==='CAPILLARY_PUBLIC_SURFACE_CHANGED')
 assert.equal(cancelled,1)
 assert.equal(requestSignal.aborted,true)
})
test('Capillary supplied reader receives its collection deadline with an external caller',{timeout:1000},async()=>{
 const caller=new AbortController();let transportSignal
 await assert.rejects(run({signal:caller.signal,collectionBudgetMs:20,fetchPage:async(url,request)=>{transportSignal=request.signal;return new Promise(()=>{})}}),e=>e.code==='CAPILLARY_COLLECTION_TIMEOUT')
 assert.equal(transportSignal.aborted,true);assert.equal(caller.signal.aborted,false)
})
test('Capillary supplied transport cancellation retains the original opaque caller reason',async()=>{
 const caller=new AbortController(),reason=Object.freeze({cancelled:'supplied-reader'});let transportSignal
 await assert.rejects(run({signal:caller.signal,fetchPage:async(url,request)=>{transportSignal=request.signal;caller.abort(reason);return new Promise(()=>{})}}),e=>e===reason)
 assert.equal(transportSignal.aborted,true);assert.equal(transportSignal.reason,reason)
})
