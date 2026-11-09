import assert from 'node:assert/strict'
import test from 'node:test'
import {setImmediate as flush} from 'node:timers/promises'
import {createBiofourmisScraper} from '../../scraper/biofourmis/native.js'
import {withNativeRuntimeControls} from '../native-sources/declaredGreenhouse/runtimeControls.js'

// Artificial offline resource/timing controls. No source evidence or inventory.
const outcome=p=>p.then(value=>({value}),error=>({error}))
const advance=async(t,ms)=>{t.mock.timers.tick(ms);await flush()}

test('Biofourmis physical timeout releases a real stream reader even when underlying cancel never resolves',async t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  let cancelCalls=0,fetchCalls=0,observedSignal
  const stream=new ReadableStream({
    pull(){return new Promise(()=>{})},
    cancel(){cancelCalls++;return new Promise(()=>{})}
  },{highWaterMark:0})
  const pending=outcome(createBiofourmisScraper().run({fetchImpl:async(url,{signal})=>{
    fetchCalls++;observedSignal=signal
    return{url,status:200,headers:new Headers(),body:stream}
  }}))
  await flush();assert.equal(stream.locked,true)
  await advance(t,15001)
  assert.match((await pending).error.message,/native read deadline/)
  await flush()
  assert.equal(cancelCalls,1);assert.equal(stream.locked,false)
  assert.equal(fetchCalls,1);assert.equal(observedSignal.aborted,true)
})

test('Biofourmis preserves caller abort from a real stream pull and handles the abandoned read rejection',async()=>{
  const caller=new AbortController(),reason={caller:'synchronous body pull cancellation'}
  const readerFailure=Error('Artificial underlying stream pull failure after caller cancellation')
  let pullCalls=0,fetchCalls=0
  const stream=new ReadableStream({pull(){pullCalls++;caller.abort(reason);throw readerFailure}},{highWaterMark:0})
  // Let stream start settle so the first read invokes pull synchronously.
  await flush()
  const result=await outcome(createBiofourmisScraper().run({signal:caller.signal,fetchImpl:async url=>{
    fetchCalls++;return{url,status:200,headers:new Headers(),body:stream}
  }}))
  assert.equal(result.error,reason)
  await flush();await flush()
  assert.equal(fetchCalls,1);assert.equal(pullCalls,1);assert.equal(stream.locked,false)
})

test('compound controls dispose read/audit/source timers on fulfillment, callback failure and source expiry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const pendingTimers=new Map(),schedule=globalThis.setTimeout,unschedule=globalThis.clearTimeout
  t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>{
    let id;id=schedule(()=>{pendingTimers.delete(id);fn(...args)},ms)
    pendingTimers.set(id,ms);return id
  })
  t.mock.method(globalThis,'clearTimeout',id=>{pendingTimers.delete(id);return unschedule(id)})
  const runtime=collect=>withNativeRuntimeControls({}, {}, {nativeReadTimeoutMs:120000},collect)
  assert.equal(await runtime(async(_options,controls)=>{
    await controls.read(()=>1);return controls.audit(()=>2)
  }),2)
  assert.equal(pendingTimers.size,0)
  const failure=Error('Artificial callback failure')
  assert.equal((await outcome(runtime(async(_options,controls)=>controls.read(()=>{throw failure})))).error,failure)
  assert.equal(pendingTimers.size,0)
  const source=outcome(runtime(()=>new Promise(()=>{})))
  await flush();assert.deepEqual([...pendingTimers.values()],[900000])
  await advance(t,900001)
  assert.match((await source).error.message,/source deadline/)
  assert.equal(pendingTimers.size,0)
})
