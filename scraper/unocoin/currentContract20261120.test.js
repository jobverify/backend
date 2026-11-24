import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,FIRST_PARTY_ROOT_URL} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-contract-20261119.json.gz',import.meta.url))))
const original=fixture.packets
const canonical='https://unocoin.com/in'
test('Unocoin follows only its captured own canonical slash redirect and retains the unresolved current shell',async()=>{
 const calls=[]
 await assert.rejects(run({fetchImpl:async(url,init)=>{
  calls.push(url);assert.equal(init.redirect,'manual')
  const packet=calls.length===1?original[0]:original[1]
  assert.equal(url,calls.length===1?FIRST_PARTY_ROOT_URL:canonical)
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:url})
 }}),error=>{
  assert.equal(error.code,'UNOCOIN_COVERAGE_GAP')
  assert.ok(/Official exact employer identity missing/.test(error.message),'current shell remains unresolved')
  assert.equal(error.retainedResponses.length,2)
  assert.equal(error.retainedResponses[0].location,canonical)
  assert.equal(Object.hasOwn(error.retainedResponses[0],'body'),false)
  assert.equal(error.retainedResponses[0].redirectBodyNotConsumed,true)
  assert.equal(error.retainedResponses[0].bodyUnavailable,true)
  assert.equal(error.retainedResponses[1].finalUrl,canonical)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
  return true
 })
 assert.deepEqual(calls,[FIRST_PARTY_ROOT_URL,canonical])
})
for(const location of ['https://unocoin.com.evil.example/in','https://unocoin.com/other','http://unocoin.com/in','https://user@unocoin.com/in','/in?country=India'])test('Unocoin refuses unrelated redirect '+location,async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async url=>{reads++;return Object.defineProperty(new Response('',{status:308,headers:{location}}),'url',{value:url})}}),error=>error.code==='UNOCOIN_COVERAGE_GAP'&&error.lifecycleCleanupAllowed===false)
 assert.equal(reads,1)
})
test('Unocoin does not continue through an own canonical redirect loop',async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async url=>{reads++;return Object.defineProperty(new Response('',{status:308,headers:{location:'/in'}}),'url',{value:url})}}),error=>error.code==='UNOCOIN_COVERAGE_GAP')
 assert.equal(reads,2)
})
