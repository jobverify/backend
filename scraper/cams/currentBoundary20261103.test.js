import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_PAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
globalThis.fetch=()=>{throw Error('Offline CAMS boundary network tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url)))),native=packets.find(row=>row.key==='careers'),page=()=>structuredClone(native)

test('CAMS registered run forwards supplied options and observes the empty client shell as unknown inventory',async()=>{
 let reads=0,audit
 const jobs=await run({fetchPage:async url=>{reads++;assert.equal(url,CAREERS_PAGE_URL);return page()},onAudit:value=>{audit=value}})
 assert.equal(reads,2);assert.equal(jobs.length,0);assert.equal(audit.observations[0].kind,'unresolved-client-rendered-careers-entry');assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('CAMS current public denial remains source local and never becomes an empty page shape',async()=>{
 let reads=0;await assert.rejects(run({fetchPage:async url=>{reads++;return{status:403,url,html:'Denied'}}}),error=>error.status===403&&error.abortRetries&&!error.abortPipeline);assert.equal(reads,1)
})

test('CAMS public TLS/transport errors preserve the original exception without fallback',async()=>{
 const reason=Object.assign(new TypeError('fetch failed'),{cause:Object.assign(Error('unable to verify leaf signature'),{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'})})
 await assert.rejects(run({fetchPage:async()=>{throw reason}}),error=>error===reason)
})

test('CAMS pre-aborted and mid-read caller cancellation preserve the exact caller reason',async()=>{
 const before=new AbortController(),first=Object.freeze({caller:'before'});before.abort(first);let calls=0
 await assert.rejects(run({signal:before.signal,fetchPage:async()=>{calls++;return page()}}),error=>error===first);assert.equal(calls,0)
 const controller=new AbortController(),reason=Object.freeze({caller:'during'}),task=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),5)
 await assert.rejects(Promise.race([task,new Promise((_,reject)=>setTimeout(()=>reject(Error('unbounded source read')),250))]),error=>error===reason)
})

test('CAMS inert app-root markup cannot qualify a current public entry',async()=>{
 const packet=page();packet.html='<!--'+packet.html+'-->'
 await assert.rejects(run({fetchPage:async()=>packet}))
})

test('CAMS ignoring audit observer is collection-bounded without private application prerequisites',async()=>{
 let called=false
 await assert.rejects(run({collectionBudgetMs:80,fetchPage:async()=>page(),onAudit:()=>{called=true;return new Promise(()=>{})}}),error=>error.code==='CAMS_COLLECTION_TIMEOUT')
 assert.equal(called,true)
})

test('CAMS owned deadline aborts a supplied signal-honoring reader while its caller remains active',async()=>{
 const caller=new AbortController();let received,aborted=false
 await assert.rejects(run({signal:caller.signal,collectionBudgetMs:30,fetchPage:(_url,request)=>{received=request.signal;return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>{aborted=true;reject(request.signal.reason)},{once:true}))}}),error=>error.code==='CAMS_COLLECTION_TIMEOUT')
 assert.equal(aborted,true);assert.equal(received.aborted,true);assert.equal(caller.signal.aborted,false)
})
