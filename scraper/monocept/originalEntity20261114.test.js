import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{createCatalogScraper,getScraperCatalog}from'../../scraper-support/providers/index.js'
import{API_ORIGIN}from'./nativeContract.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-native-20261114.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(p=>p.source==='monocept'),packets=new Map(fixture.responses.map(p=>[p.url,p]))
const pinned=[...fixture.clientURLs,...fixture.responses.filter(p=>new URL(p.url).pathname.endsWith('.css')).map(p=>p.url)]
function transport(changedURL,kind='response'){
 const calls=[]
 return{calls,fetchImpl:async(url)=>{
  calls.push(url);const packet=packets.get(url),token=url===API_ORIGIN+'/api/token/noauth'
  assert.ok(packet||token,'Unrecorded request '+url)
  const text=token?JSON.stringify({access_token:'synthetic-hermetic-anonymous-guest-token',token_type:'Bearer',expires_in:3600,ShouldRedirect:false}):packet.body
  const original=Buffer.from(text),bytes=url===changedURL?Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),original]):original
  if(kind==='literal')return{status:200,url,contentType:packet?.contentType||'application/json',body:text}
  if(kind==='receipt')return{status:200,url,contentType:packet?.contentType||'application/json',body:text,rawBodyBase64:bytes.toString('base64')}
  const response=new Response(bytes,{status:200,headers:{'content-type':packet?.contentType||'application/json'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}
}
const run=(io,options={})=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,requestIntervalMs:0,now:()=>fixture.capturedAt,...options})
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected network in original entity tests')}))

test('actual Response text decoding would erase a changed entity BOM',async()=>{
 const packet=packets.get(fixture.clientURLs[0]),bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(packet.body)])
 assert.equal(await new Response(bytes).text(),packet.body);assert.notEqual(bytes.length,packet.bytes)
})

for(const url of pinned)test('pinned original JS or CSS entity rejects UTF8 BOM before decoded hash: '+new URL(url).pathname,async()=>{
 const io=transport(url)
 await assert.rejects(run(io),/original.*entity.*(?:hash|bytes)|unreviewed.*(?:client|CSS).*bytes/i)
 assert.equal(io.calls.at(-1),url)
 assert.equal(io.calls.some(u=>u.startsWith(API_ORIGIN)),false)
})

test('unchanged actual Response entities retain six complete India roles and one PDF hold',async()=>{
 const io=transport(),jobs=await run(io);assert.equal(jobs.length,6);assert.equal(io.calls.length,73)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleClosingReconciled&&j.lifecycleCleanupAllowed===false))
 assert.equal(jobs[0].nativeCollectionEvidence.unresolvedRecords,1)
})

test('literal fixture entities preserve the existing full metadata injection contract',async()=>{
 const io=transport(undefined,'literal'),jobs=await run(io);assert.equal(jobs.length,6);assert.equal(io.calls.length,73)
})

test('original receipt adapters retain six complete native roles',async()=>{
 const io=transport(undefined,'receipt'),jobs=await run(io);assert.equal(jobs.length,6);assert.equal(io.calls.length,73)
})

for(const url of[pinned[0],pinned.at(-1)])test('original receipt rejects a BOM even with the unchanged decoded literal: '+new URL(url).pathname,async()=>{
 const io=transport(url,'receipt');await assert.rejects(run(io),/original pinned entity hash changed/);assert.equal(io.calls.at(-1),url)
})

test('a pinned decoded-text-only reader cannot erase original entity authority',async()=>{
 const url=pinned[0],io=transport();let decodedRead=false
 await assert.rejects(run({...io,fetchImpl:async(requested,init)=>{const response=await io.fetchImpl(requested,init);if(requested!==url)return response;return{status:200,url,contentType:'application/javascript',text:async()=>{decodedRead=true;return packets.get(url).body}}}}),/original pinned entity bytes unavailable/)
 assert.equal(decodedRead,false);assert.equal(io.calls.at(-1),url)
})

test('original-byte body reading preserves opaque cancellation and starts no later reads',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'body-cancel'}),io=transport(),url=fixture.clientURLs[0]
 let entered,release;const ready=new Promise(resolve=>entered=resolve)
 const pending=run({...io,fetchImpl:async(requested,init)=>{const response=await io.fetchImpl(requested,init);if(requested===url){const original=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{entered();await new Promise(resolve=>release=resolve);return original()}}return response}},{signal:controller.signal}).then(value=>({value}),error=>({error}))
 await ready;controller.abort(reason);const result=await pending;release();assert.equal(result.error,reason)
 const count=io.calls.length;await new Promise(resolve=>setImmediate(resolve));assert.equal(io.calls.length,count)
})
