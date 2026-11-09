import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {resolveScraperTimeoutMs,resolveSourceLifecycleTimeoutMs,runScraperWithTimeout} from '../../scraper-support/runner.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const registered=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='movate'))
const replay=(t,change=()=>({}))=>{
 const calls=[],seen=new Map()
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),row=capture.packets.find(r=>r.requestUrl===url)
  assert.ok(row,'No implicit public network: '+url)
  const count=(seen.get(url)??0)+1;seen.set(url,count);calls.push({url,signal:init.signal})
  const control=change(url,count,init)??{}
  const response=new Response(control.body??row.body,{status:control.status??row.status,headers:{'content-type':row.contentType}})
  Object.defineProperty(response,'url',{value:row.url});return response
 })
 return calls
}
test('Registered Movate production path allows the measured full collection within its native, runner and lifecycle budgets',async t=>{
 const scraper=registered(),deadlines=[],original=AbortSignal.timeout.bind(AbortSignal)
 assert.equal(resolveScraperTimeoutMs(null,scraper,null),300000)
 assert.equal(resolveSourceLifecycleTimeoutMs(null,scraper),1800000)
 t.mock.method(AbortSignal,'timeout',ms=>{deadlines.push(ms);return original(ms)})
 const calls=replay(t)
 const jobs=await runScraperWithTimeout(scraper,resolveScraperTimeoutMs(null,scraper,null),{nativeDetailRecovery:false})
 assert.equal(jobs.length,610);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.ok(deadlines.includes(180000),'The source itself allows three minutes, above the measured 120799 ms collection')
 assert.equal(calls.length,130);assert.ok(calls.every(call=>call.signal instanceof AbortSignal))
})
test('Registered Movate preserves caller cancellation during native pagination and returns no partial array',async t=>{
 const controller=new AbortController(),reason=Object.freeze({nativeMovateCallerAbort:true})
 const calls=replay(t,url=>{if(url.includes('job_page=2'))controller.abort(reason)})
 await assert.rejects(runScraperWithTimeout(registered(),300000,{signal:controller.signal,abortGraceMs:100,nativeDetailRecovery:false}),error=>error===reason)
 assert.equal(calls.filter(call=>call.url.includes('job_page=2')).length,1)
 assert.equal(calls.some(call=>call.url.includes('job_page=3')),false)
})
test('Registered Movate rejects a failed closing pagination page after observing the full opening inventory',async t=>{
 const calls=replay(t,(url,count)=>url.includes('job_page=40')&&count===2?{status:500}:{})
 await assert.rejects(runScraperWithTimeout(registered(),300000,{nativeDetailRecovery:false}),error=>error.softFailure===true&&/HTTP|status/i.test(error.message))
 assert.ok(calls.some(call=>call.url.includes('job_page=61')),'Opening inventory completed')
 assert.equal(calls.filter(call=>call.url.includes('job_page=41')).length,1,'Closing requests stop at the failed page')
})
