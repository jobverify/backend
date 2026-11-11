import assert from 'node:assert/strict'
import test from 'node:test'
import {getEventListeners} from 'node:events'
import {createTripcomScraper} from '../scraper/tripcom/nativeInventory.js'
import {runNativeKeka} from '../scraper/acciojob/nativeKeka.js'
import accio from '../scraper/acciojob/nativeConfig.js'
import open from '../scraper/openfinancialtechnologies/nativeConfig.js'

// Authored first-response lifecycle controls, never native body/scope facts.
// Deliberately invalid positive-control text reaches the unchanged native
// fail-closed guards; no successful inventory or source recovery is asserted.
const apis=[['Trip.com',options=>createTripcomScraper().run(options),'TRIPCOM_NATIVE_CONTRACT'],
  ['archival Acciojob',options=>runNativeKeka(accio,options),'ACCIO_OPEN_NATIVE_CONTRACT'],
  ['archival Open',options=>runNativeKeka(open,options),'ACCIO_OPEN_NATIVE_CONTRACT']]
const reasons=[['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['frozen',()=>Object.freeze(Error('Authored caller'))],['default',()=>AbortSignal.abort().reason],
  ['network',()=>Object.assign(Error('Authored caller'),{code:'ECONNRESET'})],
  ['frozen-network',()=>Object.freeze(Object.assign(Error('Authored caller'),{code:'ECONNRESET'}))]]
const primaries=[['undefined',()=>undefined],['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['symbol',()=>Symbol('Authored primary')],['frozen',()=>Object.freeze(Error('Authored ordinary body primary'))],
  ['mutable',()=>Error('Authored ordinary body primary')]]
const base={now:'2026-11-11T00:00:00.000Z',requestIntervalMs:0,timeoutMs:1000}
const outcome=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const deferred=()=>{let reject;const promise=new Promise((_,no)=>{reject=no});return {promise,reject}}
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const timers=()=>process.getActiveResourcesInfo().filter(kind=>kind==='Timeout').length
const shape=value=>value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptors(value):null
const exact=(result,reason)=>{assert.equal(result.ok,false);assert.ok(Object.is(result.reason,reason),'Original reason identity changed')}
async function clean(caller,transport,count){
  await turn();await turn()
  assert.equal(getEventListeners(caller.signal,'abort').length,0)
  assert.equal(getEventListeners(transport,'abort').length,0)
  assert.equal(timers(),count)
}
for(const [api,run]of apis)for(const [kind,make]of reasons)for(const disposition of ['returns-method','throws'])test(`${api} text getter abort ${kind} then ${disposition} stops body admission`,async()=>{
  const caller=new AbortController(),reason=make(),before=shape(reason),count=timers(),replacement=Object.freeze(Error('Authored getter replacement'))
  let fetches=0,getters=0,bodies=0,transport
  const result=await outcome(run({...base,signal:caller.signal,fetchImpl(url,init){
    fetches++;transport=init.signal
    const response={status:200,url,headers:{get:()=> 'text/html'}}
    Object.defineProperty(response,'text',{get(){
      getters++;caller.abort(reason)
      if(disposition==='throws')throw replacement
      return function(){bodies++;return Promise.resolve('Unused authored bytes')}
    }})
    return response
  }}))
  exact(result,reason);assert.deepEqual(shape(reason),before)
  assert.equal(fetches,1);assert.equal(getters,1);assert.equal(bodies,0,'A function returned after getter cancellation must not run')
  await clean(caller,transport,count)
})
for(const [api,run]of apis)for(const [kind,make]of reasons)for(const rejection of ['already-rejected','late-rejected'])test(`${api} body self-abort ${kind} owns ${rejection} producer`,async()=>{
  const caller=new AbortController(),reason=make(),before=shape(reason),count=timers(),late=deferred(),replacement=Object.freeze(Error('Authored rejected body producer'))
  let fetches=0,getters=0,bodies=0,receiverExact=false,transport
  const result=await outcome(run({...base,signal:caller.signal,fetchImpl(url,init){
    fetches++;transport=init.signal
    const response={status:200,url,headers:{get:()=> 'text/html'}}
    Object.defineProperty(response,'text',{get(){getters++;return function(){
      bodies++;receiverExact=this===response;caller.abort(reason)
      return rejection==='already-rejected'?Promise.reject(replacement):late.promise
    }}})
    return response
  }}))
  if(rejection==='late-rejected')late.reject(replacement)
  else late.promise.catch(()=>{}) // Test-owned unused deferred, not a source producer.
  exact(result,reason);assert.deepEqual(shape(reason),before)
  assert.equal(fetches,1);assert.equal(getters,1);assert.equal(bodies,1);assert.equal(receiverExact,true)
  await clean(caller,transport,count)
})
for(const [api,run,code]of apis)for(const kind of ['value','promise','thenable'])test(`${api} normal ${kind} body retains one getter, receiver and native hold`,async()=>{
  const caller=new AbortController(),count=timers(),invalid='Authored intentionally invalid first-response text'
  let fetches=0,getters=0,bodies=0,assimilations=0,receiverExact=false,transport
  const result=await outcome(run({...base,signal:caller.signal,fetchImpl(url,init){
    fetches++;transport=init.signal
    const response={status:200,url,headers:{get:()=> 'text/html'}}
    Object.defineProperty(response,'text',{get(){getters++;return function(){
      bodies++;receiverExact=this===response
      if(kind==='promise')return Promise.resolve(invalid)
      if(kind==='thenable'){
        const value={then(resolve){assimilations++;assert.equal(this,value);resolve(invalid)}}
        return value
      }
      return invalid
    }}})
    return response
  }}))
  assert.equal(result.ok,false);assert.equal(result.reason.code,code)
  assert.match(result.reason.message,/missing current public translations|corporate delegation\/handoff changed/)
  assert.equal(fetches,1);assert.equal(getters,1);assert.equal(bodies,1);assert.equal(receiverExact,true)
  assert.equal(assimilations,kind==='thenable'?1:0);assert.equal(caller.signal.aborted,false)
  await clean(caller,transport,count)
})
for(const [api,run]of apis)for(const [kind,make]of primaries)for(const stage of ['getter','method-throw','method-reject'])test(`${api} ordinary ${kind} ${stage} primary stays exact`,async()=>{
  const caller=new AbortController(),primary=make(),count=timers()
  let fetches=0,getters=0,bodies=0,transport,receiverExact=false
  const result=await outcome(run({...base,signal:caller.signal,fetchImpl(url,init){
    fetches++;transport=init.signal
    const response={status:200,url,headers:{get:()=> 'text/html'}}
    Object.defineProperty(response,'text',{get(){
      getters++;if(stage==='getter')throw primary
      return function(){bodies++;receiverExact=this===response;if(stage==='method-throw')throw primary;return Promise.reject(primary)}
    }})
    return response
  }}))
  exact(result,primary);assert.equal(fetches,1);assert.equal(getters,1);assert.equal(bodies,stage==='getter'?0:1)
  if(stage!=='getter')assert.equal(receiverExact,true)
  if(api==='Trip.com'&&kind==='mutable')assert.equal(primary.abortRetries,true,'Established optional retry metadata remains')
  assert.equal(caller.signal.aborted,false);await clean(caller,transport,count)
})
for(const [api,run]of apis)for(const [kind,value]of [['undefined',undefined],['null',null],['false',false],['object',Object.freeze({})]])test(`${api} noncallable ${kind} text value keeps TypeError behavior`,async()=>{
  const caller=new AbortController(),count=timers();let getters=0,fetches=0,transport
  const result=await outcome(run({...base,signal:caller.signal,fetchImpl(url,init){
    fetches++;transport=init.signal;const response={status:200,url,headers:{get:()=> 'text/html'}}
    Object.defineProperty(response,'text',{get(){getters++;return value}});return response
  }}))
  assert.equal(result.ok,false);assert.ok(result.reason instanceof TypeError)
  assert.equal(fetches,1);assert.equal(getters,1);assert.equal(caller.signal.aborted,false)
  await clean(caller,transport,count)
})
