import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {
 RealResponse,RealReadableStream,manifest,counters,requestFailure,
 hash,readAllowed,finishGuard,
} from './guard.mjs'

// Preparation only. Exact root GO is required before this source child runs.
// Authored transport controls never replace application/parser/policy functions.
assert.deepEqual(manifest.mutableSources,[])
assert.deepEqual(manifest.substitutions,[])
const spec=manifest.flowSpec
const source=await import(pathToFileURL(path.resolve(spec.entry)).href)
const observations=[]
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const tracked=promise=>{
 const value={settled:false,ok:false,error:undefined,result:undefined}
 const owned=Promise.resolve(promise).then(result=>Object.assign(value,{settled:true,settledAt:performance.now(),ok:true,result}),error=>Object.assign(value,{settled:true,settledAt:performance.now(),error}))
 return{value,promise:owned}
}
const bounded=async(promise,ms=4000)=>{
 let timer
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Authored fixture settlement watchdog expired')),ms)})])}
 finally{clearTimeout(timer)}
}
const opaqueReason=()=>new Proxy(Object.create(null),{
 get(){counters.opaqueInspection++;throw Error('Opaque caller reason inspected')},
 ownKeys(){counters.opaqueInspection++;throw Error('Opaque caller reason enumerated')},
 getPrototypeOf(){counters.opaqueInspection++;throw Error('Opaque caller reason prototype inspected')},
})
const NEUTRAL=Buffer.from('<html><title>Authored negative transport control</title></html>','utf8')

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


const archive=spec.fixture?JSON.parse(gunzipSync(readAllowed(spec.fixture))):null
const fullertonPackets=spec.key.startsWith('fullerton-')?archive.packets:null
const packetBytes=packet=>Buffer.from(packet.rawBodyBase64??packet.bodyBase64,'base64')
const fullertonPrefix=fullertonPackets?.slice(0,3)??[]
const fullertonPDF=fullertonPackets?.find(packet=>packet.requestedURL===spec.targetURL)
const ownJSON=value=>JSON.parse(JSON.stringify(value))
const volatile=new Set(['scrapedAt','verifiedAt','observedAt','startedAt','completedAt'])
const snapshot=value=>{
 if(Array.isArray(value))return value.map(snapshot)
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>!volatile.has(key)).map(key=>[key,snapshot(value[key])]))
 return value
}
const describe=(value,reason,fixture)=>{
 if(!value.settled)return{settled:false}
 if(value.ok)return{settled:true,ok:true,bytes:Buffer.isBuffer(value.result)?value.result.length:undefined}
 if(reason!==undefined&&value.error===reason)return{settled:true,ok:false,identity:'exact-external-caller'}
 if(value.error===fixture?.record.readError)return{settled:true,ok:false,identity:'actual-read-error'}
 if(value.error===fixture?.record.cancelError)return{settled:true,ok:false,identity:'underlying-cancel-error'}
 return{settled:true,ok:false,message:value.error?.message}
}
const isPrimary=(value,reason)=>value.settled&&!value.ok&&value.error!==reason&&value.error instanceof Error&&new RegExp(spec.primaryError).test(value.error.message)
const invoke=signal=>{
 switch(spec.key){
  case'evidation':return source.runNativeEvidation({signal})
  case'hightouch':return source.runNativeHightouch({signal})
  case'kidvento':return source.runNativeInventory({signal})
  case'fullerton-html':case'fullerton-json':return source.run({signal})
  case'fullerton-pdf':return source.fetchDescriptionPDF(spec.targetURL,{signal})
  case'prime':return source.run({signal})
  case'finzly':return source.createFinzlyNativeInventory().run({signal})
  case'licious':return source.createNativeLiciousScraper().run({signal})
  case'sightspectrum':return source.runCurrentSightSpectrum({signal})
  default:throw Error('Unknown frozen flow')
 }
}
const nativePrototypes=fixture=>({
 response:Object.getPrototypeOf(fixture.response)===RealResponse.prototype,
 body:Object.getPrototypeOf(fixture.body)===RealReadableStream.prototype,
})

async function exercise({shape='overflow',mode='prompt',callerPhase,callerKind='opaque'}={}){
 const caller=callerPhase?new AbortController():null
 const reason=caller?callerKind==='null'?null:opaqueReason():undefined
 const genuineEOF=spec.key==='fullerton-pdf'&&shape==='eof'
 const bytes=genuineEOF?packetBytes(fullertonPDF):shape==='overflow'?Buffer.alloc(spec.byteCap+1,65):spec.key==='fullerton-json'?Buffer.from('{'):NEUTRAL
 const fixture=nativeFixture({url:spec.targetURL,bytes,mode,shape:shape==='errored'?'errored':shape==='eof'?'eof':'active',
  headers:genuineEOF?fullertonPDF.headers:{'content-type':spec.contentType},lateReject:mode==='pending',
  onCancel(){if(callerPhase==='prompt')caller.abort(reason)},
 })
 const calls=[],prefixFixtures=[],extraFixtures=[]
 let requestSignal,earlyAwaited=null,earlyProbeElapsedMs=null,before,atAbortPending=null
 let task,targetSeen=false,prefixIndex=0
 const fetchImpl=async(url,init={})=>{
  calls.push({url,method:init.method??'GET',redirect:init.redirect,signalAborted:init.signal?.aborted??null})
  assert.ok(init.signal instanceof AbortSignal,'Actual native signal must reach in-memory fetch')
  if(spec.key==='fullerton-json'&&prefixIndex<3){
   const packet=fullertonPrefix[prefixIndex++]
   if(url!==packet.requestedURL)return requestFailure(url)
   assert.equal(init.method??'GET',packet.method)
   const item=nativeFixture({url:packet.finalURL,bytes:packetBytes(packet),headers:packet.headers,shape:'eof'})
   prefixFixtures.push(item);return item.response
  }
  if(url===spec.targetURL&&!targetSeen){
   targetSeen=true;requestSignal=init.signal
   if(spec.key==='fullerton-json'){
    const packet=fullertonPackets[3]
    assert.equal(init.method,packet.method);assert.equal(init.body,packet.requestBody)
   }
   return fixture.response
  }
  if(shape==='eof'&&spec.key==='sightspectrum'&&source.PUBLIC_SCOPE_URLS.slice(1).includes(url)){
   assert.equal(url,source.PUBLIC_SCOPE_URLS[extraFixtures.length+1])
   const item=nativeFixture({url,bytes:NEUTRAL,shape:'eof'})
   extraFixtures.push(item);return item.response
  }
  return requestFailure(url)
 }
 const oldFetch=globalThis.fetch,started=performance.now()
 try{
  globalThis.fetch=fetchImpl
  task=tracked(invoke(caller?.signal))
  if(shape==='overflow')await bounded(fixture.entered)
  if(mode==='pending'&&shape==='overflow'){
   const admitted=fixture.record.admittedAt
   if(callerPhase==='pending'){
    atAbortPending=!task.value.settled;caller.abort(reason);await pause(80)
   }else{
    await pause(50);earlyAwaited=!task.value.settled;earlyProbeElapsedMs=Math.round(performance.now()-admitted)
    await pause(1350)
   }
   before=describe(task.value,reason,fixture)
   fixture.releaseCancel()
  }
  await bounded(task.promise)
  if(!before)before=describe(task.value,reason,fixture)
  const row={flow:spec.key,authored:!genuineEOF,transportOnly:true,shape,mode,callerPhase:callerPhase??null,callerKind:caller?callerKind:null,
   targetURL:spec.targetURL,calls:ownJSON(calls),genuinePrefixPackets:prefixFixtures.length,
   awaitedAtEarlyProbe:earlyAwaited,earlyProbeElapsedMs,settledFromAdmissionMs:fixture.admitted&&task.value.settled?Math.round(task.value.settledAt-fixture.record.admittedAt):null,
   callerWasPendingAtAbort:atAbortPending,externalSignalAborted:caller?.signal.aborted??false,requestSignalAborted:requestSignal?.aborted??false,
   beforeControlledRelease:before,afterControlledRelease:describe(task.value,reason,fixture),elapsedMs:Math.round(performance.now()-started),
   ...fixture.snapshot(),nativePrototypes:nativePrototypes(fixture),genuinePrefixReaders:prefixFixtures.map(item=>item.snapshot()),extraEOFReaders:extraFixtures.map(item=>item.snapshot()),
   genuineEOFPacket:genuineEOF?{bodySHA256:hash(bytes),bytes:bytes.length,expectedSHA256:fullertonPDF.bodySHA256}:null,
  }
  observations.push(row)
  assert.ok(row.receiversExact&&row.nativeUnderlyingReasonForwardedExactly)
  assert.deepEqual(row.nativePrototypes,{response:true,body:true})
  assert.ok(row.readerCancellationArities.every(value=>value===0),'Original zero-argument cancellation is retained')
  if(mode==='pending'&&shape==='overflow')assert.equal(row.underlyingCancellationCalls,1)
  return{row,value:task.value,reason,fixture}
 }finally{
  fixture.releaseCancel()
  if(task)await bounded(task.promise)
  globalThis.fetch=oldFetch
  fixture.finishFixture()
  for(const item of [...prefixFixtures,...extraFixtures])item.finishFixture()
 }
}

const runCase=(name,body)=>test(spec.label+': '+name,{timeout:35000},body)
if(!spec.jsonFollowupOnly)runCase('actual cancellation rejection retains the known byte failure',async()=>{
 const x=await exercise({mode:spec.key==='fullerton-pdf'?'throw':'reject'})
 assert.ok(isPrimary(x.value,x.reason),'The byte failure must remain primary')
 assert.equal(x.row.underlyingCancellationCalls,1)
})
runCase('pending cancellation remains owned briefly then source settles within cleanup grace',async()=>{
 const x=await exercise({mode:'pending'})
 assert.equal(x.row.awaitedAtEarlyProbe,true,'Real cancellation is awaited at the early probe')
 assert.equal(x.row.beforeControlledRelease.settled,true,'Direct source promise must settle before the held native cancel is released')
 assert.ok(isPrimary(x.value,x.reason))
 assert.ok(x.row.settledFromAdmissionMs>=900&&x.row.settledFromAdmissionMs<1400,'The fixed helper grace, not the generic runner, bounds cleanup')
})
runCase('exact opaque caller interrupts pending native cancellation',async()=>{
 const x=await exercise({mode:'pending',callerPhase:'pending'})
 assert.equal(x.row.callerWasPendingAtAbort,true)
 assert.equal(x.row.beforeControlledRelease.settled,true,'Caller must settle before underlying cancellation is released')
 assert.equal(x.row.beforeControlledRelease.identity,'exact-external-caller')
 assert.equal(x.value.error,x.reason)
})
if(!spec.jsonFollowupOnly)runCase('exact null caller inside prompt cleanup has priority over known byte failure',async()=>{
 const x=await exercise({mode:'prompt',callerPhase:'prompt',callerKind:'null'})
 assert.equal(x.row.externalSignalAborted,true)
 assert.equal(x.row.beforeControlledRelease.identity,'exact-external-caller')
 assert.equal(x.value.error,null)
})
if(!spec.jsonFollowupOnly)runCase('actual owned reader releases after overflow EOF and already-errored read',async()=>{
 const values=[]
 for(const shape of ['overflow','eof','errored'])values.push(await exercise({shape,mode:shape==='eof'?'pending':'prompt'}))
 const [overflow,eof,errored]=values
 assert.ok(isPrimary(overflow.value,overflow.reason))
 assert.equal(eof.row.underlyingCancellationCalls,0,'A closed standard stream never invokes underlying pending cancel')
 assert.equal(errored.row.underlyingCancellationCalls,0,'An already-errored standard stream never invokes underlying cancel')
 assert.equal(errored.value.error,errored.fixture.record.readError)
 if(spec.key==='fullerton-pdf'){
  assert.equal(eof.value.ok,true)
  assert.equal(hash(eof.value.result),fullertonPDF.bodySHA256)
  assert.equal(eof.value.result.length,fullertonPDF.bodyBytes)
 }else assert.equal(eof.value.ok,false,'Neutral authored negative cannot supply employer/role/PDF qualification')
 for(const x of values){assert.equal(x.row.readerReleaseCalls,1);assert.equal(x.row.bodyLocked,false)}
 for(const row of eof.row.extraEOFReaders){assert.equal(row.readerReleaseCalls,1);assert.equal(row.bodyLocked,false)}
})

if(spec.key==='evidation')runCase('unchanged genuine sixteen-packet source retains finite native observations',async()=>{
 const oldFetch=globalThis.fetch,fixtures=[],calls=[]
 let task
 try{
  globalThis.fetch=async(url,init={})=>{
   const packet=archive.responses[calls.length]
   if(!packet||url!==packet.url)return requestFailure(url)
   assert.equal(init.method,'GET');assert.equal(init.body,undefined)
   const bytes=Buffer.from(packet.body,'utf8');assert.equal(bytes.length,packet.bytes);assert.equal(hash(bytes),packet.sha256)
   const fixture=nativeFixture({url:packet.finalUrl,status:packet.status,headers:packet.headers,bytes,shape:'eof'})
   fixtures.push(fixture);calls.push(url);return fixture.response
  }
  task=tracked(source.runNativeEvidation())
  await bounded(task.promise,15000)
  assert.equal(task.value.ok,true)
  const jobs=task.value.result,inventory=jobs[Symbol.for('jobverify.inventory-evidence')],proof=jobs[Symbol.for('jobverify.official-ats-discovery')]
  assert.equal(calls.length,16);assert.equal(jobs.length,0)
  assert.deepEqual(snapshot(inventory),snapshot(archive.result.inventory))
  assert.deepEqual(proof.nativeInventory,{observedNativeRows:3,observedUniqueRoles:3,observedIndiaRoles:0,snapshots:2,pagesPerSnapshot:2,allDetailsValidated:true})
  const value={jobs,inventory,officialAtsDiscovery:proof,nativeCollectionEvidence:jobs.nativeCollectionEvidence??null}
  const signature=hash(JSON.stringify(snapshot(value)))
  const readers=fixtures.map(item=>item.snapshot())
  observations.push({flow:spec.key,authored:false,retainedFixtureOnly:true,requests:calls.length,jobs:jobs.length,
   signature,signatureScope:'JSON-serializable jobs,inventory,official ATS discovery and nativeCollectionEvidence, recursively excluding five volatile timestamps; no Reflect-ownKeys comparison',
   inventory:snapshot(inventory),nativeInventory:proof.nativeInventory,readers})
  assert.ok(readers.every(row=>!row.bodyLocked&&row.readerReleaseCalls===1))
 }finally{globalThis.fetch=oldFetch;if(task)await bounded(task.promise,15000);for(const item of fixtures)item.finishFixture()}
})

if(spec.key==='licious')runCase('unchanged genuine forty-four-packet source retains full JSON models and scope holds',async()=>{
 const oldFetch=globalThis.fetch,fixtures=[],calls=[]
 let task
 try{
  globalThis.fetch=async(url,init={})=>{
   const packet=archive.packets[calls.length]
   if(!packet||url!==packet.requestedUrl)return requestFailure(url)
   assert.equal(init.method,packet.method);assert.equal(init.body??null,packet.requestBody)
   assert.deepEqual(Object.fromEntries(new Headers(init.headers)),packet.requestHeaders)
   assert.equal(init.redirect,packet.redirect)
   const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(bytes.length,packet.bodyBytes);assert.equal(hash(bytes),packet.sha256)
   const fixture=nativeFixture({url:packet.finalUrl,status:packet.status,headers:{'content-type':packet.contentType},bytes,shape:'eof'})
   fixtures.push(fixture);calls.push(url);return fixture.response
  }
  task=tracked(source.createNativeLiciousScraper().run())
  await bounded(task.promise,15000)
  assert.equal(task.value.ok,true)
  const jobs=task.value.result,inventory=jobs[Symbol.for('jobverify.inventory-evidence')]
  const output=Buffer.from(archive.fullOutputBase64,'base64');assert.equal(output.length,archive.fullOutputBytes);assert.equal(hash(output),archive.fullOutputSHA256)
  const expected=JSON.parse(output.toString('utf8'))
  const actual={jobs,inventory,observations:jobs.nativeCollectionEvidence??null}
  assert.deepEqual(snapshot(actual),snapshot(expected))
  assert.equal(calls.length,44);assert.equal(jobs.length,29)
  assert.equal(inventory.listingComplete,false);assert.equal(inventory.indiaFacetCount,null)
  assert.ok(jobs.every(row=>row.sourceDetailComplete&&row.country==='India'&&row.lifecycleCleanupAllowed===false))
  const readers=fixtures.map(item=>item.snapshot())
  observations.push({flow:spec.key,authored:false,retainedFixtureOnly:true,requests:calls.length,jobs:jobs.length,
   signature:hash(JSON.stringify(snapshot(actual))),expectedSignature:spec.expectedGenuineSignature,
   signatureScope:'JSON-serializable jobs,inventory and source-observation evidence, recursively excluding five volatile timestamps; default native clocks are untouched',
   inventory:snapshot(inventory),readers})
  // Lock ownership has its own causal case. Genuine output compatibility remains
  // independently measurable on the original source even while old locks leak.
 }finally{globalThis.fetch=oldFetch;if(task)await bounded(task.promise,15000);for(const item of fixtures)item.finishFixture()}
})

after(()=>{
 globalThis.fetch=()=>{counters.network++;throw Error('Physical fetch denied after source controls')}
 const guard=finishGuard()
 console.log('READER_CLEANUP_REMAINING_NINE '+JSON.stringify({...guard,flow:spec.key,plannedCases:spec.expectedCases,
  observations,applicationSubstitutions:0,clockOrSignalSubstitutions:0,publisherProgramsExecuted:0,pdfImplementationImportsGranted:0,
  scope:'One closed public flow. Actual body readers only; shared PDF declarations may import but extraction, PDF/native packages, generic runner and admission do not execute.'}))
})
