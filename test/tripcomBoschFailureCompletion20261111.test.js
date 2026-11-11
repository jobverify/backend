import assert from 'node:assert/strict'
import test from 'node:test'
import {getEventListeners} from 'node:events'
import {createTripcomScraper} from '../scraper/tripcom/script.js'
import {createBoschGlobalSoftwareTechnologiesScraper,run as runBosch,buildSearchUrl,buildDetailUrl,
  BOSCH_GLOBAL_SOFTWARE_TECHNOLOGIES_LEGAL_ENTITY_ID as legalEntity} from '../scraper/boschglobalsoftwaretechnologies/script.js'

// Authored lifecycle protocols only, never native capture/inventory evidence.
// Controlled listing rows merely admit the existing six-worker detail path.
const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const outcomeBeforeRelease=async promise=>{
  let timer
  try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),100)})])}
  finally{clearTimeout(timer)}
}
const exact=(outcome,reason)=>{
  assert.equal(outcome.pending,undefined,'Source must settle without the unavailable operation being manually released')
  assert.equal(outcome.ok,false)
  assert.ok(Object.is(outcome.reason,reason),'Original failure/caller identity must remain exact')
}
const shape=value=>value!==null&&(typeof value==='object'||typeof value==='function')?Object.getOwnPropertyDescriptors(value):null
const unchanged=(value,before)=>assert.deepEqual(shape(value),before)
const primaries=[['undefined',()=>undefined],['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['symbol',()=>Symbol('Authored ordinary primary')],['frozen',()=>Object.freeze(Error('Authored frozen ordinary primary'))],
  ['sealed',()=>Object.seal(Error('Authored sealed ordinary primary'))]]
const callers=[['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['frozen',()=>Object.freeze(Error('Authored caller'))],['default',()=>AbortSignal.abort().reason],
  ['mutable-network',()=>Object.assign(Error('Authored caller'),{code:'ECONNRESET'})],
  ['frozen-network',()=>Object.freeze(Object.assign(Error('Authored caller'),{code:'ECONNRESET'}))],
  ['symbol',()=>Symbol('Authored caller')],
  ['opaque',()=>Object.freeze(Object.defineProperty({},'message',{get(){throw Error('Caller reason must remain opaque')}}))]]
const trip=fetchImpl=>createTripcomScraper().run({now:'2026-11-11T00:00:00.000Z',requestIntervalMs:0,timeoutMs:12345,fetchImpl})
for(const [label,make]of primaries)for(const stage of ['sync-transport','async-transport','body'])test(`Trip.com ordinary ${label} at ${stage} survives optional annotation`,async()=>{
  const primary=make(),before=shape(primary)
  let calls=0,bodies=0
  const outcome=await reflect(trip(()=>{
    calls++
    if(stage==='sync-transport')throw primary
    if(stage==='async-transport')return Promise.reject(primary)
    return {status:200,text(){bodies++;return Promise.reject(primary)}}
  }))
  exact(outcome,primary);unchanged(primary,before)
  assert.equal(calls,1);assert.equal(bodies,stage==='body'?1:0)
})
for(const kind of ['read-only-data','getter-only','throwing-setter','throwing-proxy'])test(`Trip.com ${kind} retry annotation cannot replace the ordinary primary`,async()=>{
  const primary=Error('Authored ordinary primary'),annotation=Object.freeze(TypeError('Authored annotation error'))
  let writes=0
  if(kind==='read-only-data')Object.defineProperty(primary,'abortRetries',{value:false,writable:false})
  if(kind==='getter-only')Object.defineProperty(primary,'abortRetries',{get:()=>false})
  if(kind==='throwing-setter')Object.defineProperty(primary,'abortRetries',{set(){writes++;throw annotation}})
  const failure=kind==='throwing-proxy'?new Proxy(primary,{set(){writes++;throw annotation}}):primary
  const before=shape(failure),outcome=await reflect(trip(()=>{throw failure}))
  exact(outcome,failure);unchanged(failure,before)
  assert.equal(writes,kind.startsWith('throwing')?1:0)
})
for(const kind of ['mutable-error','function'])test(`Trip.com ${kind} retains established retry annotation when writable`,async()=>{
  const primary=kind==='function'?function authoredPrimary(){}:Object.assign(Error('Authored ordinary error'),{code:'ECONNRESET'})
  exact(await reflect(trip(()=>{throw primary})),primary)
  assert.equal(primary.abortRetries,true)
})
for(const [label,make]of callers)for(const setter of ['returns','throws'])test(`Trip.com caller ${label} raised during annotation ${setter} wins exactly`,async()=>{
  const caller=new AbortController(),reason=make(),before=shape(reason),primary=Error('Authored ordinary primary')
  const annotation=Object.freeze(TypeError('Authored annotation replacement'))
  let writes=0
  Object.defineProperty(primary,'abortRetries',{set(){writes++;caller.abort(reason);if(setter==='throws')throw annotation}})
  const outcome=await reflect(createTripcomScraper().run({signal:caller.signal,now:'2026-11-11T00:00:00.000Z',
    timeoutMs:12345,requestIntervalMs:0,fetchImpl(){throw primary}}))
  exact(outcome,reason);unchanged(reason,before);assert.equal(writes,1)
  await turn();assert.equal(getEventListeners(caller.signal,'abort').length,0)
})

const rows=()=>Array.from({length:18},(_,index)=>({refNumber:'AUTHORED-COMPLETION-'+index,name:'Authored lifecycle route',
  jobUrl:'AUTHORED-COMPLETION-'+index,legal_entity:{valueId:legalEntity},location:{country:'in',city:'Authored'}}))
const listingPayload=listings=>({_embedded:{'rh:result':[{meta:[{count:listings.length}],data:listings}]}})
const boschAPIs=[['factory',options=>createBoschGlobalSoftwareTechnologiesScraper().run(options)],['public',runBosch]]
for(const [api,run]of boschAPIs)for(const [label,make]of callers)test(`Bosch ${api} releases unavailable listing for ${label} before physical completion`,async()=>{
  const caller=new AbortController(),reason=make(),before=shape(reason),started=deferred(),late=deferred(),signals=[]
  let calls=0
  const pending=reflect(run({signal:caller.signal,fetchJson(_url,{signal}){calls++;signals.push(signal);started.resolve();return late.promise}}))
  await started.promise;caller.abort(reason)
  const early=await outcomeBeforeRelease(pending)
  late.reject(Object.freeze(Error('Authored late listing rejection')))
  await pending;await turn();await turn()
  exact(early,reason);unchanged(reason,before);assert.equal(calls,1)
  assert.ok(signals.every(signal=>signal===caller.signal),'Physical fetchJson must retain the caller signal object')
  assert.equal(getEventListeners(caller.signal,'abort').length,0)
})
for(const [label,make]of callers)test(`Bosch queued listing ${label} is never admitted after cancellation`,async()=>{
  const caller=new AbortController(),reason=make(),before=shape(reason),late=deferred()
  let calls=0
  const pending=reflect(runBosch({signal:caller.signal,fetchJson(){calls++;return late.promise}}))
  caller.abort(reason)
  const early=await outcomeBeforeRelease(pending)
  late.reject(Object.freeze(Error('Unused or late listing rejection')))
  // If queued work was correctly refused, this independently created promise
  // has no producer consumer. Observe the test-owned boundary as well.
  await late.promise.catch(()=>{})
  await pending;await turn()
  exact(early,reason);unchanged(reason,before);assert.equal(calls,0)
  assert.equal(getEventListeners(caller.signal,'abort').length,0)
})
for(const [label,make]of callers)test(`Bosch six unavailable details release for ${label} and stop queued records`,async()=>{
  const caller=new AbortController(),reason=make(),before=shape(reason),listings=rows(),started=deferred(),late=[],signals=[]
  let details=0,physical=0,maximum=0
  const pending=reflect(runBosch({signal:caller.signal,fetchJson(url,{signal}){
    signals.push(signal)
    if(url===buildSearchUrl())return Promise.resolve(listingPayload(listings))
    assert.equal(url,buildDetailUrl(listings[details].refNumber))
    details++;physical++;maximum=Math.max(maximum,physical)
    const operation=deferred();late.push(operation)
    if(details===6)started.resolve()
    return operation.promise
  }}))
  await started.promise;caller.abort(reason)
  const early=await outcomeBeforeRelease(pending),physicalAtLogicalCompletion=physical
  for(const operation of late){physical--;operation.reject(Object.freeze(Error('Authored late detail rejection')))}
  await pending;await turn();await turn()
  exact(early,reason);unchanged(reason,before)
  assert.equal(details,6);assert.equal(maximum,6);assert.equal(physicalAtLogicalCompletion,6);assert.equal(physical,0)
  assert.ok(signals.every(signal=>signal===caller.signal),'Physical request signal cannot be replaced by an internal group signal')
  assert.equal(getEventListeners(caller.signal,'abort').length,0)
})
for(const [label,make]of primaries)for(const lateMode of ['fulfills','rejects'])test(`Bosch first ordinary ${label} releases stalled peers that later ${lateMode}`,async()=>{
  const primary=make(),before=shape(primary),listings=rows(),late=[]
  let details=0,physical=0,maximum=0
  const pending=reflect(runBosch({fetchJson(url,{signal}){
    assert.equal(signal,null,'No caller means the physical request keeps its original null signal')
    if(url===buildSearchUrl())return Promise.resolve(listingPayload(listings))
    details++;physical++;maximum=Math.max(maximum,physical)
    if(details===1){physical--;return Promise.reject(primary)}
    const operation=deferred();late.push(operation);return operation.promise
  }}))
  await turn()
  const early=await outcomeBeforeRelease(pending),physicalAtLogicalCompletion=physical
  for(const operation of late){physical--;if(lateMode==='rejects')operation.reject(Object.freeze(Error('Authored later replacement')));else operation.resolve([])}
  await pending;await turn();await turn()
  exact(early,primary);unchanged(primary,before)
  assert.equal(details,6);assert.equal(maximum,5);assert.equal(physicalAtLogicalCompletion,5);assert.equal(physical,0)
})
test('Bosch caller cancellation after the ordinary failure turn wins while stalled peers release',async()=>{
  const caller=new AbortController(),reason=Object.freeze(Error('Authored caller winner')),primary=Object.freeze(Error('Authored first detail')),
    listings=rows(),late=[]
  let details=0
  const pending=reflect(runBosch({signal:caller.signal,fetchJson(url){
    if(url===buildSearchUrl())return Promise.resolve(listingPayload(listings))
    details++
    if(details===1)return Promise.reject(primary)
    const operation=deferred();late.push(operation)
    return operation.promise
  }}))
  // This turn is registered before request admission. Its continuation runs
  // after the primary rejection microtasks and before the queued peer release.
  await turn();assert.equal(details,6);caller.abort(reason)
  const early=await outcomeBeforeRelease(pending)
  late.forEach(operation=>operation.reject(Object.freeze(Error('Authored late peer'))))
  await pending;await turn();exact(early,reason);assert.equal(details,6)
  assert.equal(getEventListeners(caller.signal,'abort').length,0)
})
