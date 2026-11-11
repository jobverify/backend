import assert from 'node:assert/strict'
import test from 'node:test'
import {getEventListeners} from 'node:events'
import {createTripcomScraper,run as runTripcom} from '../scraper/tripcom/script.js'
import {createBoschGlobalSoftwareTechnologiesScraper,run as runBosch,buildSearchUrl,buildDetailUrl,
  BOSCH_GLOBAL_SOFTWARE_TECHNOLOGIES_LEGAL_ENTITY_ID as legalEntity} from '../scraper/boschglobalsoftwaretechnologies/script.js'

// Authored lifecycle protocols only. The shell, unavailable responses and
// listing records below are controlled inputs, never original native captures.
const reasons=[['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],
  ['frozen',()=>Object.freeze(Error('Authored frozen caller'))],['default',()=>AbortSignal.abort().reason],
  ['mutable-network',()=>Object.assign(Error('Authored network-shaped caller'),{code:'ECONNRESET'})],
  ['frozen-network',()=>Object.freeze(Object.assign(Error('Authored frozen network caller'),{code:'ECONNRESET'}))],
  ['symbol',()=>Symbol('authored caller')],['opaque-object',()=>Object.freeze(Object.defineProperty({},'message',{get(){throw Error('Caller reason was inspected')}}))]]
const falsy=[['undefined',()=>undefined],['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=>''],['frozen',()=>Object.freeze(Error('Authored ordinary primary'))]]
const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),150)})])}finally{clearTimeout(timer)}}
const exact=(result,reason)=>{assert.equal(result.pending,undefined,'Caller did not settle');assert.equal(result.ok,false);assert.ok(Object.is(result.reason,reason),'Exact original reason identity changed')}
const descriptors=value=>value!==null&&(typeof value==='object'||typeof value==='function')?Object.getOwnPropertyDescriptors(value):null
const unchanged=(value,before)=>{if(before)assert.deepEqual(Object.getOwnPropertyDescriptors(value),before)}
const clock='2026-11-11T00:00:00.000Z'
const tripAPIs=[['factory',options=>createTripcomScraper().run(options)],['public',runTripcom]]
const boschAPIs=[['factory',options=>createBoschGlobalSoftwareTechnologiesScraper().run(options)],['public',runBosch]]
const trackTimer=(t,deadline)=>{
  const originalSet=setTimeout,originalClear=clearTimeout,active=new Set();let created=0
  t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>{const timer=originalSet(fn,ms,...args);if(ms===deadline){active.add(timer);created++}return timer})
  t.mock.method(globalThis,'clearTimeout',timer=>{active.delete(timer);return originalClear(timer)})
  return{active,get created(){return created}}
}
const shell='<script src="//ak-s-cw.tripcdn.com/modules/hrteam/careers-trip-abroad-ares/static/js/main.authored.js"></script><script>i18n_base_language={"en-US":{"recruit.overseasCareers.home.documentTitle":"Careers | Trip.com Group","OverseasCareers.MokaApplyPC":"https://hire-r1.mokahr.com/apply/tripoverseas/100000877#/job/{jobId}/apply?pure=1","OverseasCareers.AvatureApply":"https://jobs.careers.trip.com/en_US/careers/ApplicationSwitch"}}</script><script>t.u=e=>"static/js/"+e+"."+{187:"authoredDetail",240:"authoredList",995:"authoredRoutes"}[e]+".chunk.js"</script>'
const response=text=>({status:200,headers:{get:()=> 'text/html'},text:()=>Promise.resolve(text)})

for(const [api,run]of tripAPIs)for(const [label,make]of reasons)test(`Trip.com ${api} pre-abort ${label} admits no clock/request/timer and preserves descriptors`,async t=>{
  const caller=new AbortController(),reason=make(),before=descriptors(reason),timers=trackTimer(t,12345)
  caller.abort(reason);let clocks=0,fetches=0
  const result=await reflect(run({signal:caller.signal,timeoutMs:12345,requestIntervalMs:0,
    now:()=>{clocks++;return clock},fetchImpl:()=>{fetches++;throw Error('Forbidden authored request')}}))
  exact(result,reason);unchanged(reason,before);assert.equal(clocks,0);assert.equal(fetches,0)
  assert.equal(timers.created,0);assert.equal(timers.active.size,0)
})

for(const kind of ['transport-abort-throw','transport-late-reject','body-abort-throw','body-late-reject','queued-producer','pacing'])for(const [label,make]of reasons){
  test(`Trip.com ${kind} ${label} keeps exact unmodified caller and stops admission`,async t=>{
    const caller=new AbortController(),reason=make(),before=descriptors(reason),entered=deferred(),late=deferred(),
      replacement=Object.freeze(Error('Authored late transport/body replacement')),timers=trackTimer(t,12345)
    let fetches=0,bodies=0,queueHookReached=false,activeSignal
    if(kind==='queued-producer'){
      const original=AbortSignal.prototype.addEventListener
      t.mock.method(AbortSignal.prototype,'addEventListener',function(type,listener,options){
        const result=original.call(this,type,listener,options)
        if(type==='abort'&&this!==caller.signal&&!queueHookReached){activeSignal=this;queueHookReached=true;caller.abort(reason)}
        return result
      })
    }
    const pending=reflect(createTripcomScraper().run({signal:caller.signal,now:clock,timeoutMs:12345,requestIntervalMs:kind==='pacing'?500:0,
      fetchImpl:(_url,init)=>{
        fetches++;activeSignal=init.signal
        if(kind==='transport-abort-throw'){caller.abort(reason);throw replacement}
        if(kind==='transport-late-reject'){entered.resolve();return late.promise}
        if(kind==='queued-producer')return Promise.reject(replacement)
        return{status:200,headers:{get:()=> 'text/html'},text:()=>{
          bodies++
          if(kind==='body-abort-throw'){caller.abort(reason);throw replacement}
          if(kind==='body-late-reject'){entered.resolve();return late.promise}
          if(fetches===1)return Promise.resolve(shell)
          setImmediate(()=>caller.abort(reason));return Promise.resolve('Authored client, no native capture')
        }}
      }}))
    let result
    try{
      if(kind.endsWith('late-reject')){await entered.promise;caller.abort(reason)}
      result=await bounded(pending)
    }finally{if(kind.endsWith('late-reject'))late.reject(replacement);else late.resolve()}
    await pending;await turn();await turn()
    exact(result,reason);unchanged(reason,before);assert.equal(timers.active.size,0)
    assert.equal(fetches,kind==='queued-producer'?0:kind==='pacing'?2:1)
    if(kind==='queued-producer')assert.equal(queueHookReached,true)
    if(kind.startsWith('transport'))assert.equal(bodies,0)
    if(activeSignal)assert.equal(getEventListeners(activeSignal,'abort').length,0)
  })
}
test('Trip.com ordinary noncaller network failure keeps identity and established retry annotation',async t=>{
  const original=Object.assign(Error('Authored ordinary transport failure'),{code:'ECONNRESET'}),timers=trackTimer(t,12345)
  const result=await reflect(createTripcomScraper().run({now:clock,timeoutMs:12345,requestIntervalMs:0,fetchImpl:()=>{throw original}}))
  exact(result,original);assert.equal(original.abortRetries,true);assert.equal(timers.active.size,0)
})
test('Trip.com owned source deadline keeps its original Error and retry-stop annotation',async t=>{
  const timers=trackTimer(t,15);let activeSignal
  const result=await reflect(createTripcomScraper().run({now:clock,timeoutMs:15,requestIntervalMs:0,fetchImpl:(_url,init)=>{activeSignal=init.signal;return new Promise(()=>{})}}))
  exact(result,activeSignal.reason);assert.match(result.reason.message,/Trip.com source deadline exceeded/)
  assert.equal(result.reason.abortRetries,true);assert.equal(timers.active.size,0);assert.equal(getEventListeners(activeSignal,'abort').length,0)
})
for(const status of [401,403,429])test(`Trip.com genuine HTTP ${status} denial stays annotated and stops without retry`,async()=>{
  let requests=0
  const result=await reflect(createTripcomScraper().run({now:clock,requestIntervalMs:0,fetchImpl:()=>{requests++;return{...response('Authored denial'),status}}}))
  assert.equal(result.ok,false);assert.equal(result.reason.status,status);assert.equal(result.reason.abortRetries,true)
  assert.equal(result.reason.failureKind,'public_access_denied');assert.equal(requests,1)
})

const listings=()=>Array.from({length:18},(_,index)=>({refNumber:'AUTHORED-'+index,name:'Authored lifecycle control',jobUrl:'AUTHORED-'+index,
  legal_entity:{valueId:legalEntity},location:{country:'in',city:'Authored'}}))
const listingPayload=rows=>({_embedded:{'rh:result':[{meta:[{count:rows.length}],data:rows}]}})
for(const [api,run]of boschAPIs)for(const [label,make]of reasons)test(`Bosch ${api} pre-abort ${label} admits no request and preserves descriptors`,async()=>{
  const caller=new AbortController(),reason=make(),before=descriptors(reason);caller.abort(reason);let requests=0
  const result=await reflect(run({signal:caller.signal,fetchJson:()=>{requests++;throw Error('Forbidden authored request')}}))
  exact(result,reason);unchanged(reason,before);assert.equal(requests,0)
})
for(const [label,make]of reasons){
  test(`Bosch listing abort-plus-throw ${label} prefers exact caller over replacement`,async()=>{
    const caller=new AbortController(),reason=make(),before=descriptors(reason),replacement=Object.freeze(Error('Authored listing replacement'));let requests=0
    const result=await reflect(runBosch({signal:caller.signal,fetchJson:()=>{requests++;caller.abort(reason);throw replacement}}))
    exact(result,reason);unchanged(reason,before);assert.equal(requests,1)
  })
  test(`Bosch six active details cancellation ${label} stops queue and prefers exact caller`,async()=>{
    const caller=new AbortController(),reason=make(),before=descriptors(reason),replacement=Object.freeze(Error('Authored detail replacement')),
      rows=listings(),signals=[]
    let details=0,active=0,maximum=0
    const result=await reflect(runBosch({signal:caller.signal,fetchJson:(url,{signal})=>{
      assert.equal(signal,caller.signal)
      if(url===buildSearchUrl())return Promise.resolve(listingPayload(rows))
      assert.equal(url,buildDetailUrl(rows[details].refNumber));details++;active++;maximum=Math.max(maximum,active);signals.push(signal)
      if(details===6)queueMicrotask(()=>caller.abort(reason))
      return new Promise((resolve,reject)=>{
        const stop=()=>{active--;signal.removeEventListener('abort',stop);reject(replacement)}
        signal.addEventListener('abort',stop,{once:true})
      })
    }}))
    exact(result,reason);unchanged(reason,before);assert.equal(details,6);assert.equal(maximum,6);assert.equal(active,0)
    assert.ok(signals.every(signal=>getEventListeners(signal,'abort').length===0))
  })
}
for(const [label,make]of falsy)for(const laterFailure of [false,true])test(`Bosch recorded primary ${label} ${laterFailure?'before later failure':'with successful peers'} stops all queued details`,async()=>{
  const primary=make(),before=descriptors(primary),rows=listings(),releases=[]
  let details=0,active=0,maximum=0
  const pending=reflect(runBosch({fetchJson:url=>{
    if(url===buildSearchUrl())return Promise.resolve(listingPayload(rows))
    details++;active++;maximum=Math.max(maximum,active)
    if(details===1){active--;return Promise.reject(primary)}
    if(details>6){active--;return Promise.resolve([])}
    return new Promise((resolve,reject)=>releases.push(()=>{active--;if(laterFailure)reject(Object.freeze(Error('Authored later peer error')));else resolve([])}))
  }}))
  await turn();assert.equal(details,6);releases.forEach(release=>release())
  const result=await pending;exact(result,primary);unchanged(primary,before)
  assert.equal(details,6);assert.equal(maximum,5);assert.equal(active,0)
})

for(const behavior of ['return','throw'])for(const [label,make]of reasons)test(`Trip.com clock abort-${behavior} ${label} restores caller before later work`,async t=>{
  const caller=new AbortController(),reason=make(),before=descriptors(reason),replacement=Object.freeze(Error('Authored clock replacement')),
    timers=trackTimer(t,12345)
  let clocks=0,fetches=0
  const result=await reflect(createTripcomScraper().run({signal:caller.signal,timeoutMs:12345,requestIntervalMs:0,
    now:()=>{clocks++;caller.abort(reason);if(behavior==='throw')throw replacement;return clock},
    fetchImpl:()=>{fetches++;throw Error('Forbidden request after clock cancellation')}}))
  exact(result,reason);unchanged(reason,before);assert.equal(clocks,1);assert.equal(fetches,0)
  assert.equal(timers.created,0);assert.equal(timers.active.size,0)
})
test('Trip.com ordinary uncancelled clock failure keeps its pre-request identity',async()=>{
  const original=Object.freeze(Error('Authored ordinary clock failure'));let fetches=0
  exact(await reflect(createTripcomScraper().run({now:()=>{throw original},fetchImpl:()=>{fetches++}})),original)
  assert.equal(fetches,0);assert.equal(Object.hasOwn(original,'abortRetries'),false)
})

// This empty authored protocol satisfies the existing parser solely to reach
// its final evidence observer. It supplies no genuine native/source-zero proof.
const terminalProtocol=(url,init)=>{
  if(url==='https://careers.trip.com/')return response(shell)
  if(url.includes('main.authored.js'))return response('getJobList(e){const t={url:"api/oversea/getOverseaJobAd",data:e};return this.sendPost(t)}getBasisCountryInfo(e){const t={url:"api/oversea/getLocation",data:e};return this.sendPost(t)} const e={head:{language:"en-US"}}; const r={Avature:"OverseasCareers.AvatureApply",Moka_Overseas:"OverseasCareers.MokaApplyPC"}')
  if(url.includes('995.authoredRoutes'))return response('path:"/joblist";path:"/job-detail"')
  if(url.includes('240.authoredList'))return response('condition:{jobId:[],jobFamilyCode:[]};pageSizeOptions:["10","20"];OverseasCareersCountry;OverseasCareersWorkPlace')
  if(url.includes('187.authoredDetail'))return response('const r={condition:{fromId:[l]},atsApiType:i,pager:{index:1,size:10}}; const l=t.get("fromId")||t.get("jobId");e.requirements')
  const body=JSON.parse(init.body)
  if(url.endsWith('getLocation'))return Response.json({retCode:'201',retValue:body.type==='OverseasCareersCountry'?[{type:body.type,code:'IND',name:'India'}]:[]})
  assert.equal(url,'https://careers.trip.com/api/oversea/getOverseaJobAd')
  return Response.json({retCode:'201',retValue:{total:0,recruitJobAdList:[]}})
}
for(const [label,make]of reasons)test(`Trip.com terminal evidence abort-return ${label} cannot return inventory`,async t=>{
  const caller=new AbortController(),reason=make(),before=descriptors(reason),timers=trackTimer(t,12345)
  let observers=0
  const result=await reflect(createTripcomScraper().run({signal:caller.signal,now:clock,timeoutMs:12345,requestIntervalMs:0,
    fetchImpl:terminalProtocol,onNativeEvidence:()=>{observers++;caller.abort(reason)}}))
  assert.equal(observers,1,'Authored protocol must reach the existing evidence observer')
  exact(result,reason);unchanged(reason,before);assert.equal(timers.active.size,0)
})
