import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCyfuturePublicRead} from '../../scraper/cyfuture/publicRead.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C25/capture.json.gz',import.meta.url))))
const original=fixture.cyfutureEncodingOccurrence
const sha=data=>createHash('sha256').update(data).digest('hex')
test('Cyfuture accepts the current original zstd response metadata while bounding the already decoded native HTML stream',async()=>{
 assert.equal(original.headers['content-encoding'],'zstd')
 assert.equal(sha(Buffer.from(original.body)),original.sha256)
 let calls=0
 const receipts=[],reader=createCyfuturePublicRead({minIntervalMs:0,fetchImpl:async url=>{
  calls++;assert.equal(url,original.requestedUrl)
  const response=new Response(original.body,{status:original.status,headers:original.headers})
  Object.defineProperty(response,'url',{value:original.finalUrl});return response
 }},receipts)
 try{
  const result=await reader.read(original.requestedUrl)
  assert.equal(result.receipt.rawHTML,original.body)
  assert.equal(result.receipt.bodySHA256,original.sha256)
  assert.equal(result.receipt.bodyBytes,original.bytes)
  assert.equal(calls,1)
 }finally{reader.close()}
})
