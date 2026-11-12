import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {
 RealResponse, RealReadableStream, backend, manifest, counters, denyFetch,
 requestFailure, hash, readAllowed, finishGuard,
} from './guard.mjs'

// PREPARATION ONLY. Actual source execution requires a later exact root GO.
// No application module, policy, parser, PDF or publisher output is replaced.
const importSource=name=>import(pathToFileURL(path.resolve(backend,name)).href)
const {fetchAnnouncementPage}=await importSource('scraper/iprogrammersolutions/employerAnnouncement.js')
const {runCurrentCalendlyAstro}=await importSource('scraper/calendly/currentAstro.js')
const {createDataikuPublicRead,HOME,LIMITS}=await importSource('scraper/dataiku/publicRead.js')
const {readInventoryEvidence}=await importSource('scraper-support/utils/inventoryEvidence.js')
const IPRO_URL='https://reader-control.invalid/authored-plain-text'
const CALENDLY_HOME='https://calendly.com/careers'
const NEUTRAL=Buffer.from('<html><title>Authored reader transport control</title></html>','utf8')
const CAPS={iprogrammer:2*1024*1024,calendly:4000000,dataiku:3*1024*1024}
assert.equal(LIMITS.bodyBytes,CAPS.dataiku)
assert.deepEqual(manifest.mutableSources,[])
assert.deepEqual(manifest.substitutions,[])
const observations=[]
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const tracked=promise=>{
 const value={settled:false,ok:false,error:undefined,result:undefined}
 const owned=Promise.resolve(promise).then(result=>Object.assign(value,{settled:true,settledAt:performance.now(),ok:true,result}),error=>Object.assign(value,{settled:true,settledAt:performance.now(),error}))
 return{value,promise:owned}
}
const bounded=async(promise,ms=3000)=>{
 let timer
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Authored harness settlement watchdog expired')),ms)})])}
 finally{clearTimeout(timer)}
}
const opaqueReason=()=>new Proxy(Object.create(null),{
 get(){counters.opaqueInspection++;throw Error('Opaque caller reason was inspected')},
 ownKeys(){counters.opaqueInspection++;throw Error('Opaque caller reason was enumerated')},
 getPrototypeOf(){counters.opaqueInspection++;throw Error('Opaque caller reason prototype was inspected')},
})

function nativeFixture({bytes=NEUTRAL,url,status=200,headers={},shape='active',mode='prompt',lateReject=false,onCancel}={}){
 const entered=deferred(),held=deferred(),cancelError=Error('Authored underlying cancellation failure')
 // This owns the fixture's deferred even if a path never admits cancellation.
 // The actual native reader/body cancellation promise is still owned by source.
 held.promise.catch(()=>{})
 const readError=Error('Authored actual reader failure'),observerError=Error('Authored capture observer failure')
 const record={getReaders:0,readerCancels:[],bodyCancels:[],releases:[],underlying:[],readError,observerError,cancelError}
 let controller,actualReader,nativeRelease,state=shape==='errored'?'errored':shape==='eof'?'eof':'active',released=false
 const underlying={
  start(value){controller=value;if(shape==='errored')value.error(readError);else{value.enqueue(bytes);if(shape==='eof')value.close()}},
  cancel(...args){
   state='cancelled';record.admittedAt=performance.now();record.underlying.push({receiverExact:this===underlying,args})
   entered.resolve();onCancel?.()
   if(mode==='throw')throw cancelError
   if(mode==='reject')return Promise.reject(cancelError)
   if(mode==='pending')return held.promise
  },
 }
 const body=new RealReadableStream(underlying)
 const originalBodyCancel=body.cancel
 Object.defineProperty(body,'cancel',{value:function(...args){
  record.bodyCancels.push({receiverExact:this===body,args})
  return Reflect.apply(originalBodyCancel,this,args)
 }})
 const originalGetReader=body.getReader
 Object.defineProperty(body,'getReader',{value:function(...args){
  record.getReaders++;assert.equal(this,body)
  const reader=Reflect.apply(originalGetReader,this,args)
  actualReader=reader;nativeRelease=reader.releaseLock
  const nativeCancel=reader.cancel
  Object.defineProperty(reader,'cancel',{value:function(...cancelArgs){
   record.readerCancels.push({receiverExact:this===reader,args:cancelArgs})
   return Reflect.apply(nativeCancel,this,cancelArgs)
  }})
  Object.defineProperty(reader,'releaseLock',{value:function(...releaseArgs){
   record.releases.push({receiverExact:this===reader,arity:releaseArgs.length})
   return Reflect.apply(nativeRelease,this,releaseArgs)
  }})
  return reader
 }})
 const response=new RealResponse(body,{status,headers:{'content-type':'text/html; charset=utf-8',...headers}})
 Object.defineProperty(response,'url',{value:url})
 return{
  response,body,record,entered:entered.promise,
  get admitted(){return record.underlying.length>0},
  snapshot(){
   const calls=[...record.readerCancels,...record.bodyCancels]
   return{
    actualStandardResponse:response instanceof RealResponse,actualReader:!!actualReader,
    getReaders:record.getReaders,readerCancellationCalls:record.readerCancels.length,
    bodyCancellationCalls:record.bodyCancels.length,underlyingCancellationCalls:record.underlying.length,
    readerCancellationArities:record.readerCancels.map(call=>call.args.length),
    bodyCancellationArities:record.bodyCancels.map(call=>call.args.length),
    readerReleaseCalls:record.releases.length,bodyLocked:body.locked,authoredStreamState:state,
    receiversExact:[...calls,...record.releases,...record.underlying].every(call=>call.receiverExact),
    nativeUnderlyingReasonForwardedExactly:record.underlying.every(call=>call.args.length===1&&calls.some(parent=>parent.args[0]===call.args[0])),
   }
  },
  releaseCancel(){if(released)return;released=true;if(lateReject)held.reject(cancelError);else held.resolve()},
  // Parent fixture hygiene runs only after snapshots and actual source settlement.
  // It is deliberately separate from the observed source-owned release count.
  finishFixture(){
   if(!released){released=true;held.resolve()}
   try{controller.close()}catch{}
   if(actualReader&&body.locked)Reflect.apply(nativeRelease,actualReader,[])
  },
 }
}

function describe(value,{callerReason,fixture}={}){
 if(!value.settled)return{settled:false}
 if(value.ok)return{settled:true,ok:true}
 if(value.error===callerReason&&callerReason!==undefined)return{settled:true,ok:false,identity:'exact-external-caller'}
 for(const key of ['cancelError','readError','observerError'])if(value.error===fixture?.record[key])return{settled:true,ok:false,identity:key}
 return{settled:true,ok:false,message:value.error?.message,status:value.error?.status,failureKind:value.error?.failureKind}
}
const isBudget=(value,family,callerReason)=>value.settled&&!value.ok&&value.error!==callerReason
 &&value.error instanceof Error&&(family==='iprogrammer'?/native response exceeds size bound/:/native (?:response byte budget reached|body exceeds limit)/i).test(value.error.message)

async function exercise(family,{mode='prompt',shape='overflow',callerPhase,preAborted=false,status=200,requestOnly=false,lateReject=false,observerFailure=false,deniedStop=false}={}){
 const caller=callerPhase||preAborted?new AbortController():null,callerReason=caller?opaqueReason():undefined
 const requestController=requestOnly?new AbortController():null,requestReason=Error('Authored request-only signal reason')
 if(preAborted)caller.abort(callerReason)
 const url=family==='iprogrammer'?IPRO_URL:family==='calendly'?CALENDLY_HOME:HOME
 const config={url,status,mode,lateReject,shape:shape==='eof'?'eof':shape==='errored'?'errored':'active',
  bytes:shape==='overflow'?Buffer.alloc(CAPS[family]+1,65):NEUTRAL,
  headers:shape==='declared'?{'content-length':String(CAPS[family]+1)}:{},
  onCancel(){if(callerPhase==='prompt')caller.abort(callerReason);if(requestOnly)requestController.abort(requestReason)},
 }
 const fixture=nativeFixture(config),calls=[];let io,requestSignal,settleTask,sourceTask,secondDenied=null,before,sourceSignalAborted=false,earlyAwaited=null,earlyProbeElapsedMs=null,pendingAtCallerAbort=null
 const fetchImpl=async(requested,init)=>{
  if(requested!==url||calls.length)return requestFailure(requested)
  calls.push(requested);requestSignal=init.signal;return fixture.response
 }
 const oldFetch=globalThis.fetch,started=performance.now()
 try{
  if(family==='iprogrammer'){
   globalThis.fetch=fetchImpl
   sourceTask=tracked(fetchAnnouncementPage(url,{signal:caller?.signal}))
  }else if(family==='calendly')sourceTask=tracked(runCurrentCalendlyAstro({fetchImpl,signal:caller?.signal,now:()=> '2026-11-11T04:04:00.000Z'}))
  else{
   io=createDataikuPublicRead({fetchImpl,signal:caller?.signal,onNativeResponse:observerFailure?()=>{throw fixture.record.observerError}:undefined})
   sourceTask=tracked(io.read(url,requestOnly?{signal:requestController.signal}:{}))
  }
  await bounded(Promise.race([fixture.entered,sourceTask.promise]))
  if(callerPhase==='pending'&&fixture.admitted){pendingAtCallerAbort=!sourceTask.value.settled;caller.abort(callerReason)}
  if(io)settleTask=tracked(io.settle())
  if(mode==='pending'&&fixture.admitted){
   if(callerPhase==='pending')await pause(80)
   else{
    await pause(50);earlyAwaited=!sourceTask.value.settled;earlyProbeElapsedMs=Math.round(performance.now()-fixture.record.admittedAt)
    await pause(1350)
   }
  }else await bounded(sourceTask.promise)
  await pause(0) // Drain ordinary source/settle microtasks before the snapshot.
  before={...sourceTask.value};sourceSignalAborted=io?.sourceSignal.aborted??false
  const beforeSettle=settleTask?{...settleTask.value}:null,snapshot=fixture.snapshot(),elapsedMs=Math.round(performance.now()-started)
  fixture.releaseCancel()
  await bounded(sourceTask.promise)
  if(settleTask)await bounded(settleTask.promise)
  if(deniedStop&&io){
   const count=calls.length,second=tracked(io.read(HOME));await bounded(second.promise)
   secondDenied={sameError:second.value.error===sourceTask.value.error,noLaterFetch:calls.length===count}
  }
  return{family,fixture,callerReason,requestReason,before,after:{...sourceTask.value},beforeSettle,
   observation:{family,authored:true,shape,mode,status,callerPhase:callerPhase??null,requestOnly,preAborted,
    elapsedMs,calls:calls.length,awaitedAtEarlyProbe:earlyAwaited,earlyProbeElapsedMs,
    settledFromAdmissionMs:before.settled&&fixture.record.admittedAt!==undefined?Math.round(before.settledAt-fixture.record.admittedAt):null,
    beforeControlledRelease:describe(before,{callerReason,fixture}),
    afterControlledRelease:describe(sourceTask.value,{callerReason,fixture}),
    settleBeforeControlledRelease:beforeSettle?.settled??null,requestSignalAborted:requestSignal?.aborted??null,
    sourceSignalAborted,pendingAtCallerAbort,requestOnlyReasonIsExternalCaller:requestReason===callerReason,secondDenied,...snapshot},
  }
 }finally{
  fixture.releaseCancel()
  if(sourceTask)await bounded(sourceTask.promise)
  if(io){await bounded(io.settle());io.dispose()}
  fixture.finishFixture();globalThis.fetch=oldFetch
 }
}

function retain(name,result){observations.push({name,...result.observation});return result}
function nativeCalls(result,arity){
 const row=result.observation
 assert.equal(row.receiversExact,true,'Native cancellation/release receivers must remain actual receivers')
 assert.equal(row.nativeUnderlyingReasonForwardedExactly,true,'Actual native cancellation reason must retain its identity')
 if(arity!==undefined)assert.ok([...row.readerCancellationArities,...row.bodyCancellationArities].every(value=>value===arity),'Existing cancellation arity must be retained')
}
async function budgetCase(name,family,options={}){
 const r=retain(name,await exercise(family,options));nativeCalls(r,family==='dataiku'?1:0)
 assert.equal(r.observation.underlyingCancellationCalls,1,'The actual underlying cancellation must be admitted exactly once')
 if(options.mode==='pending')assert.equal(r.observation.awaitedAtEarlyProbe,true,'Admitted cancellation remains awaited before the fixed grace; it cannot be silently detached')
 assert.equal(r.before.settled,true,'Known failure must settle while admitted cancellation is still held')
 assert.equal(isBudget(r.before,family,r.callerReason),true,'Original byte-budget failure must survive actual cleanup')
 if(family==='dataiku'){
  assert.equal(r.beforeSettle.settled,true,'Dataiku settle must finish after the bounded read settles')
  const call=r.fixture.record.readerCancels[0]||r.fixture.record.bodyCancels[0]
  assert.equal(call.args.length,1);assert.equal(call.args[0]===r.before.error,true,'Dataiku forwards its original failure exactly')
 }
}
async function callerCase(name,family,callerPhase,shape='overflow'){
 const r=retain(name,await exercise(family,{mode:callerPhase==='pending'?'pending':'prompt',shape,callerPhase}));nativeCalls(r,family==='dataiku'?1:0)
 assert.equal(r.observation.underlyingCancellationCalls,1)
 if(callerPhase==='pending')assert.equal(r.observation.pendingAtCallerAbort,true,'Caller arrives while source still owns its actual pending cancellation')
 assert.equal(r.before.settled,true,'Exact external caller must interrupt admitted cancellation promptly')
 assert.equal(r.before.error===r.callerReason,true,'Exact opaque external caller reason must retain priority')
 if(family==='dataiku')assert.equal(r.beforeSettle.settled,true,'Caller interruption must also end Dataiku settle')
}
async function ownershipCase(name,family){
 const results=[]
 for(const shape of ['overflow','eof','errored'])results.push(retain(name+' / '+shape,await exercise(family,{shape})))
 for(const r of results){
  nativeCalls(r,0)
  if(r.observation.shape==='overflow')assert.equal(isBudget(r.before,family,r.callerReason),true)
  if(r.observation.shape==='errored')assert.equal(r.before.error===r.fixture.record.readError,true)
 }
 assert.ok(results.every(r=>r.observation.bodyLocked===false&&r.observation.readerReleaseCalls===1),'Actual owned reader must be released after overflow, EOF and already-errored read')
}
async function preAbortedCase(name,family){
 const r=retain(name,await exercise(family,{shape:'eof',preAborted:true}))
 assert.equal(r.before.error===r.callerReason,true);assert.equal(r.observation.calls,0)
 assert.equal(r.observation.getReaders,0);assert.equal(r.observation.underlyingCancellationCalls,0)
}

const cases=[]
const add=(name,run)=>cases.push({name,run})
add('iProgrammer active overflow preserves size error when actual cancel rejects',name=>budgetCase(name,'iprogrammer',{mode:'reject'}))
add('iProgrammer active overflow preserves size error when underlying cancel throws',name=>budgetCase(name,'iprogrammer',{mode:'throw'}))
add('iProgrammer active overflow owns pending cancellation and late rejection',name=>budgetCase(name,'iprogrammer',{mode:'pending',lateReject:true}))
add('iProgrammer prompt cancellation preserves existing size failure',name=>budgetCase(name,'iprogrammer'))
add('iProgrammer exact opaque caller interrupts pending cancellation',name=>callerCase(name,'iprogrammer','pending'))
add('iProgrammer opaque caller arriving inside prompt cancellation has priority',name=>callerCase(name,'iprogrammer','prompt'))
add('iProgrammer successful authored EOF text retains bytes and native closed-stream semantics',async name=>{
 const r=retain(name,await exercise('iprogrammer',{shape:'eof'}));nativeCalls(r,0)
 assert.equal(r.before.ok,true);assert.equal(r.before.result.html,NEUTRAL.toString('utf8'))
 assert.equal(r.before.result.status,200);assert.equal(r.before.result.url,IPRO_URL)
 assert.equal(r.observation.readerCancellationCalls,1);assert.equal(r.observation.underlyingCancellationCalls,0)
})
add('iProgrammer actual owned lock releases after overflow EOF and read error',name=>ownershipCase(name,'iprogrammer'))
add('iProgrammer already-aborted caller performs no request',name=>preAbortedCase(name,'iprogrammer'))

add('Calendly active overflow preserves byte error when actual cancel rejects',name=>budgetCase(name,'calendly',{mode:'reject'}))
add('Calendly active overflow preserves byte error when underlying cancel throws',name=>budgetCase(name,'calendly',{mode:'throw'}))
add('Calendly active overflow stops while actual cancellation remains pending',name=>budgetCase(name,'calendly',{mode:'pending'}))
add('Calendly prompt cancellation preserves existing byte failure',name=>budgetCase(name,'calendly'))
add('Calendly exact opaque caller interrupts pending cancellation',name=>callerCase(name,'calendly','pending'))
add('Calendly opaque caller arriving inside prompt cancellation has priority',name=>callerCase(name,'calendly','prompt'))
for(const mode of ['reject','pending'])add('Calendly declared-length failure disposes its actual unread body with '+mode+' cancellation',async name=>{
 const r=retain(name,await exercise('calendly',{shape:'declared',mode}));nativeCalls(r)
 assert.equal(r.observation.getReaders,0)
 assert.equal(r.observation.bodyCancellationCalls,1,'Known advertised-length failure must dispose its acquired unread body')
 assert.equal(r.observation.underlyingCancellationCalls,1)
 if(mode==='pending')assert.equal(r.observation.awaitedAtEarlyProbe,true)
 assert.equal(r.before.settled,true,'Known header failure must settle with pending disposal bounded')
 assert.equal(isBudget(r.before,'calendly',r.callerReason),true)
})
add('Calendly actual owned lock releases after overflow EOF and read error',name=>ownershipCase(name,'calendly'))
add('Calendly unchanged genuine current27-packet fixture retains26-request qualification',async name=>{
 const fixture=JSON.parse(gunzipSync(readAllowed('scraper/calendly/test-data/current-astro-20261111.json.gz')))
 const metadata=JSON.parse(readAllowed('scraper/calendly/test-data/current-astro-20261111.manifest.json').toString('utf8'))
 assert.equal(fixture.responses.length,27);assert.equal(metadata.responses.length,27)
 const captures=new Map(),counts=new Map(),used=[],readers=[]
 for(let index=0;index<fixture.responses.length;index++){
  const packet=fixture.responses[index],bytes=Buffer.from(packet.bodyBase64,'base64'),{bodyBase64,...rest}=packet
  assert.equal(hash(bytes),packet.sha256);assert.equal(bytes.length,packet.bytes);assert.deepEqual(rest,metadata.responses[index])
  captures.set(packet.phase+':'+packet.url,{packet,bytes})
 }
 let jobs
 try{
  jobs=await runCurrentCalendlyAstro({now:()=> '2026-11-11T04:04:00.000Z',fetchImpl:async(url,init)=>{
   const count=(counts.get(url)||0)+1;counts.set(url,count)
   const item=captures.get((count>1?'closing:':'opening:')+url)
   if(!item)return requestFailure(url)
   assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store')
   const value=nativeFixture({bytes:item.bytes,url:item.packet.finalURL,status:item.packet.status,headers:{'content-type':item.packet.contentType},shape:'eof'})
   readers.push(value);used.push({url,sha256:hash(item.bytes),bytes:item.bytes.length,phase:count>1?'closing':'opening'})
   return value.response
  }})
  const evidence=readInventoryEvidence(jobs),audit=jobs.nativeCollectionEvidence
  const excluded=new Set(['scrapedAt','verifiedAt','observedAt','startedAt','completedAt'])
  const snapshot=JSON.stringify({jobs,inventory:evidence,nativeCollectionEvidence:audit},(key,value)=>excluded.has(key)?undefined:value)
  observations.push({name,authored:false,retainedFixtureOnly:true,source:'calendly',calls:used.length,selectedRetainedPackets:used,
   jobs:jobs.length,observedNativeRecordCount:audit.observedNativeRecordCount,roles:audit.roles.length,
   inventoryStatus:evidence.status,indiaFacetCount:evidence.indiaFacetCount,listingComplete:evidence.listingComplete,
   companyGlobalScopeQualified:audit.companyGlobalScopeQualified,lifecycleCleanupAllowed:evidence.lifecycleCleanupAllowed,
   signature:hash(snapshot),signatureScope:'JSON-serializable jobs plus inventory/nativeCollectionEvidence; recursively excludes scrapedAt verifiedAt observedAt startedAt completedAt',
   ownedReaders:readers.map(value=>value.snapshot()),
  })
  assert.deepEqual(jobs,[]);assert.equal(used.length,26);assert.equal(audit.observedNativeRecordCount,7)
  assert.equal(audit.roles.length,7);assert.equal(evidence.status,'complete-inventory');assert.equal(evidence.reportedTotal,7)
  assert.equal(evidence.indiaFacetCount,0);assert.equal(evidence.listingComplete,true)
  assert.equal(audit.currentDeclaredSourceProgramComplete,true);assert.equal(audit.companyGlobalScopeQualified,false)
  assert.equal(evidence.lifecycleCleanupAllowed,false)
 }finally{for(const value of readers){value.releaseCancel();value.finishFixture()}}
})
add('Calendly already-aborted caller performs no request',name=>preAbortedCase(name,'calendly'))

add('Dataiku actual rejected reader cancellation preserves original error and one exact reason argument',name=>budgetCase(name,'dataiku',{mode:'reject'}))
add('Dataiku underlying throwing cancellation is an observed native rejection control',name=>budgetCase(name,'dataiku',{mode:'throw'}))
add('Dataiku active pending reader cleanup bounds both read and settle',name=>budgetCase(name,'dataiku',{mode:'pending'}))
add('Dataiku opaque external caller interrupts pending reader cleanup and settle',name=>callerCase(name,'dataiku','pending'))
add('Dataiku declared-length rejection uses actual body cancel with exact original reason',async name=>{
 const r=retain(name,await exercise('dataiku',{shape:'declared',mode:'reject'}));nativeCalls(r)
 assert.equal(r.observation.getReaders,0);assert.equal(r.observation.bodyCancellationCalls,1)
 assert.deepEqual(r.observation.bodyCancellationArities,[1]);assert.equal(r.before.settled,true)
 assert.equal(isBudget(r.before,'dataiku',r.callerReason),true)
 assert.equal(r.fixture.record.bodyCancels[0].args[0]===r.before.error,true)
})
add('Dataiku declared-length pending body cleanup bounds read settle and owns late rejection',name=>budgetCase(name,'dataiku',{shape:'declared',mode:'pending',lateReject:true}))
add('Dataiku observed HTTP403 survives pending reader cleanup and host remains stopped',async name=>{
 const r=retain(name,await exercise('dataiku',{status:403,mode:'pending',deniedStop:true}));nativeCalls(r,1)
 assert.equal(r.observation.awaitedAtEarlyProbe,true);assert.equal(r.observation.underlyingCancellationCalls,1)
 assert.equal(r.before.settled,true);assert.equal(r.beforeSettle.settled,true)
 assert.equal(r.before.error?.status,403);assert.equal(r.before.error?.failureKind,'blocked_or_access_denied')
 assert.equal(r.observation.secondDenied.sameError,true);assert.equal(r.observation.secondDenied.noLaterFetch,true)
 assert.equal(r.observation.calls,1)
})
add('Dataiku request-only abort during denied declared-length cleanup preserves known HTTP403',async name=>{
 const r=retain(name,await exercise('dataiku',{shape:'declared',status:403,mode:'pending',requestOnly:true,deniedStop:true}));nativeCalls(r)
 assert.equal(r.observation.awaitedAtEarlyProbe,true);assert.equal(r.observation.underlyingCancellationCalls,1)
 assert.equal(r.before.settled,true);assert.equal(r.beforeSettle.settled,true);assert.equal(r.before.error?.status,403)
 assert.equal(r.observation.requestSignalAborted,true);assert.equal(r.observation.sourceSignalAborted,false)
 assert.equal(r.observation.secondDenied.sameError,true);assert.equal(r.observation.secondDenied.noLaterFetch,true)
})
add('Dataiku opaque caller inside prompt unread-body cleanup retains existing exact priority',name=>callerCase(name,'dataiku','prompt','declared'))
add('Dataiku observer error after actual standard EOF cannot invoke an underlying pending cancel',async name=>{
 const r=retain(name,await exercise('dataiku',{shape:'eof',mode:'pending',observerFailure:true}));nativeCalls(r,1)
 assert.equal(r.before.settled,true);assert.equal(r.before.error===r.fixture.record.observerError,true)
 assert.equal(r.observation.readerCancellationCalls,1);assert.equal(r.observation.underlyingCancellationCalls,0)
 assert.equal(r.fixture.record.readerCancels[0].args[0]===r.fixture.record.observerError,true)
 assert.equal(r.observation.bodyLocked,false);assert.equal(r.observation.readerReleaseCalls,1)
})
add('Dataiku unchanged genuine HOME packet retains EOF bytes metadata digest and release',async name=>{
 const capture=JSON.parse(gunzipSync(readAllowed('scraper/dataiku/native-captures/registered-public-20261101.json.gz')))
 const packet=capture.packets[0],bytes=Buffer.from(packet.rawBodyBase64,'base64')
 assert.equal(capture.kind,'actual-bounded-current-registered-public-source')
 assert.equal(packet.url,HOME);assert.equal(packet.finalUrl,HOME);assert.equal(packet.status,200)
 assert.equal(bytes.length,packet.bodyBytes);assert.equal(hash(bytes),packet.bodySHA256)
 const fixture=nativeFixture({bytes,url:packet.finalUrl,status:packet.status,headers:packet.headers,shape:'eof'})
 let calls=0;const io=createDataikuPublicRead({fetchImpl:async url=>{if(url!==HOME||calls++)return requestFailure(url);return fixture.response}})
 try{
  const page=await io.read(HOME);await io.settle()
  observations.push({name,authored:false,retainedFixtureOnly:true,source:'dataiku-publicRead-transport-only',calls,
   bytes:page.bodyBytes,bodySHA256:page.bodySHA256,status:page.status,finalUrl:page.finalUrl,
   qualificationClaim:'One retained native HOME transport packet only; no Dataiku job/country/whole-source qualification.',...fixture.snapshot()})
  assert.equal(calls,1);assert.equal(hash(page.body),packet.bodySHA256);assert.equal(page.bodySHA256,packet.bodySHA256)
  assert.equal(page.text,bytes.toString('utf8'));assert.deepEqual(page.headers,Object.fromEntries(new Headers(packet.headers).entries()))
  assert.equal(page.status,packet.status);assert.equal(page.finalUrl,packet.finalUrl);assert.equal(io.receipts.length,1)
  assert.equal(fixture.snapshot().readerReleaseCalls,1);assert.equal(fixture.body.locked,false)
  assert.equal(fixture.snapshot().readerCancellationCalls,0);assert.equal(fixture.snapshot().underlyingCancellationCalls,0)
 }finally{await io.settle();io.dispose();fixture.releaseCancel();fixture.finishFixture()}
})
add('Dataiku already-aborted exact caller performs no request and settle ends',name=>preAbortedCase(name,'dataiku'))
add('Dataiku unreviewed invalid destination is refused before transport',async name=>{
 let calls=0;const io=createDataikuPublicRead({fetchImpl:()=>{calls++;return requestFailure('unexpected')}})
 try{
  const outcome=tracked(io.read('https://unreviewed-reader-control.invalid/'));await bounded(outcome.promise);await bounded(io.settle())
  observations.push({name,authored:true,selectedURL:'https://unreviewed-reader-control.invalid/',calls,settled:outcome.value.settled,message:outcome.value.error?.message})
  assert.equal(calls,0);assert.match(outcome.value.error.message,/Unreviewed native HTTP destination/)
 }finally{await io.settle();io.dispose()}
})

assert.equal(cases.length,33)
for(const item of cases)test(item.name,{timeout:8000,concurrency:false},()=>item.run(item.name))
after(()=>{
 globalThis.fetch=denyFetch
 const receipt=finishGuard()
 console.log('READER_CLEANUP_NEXT '+JSON.stringify({...receipt,plannedCases:cases.length,observations,
  applicationSubstitutions:0,clockOrSignalSubstitutions:0,publisherProgramsExecuted:0,pdfImplementationImportsGranted:0,
  sourceScope:'Three selected public APIs with exact current static11-module closure; generic runner and PDFs are not executed.',
 }))
})
