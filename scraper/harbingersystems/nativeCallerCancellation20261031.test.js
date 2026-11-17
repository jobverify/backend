import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'

const CAREERS='https://www.harbingergroup.com/current-openings/'
const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const source=getScraperCatalog().find(row=>row.source==='harbingersystems')
const run=options=>createCatalogScraper(source).run(options)
const caller=label=>({controller:new AbortController(),reason:Object.freeze({opaque:true,label})})
function original(url){
 const r=captures.find(row=>row.requestedUrl===url&&(url===CAREERS||row.captureName==='harbingersystems-board.json'||!url.endsWith('/careers/home')))
 assert.ok(r,'Unbound original URL '+url)
 const value=new Response(Buffer.from(r.bodyBase64,'base64'),{status:r.status,headers:r.headers});Object.defineProperty(value,'url',{value:r.url});return value
}
test('registered Harbinger pre-cancellation preserves the frozen reason before callbacks or native reads',async()=>{
 const {controller,reason}=caller('Harbinger pre-cancellation');controller.abort(reason);let reads=0
 await assert.rejects(run({signal:controller.signal,fetchText:async()=>{reads++},fetchListingPage:async()=>{reads++},fetchImpl:async()=>{reads++}}),error=>error===reason)
 assert.equal(reads,0)
})
test('registered default HTTP pre-cancellation starts no native fetch',async t=>{
 const {controller,reason}=caller('Harbinger default pre-cancellation');controller.abort(reason);let reads=0
 t.mock.method(globalThis,'fetch',async()=>{reads++;throw Error('Unexpected HTTP')})
 await assert.rejects(run({signal:controller.signal}),error=>error===reason);assert.equal(reads,0)
})
for(const mode of ['fulfilled','rejected'])test('exact caller cancellation survives a native header read '+mode,async()=>{
 const {controller,reason}=caller('Harbinger header '+mode);let receivedSignal,reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async(url,init)=>{
  reads++;assert.equal(url,CAREERS);receivedSignal=init.signal;controller.abort(reason)
  if(mode==='rejected')throw Object.freeze(Error('Replacement native error'))
  return original(url)
 }}),error=>error===reason)
 assert.equal(reads,1);assert.equal(receivedSignal.aborted,true);assert.equal(receivedSignal.reason,reason)
})
test('default HTTP preserves caller cancellation through a replacement transport error',async t=>{
 const {controller,reason}=caller('Harbinger default HTTP cancellation');let reads=0
 t.mock.method(globalThis,'fetch',async()=>{reads++;controller.abort(reason);throw Object.freeze(Error('Replacement default HTTP error'))})
 await assert.rejects(run({signal:controller.signal}),error=>error===reason);assert.equal(reads,1)
})
test('native response-body cancellation cannot become a source result or audit-decoration error',async()=>{
 const {controller,reason}=caller('Harbinger body cancellation');let bodyReads=0,fetches=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{
  fetches++;const value=original(url)
  Object.defineProperty(value,'body',{value:{getReader(){return{async read(){bodyReads++;controller.abort(reason);return{done:false,value:Buffer.from('unbound body')}},async cancel(){},releaseLock(){}}}}})
  return value
 }}),error=>error===reason)
 assert.equal(fetches,1);assert.equal(bodyReads,1)
})
test('cancellation during the declared board read stops before the current client/config stage',async()=>{
 const {controller,reason}=caller('Harbinger board cancellation');let reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{reads++;if(reads===2){controller.abort(reason);throw Error('Replacement board error')}return original(url)}}),error=>error===reason)
 assert.equal(reads,2)
})
test('an ordinary frozen native transport failure stays the original error',async()=>{
 const reason=Object.freeze(Error('Ordinary frozen Harbinger transport error'))
 await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>error===reason)
})
test('missing caller signal retains the actual original native employer-config403 blocker',async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async url=>{reads++;return original(url)}}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied'&&error.lifecycleCleanupAllowed===false)
 assert.equal(reads,4)
})
