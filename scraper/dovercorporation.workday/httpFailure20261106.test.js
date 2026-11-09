import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {CAREERS} from './nativeContract.js'

test('Dover retains the actual corporate denial status and request identity and makes no native fallback reads',async()=>{
 const reads=[]
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>{
  reads.push(url)
  const response=new Response('<title>Web Application Firewall</title><p>The request was blocked by Security Policies</p>',{status:403,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:CAREERS})
  return response
 }}),error=>{
  assert.equal(error.status,403)
  assert.equal(error.requestUrl,CAREERS)
  assert.equal(error.finalUrl,CAREERS)
  assert.equal(error.abortRetries,true)
  assert.match(error.message,/HTTP 403/)
  return true
 })
 assert.deepEqual(reads,[CAREERS])
})

test('Dover still rejects a successful response attributed to a different employer URL',async()=>{
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async()=>{
  const response=new Response('<title>Dover</title>',{headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:'https://unrelated.example/careers'})
  return response
 }}),/final URL identity/)
})

test('Dover retains retryable upstream status without turning it into a permanent access denial',async()=>{
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async()=>{
  const response=new Response('Temporarily unavailable',{status:503,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:CAREERS})
  return response
 }}),error=>{
  assert.equal(error.status,503)
  assert.notEqual(error.abortRetries,true)
  return true
 })
})
