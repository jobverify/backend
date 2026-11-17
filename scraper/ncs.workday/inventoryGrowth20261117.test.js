import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run} from './script.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-first-page-20261117.json.gz',import.meta.url))))
const nativeList=capture.requests.find(packet=>packet.requestedURL==='https://public.zwayam.com/jobs/search')
assert.equal(JSON.parse(Buffer.from(nativeList.bodyBase64,'base64')).data.totalCount,41)

for(const total of [41,100])test('NCS continues declared10-row pagination for '+(total===41?'the actual41-record total':'a synthetic100-record boundary'),async()=>{
 const reachedSecondPage=Object.freeze({currentNativePagination:'second-page-reached'})
 let index=0
 const fetchImpl=async(url,init={})=>{
  assert.equal(init.credentials,'omit')
  assert.equal(init.redirect,'manual')
  if(index===capture.requests.length){
   assert.equal(String(url),'https://public.zwayam.com/jobs/search')
   assert.ok(init.body instanceof FormData)
   assert.equal(JSON.parse(init.body.get('filterCri')).paginationStartNo,10)
   throw reachedSecondPage
  }
  const packet=capture.requests[index++]
  assert.equal(String(url),packet.requestedURL)
  let bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  if(total!==41&&packet===nativeList){
   const model=JSON.parse(bytes);model.data.totalCount=total;model.data.facets.Location[0].doc_count=total
   bytes=Buffer.from(JSON.stringify(model))
  }
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }
 await assert.rejects(run({fetchImpl}),error=>error===reachedSecondPage)
 assert.equal(index,7)
})

for(const total of [101,-1,41.5,'41'])test('NCS rejects unsupported native count '+JSON.stringify(total)+' before paging',async()=>{
 let index=0
 await assert.rejects(run({fetchImpl:async url=>{
  const packet=capture.requests[index++]
  assert.ok(packet);assert.equal(String(url),packet.requestedURL)
  let bytes=Buffer.from(packet.bodyBase64,'base64')
  if(packet===nativeList){const model=JSON.parse(bytes);model.data.totalCount=total;bytes=Buffer.from(JSON.stringify(model))}
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }}),/Native list count or bound changed/)
 assert.equal(index,7)
})
