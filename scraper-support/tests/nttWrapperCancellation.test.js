import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from '../../scraper/nttdataservices/script.js'
test('NTT wrapper rejects cancellation before any cached-page fetch',async()=>{
 let calls=0;const reason=new Error('Source cancelled')
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:async()=>{calls++;return ''}}),error=>error===reason)
 assert.equal(calls,0)
})
test('NTT wrapper forwards cancellation and stops before page validation',async()=>{
 const controller=new AbortController(),reason=new Error('Source cancelled');let calls=0
 await assert.rejects(run({signal:controller.signal,fetchText:async(url,options)=>{
  calls++;assert.equal(options?.signal,controller.signal);controller.abort(reason);return ''
 }}),error=>error===reason);assert.equal(calls,1)
})
test('NTT default transport respects cancellation while consuming the body',async()=>{
 const original=globalThis.fetch,controller=new AbortController(),reason=new Error('Source cancelled')
 globalThis.fetch=async(url,options)=>{assert.ok(options?.signal);return {ok:true,text:async()=>{controller.abort(reason);return ''}}}
 try{await assert.rejects(run({signal:controller.signal}),error=>error===reason)}finally{globalThis.fetch=original}
})
