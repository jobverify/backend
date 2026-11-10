import assert from 'node:assert/strict'
import test from 'node:test'
import {boundedDeclaredPublicRead} from '../scraper-support/native-sources/boundedDeclaredPublicRead.js'

test('the public read deadline interrupts a transport that ignores its abort signal',{timeout:1000},async()=>{
 await assert.rejects(boundedDeclaredPublicRead('https://example.test/careers',{
  timeoutMs:25,fetchImpl:()=>new Promise(()=>{}),overflowError:Error('Oversized response'),
 }),error=>error.name==='TimeoutError')
})

test('the public read deadline also bounds a stalled response body',{timeout:1000},async()=>{
 let cancellations=0
 await assert.rejects(boundedDeclaredPublicRead('https://example.test/careers',{
  timeoutMs:100,overflowError:Error('Oversized response'),fetchImpl:async()=>({status:200,url:'https://example.test/careers',headers:[],
   body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancellations++},releaseLock(){}})},
  }),
 }),error=>error.name==='TimeoutError')
 assert.equal(cancellations,1)
})

test('caller cancellation remains opaque and disposes a late response',{timeout:1000},async()=>{
 const controller=new AbortController(),reason=Object.freeze({cancelled:true})
 let arrive,cancellations=0
 const operation=boundedDeclaredPublicRead('https://example.test/careers',{signal:controller.signal,timeoutMs:200,
  overflowError:Error('Oversized response'),fetchImpl:()=>new Promise(resolve=>{arrive=resolve})})
 await new Promise(resolve=>setImmediate(resolve))
 controller.abort(reason)
 await assert.rejects(operation,error=>error===reason)
 arrive({body:{cancel(){cancellations++}}})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancellations,1)
})

test('request allowances must be finite bounded positive integer milliseconds',async()=>{
 for(const timeoutMs of [0,-1,1.5,NaN,Infinity,60001,'15000']){
  await assert.rejects(boundedDeclaredPublicRead('https://example.test/careers',{timeoutMs,
   overflowError:Error('Oversized response'),fetchImpl:()=>assert.fail('Invalid deadline must reject before HTTP')}),RangeError)
 }
})
