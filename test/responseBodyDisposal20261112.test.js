import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL, URL as NodeURL} from 'node:url'
import {createHash} from 'node:crypto'
import {isBuiltin, registerHooks, syncBuiltinESMExports} from 'node:module'
import childProcess from 'node:child_process'
import workerThreads from 'node:worker_threads'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'


const backend=path.resolve(process.env.HTTP_DISPOSAL_BACKEND||fileURLToPath(new NodeURL('../',import.meta.url)))
const self=fileURLToPath(import.meta.url),sha=raw=>createHash('sha256').update(raw).digest('hex')
const replayRoot=process.env.HTTP_DISPOSAL_PREIMAGE_ROOT?path.resolve(process.env.HTTP_DISPOSAL_PREIMAGE_ROOT):null
const replayNames=replayRoot?JSON.parse(process.env.HTTP_DISPOSAL_PREIMAGE_PATHS||'["scraper/btlindia/native.js","scraper/nitaragormalonellp/native.js"]'):[]
assert.ok(Array.isArray(replayNames)&&replayNames.every(name=>['scraper/btlindia/native.js','scraper/nitaragormalonellp/native.js','scraper-support/shared/responseBodyDisposal.js'].includes(name)))
if(!process.permission){
 test('Response disposal regression runs all source cases in a restricted child',()=>{
  const files=['scraper/btlindia/native.js','scraper/nitaragormalonellp/native.js',
   'scraper-support/shared/responseBodyDisposal.js','scraper-support/utils/visibleNativeHtml.js',
   'scraper-support/utils/activeNativeHtml.js','scraper-support/utils/inventoryEvidence.js',
   'scraper-support/utils/sourceObservationEvidence.js','src/utils/jobSourceContent.js','package.json']
  const args=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict',
   '--test-reporter=tap',...files.map(name=>'--allow-fs-read='+path.join(backend,name)),...replayNames.map(name=>'--allow-fs-read='+path.join(replayRoot,name)),'--allow-fs-read='+self,self]
  const env={...process.env,NODE_OPTIONS:'',HTTP_DISPOSAL_BACKEND:backend};delete env.NODE_TEST_CONTEXT
  const result=childProcess.spawnSync(process.execPath,args,{cwd:backend,env,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024})
  assert.equal(result.error,undefined,result.error?.message)
  const marker=result.stdout.split(/\r?\n/).find(line=>line.includes('HTTP_DISPOSAL_PROOF '))
  const guard=marker?JSON.parse(marker.split('HTTP_DISPOSAL_PROOF ')[1]):null
  const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name=>[name,Number(result.stdout.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]??-1)]))
  console.log('HTTP_DISPOSAL_CHILD '+JSON.stringify({arguments:args,exitCode:result.status,counts,guard,stdoutSHA256:sha(result.stdout),stderrSHA256:sha(result.stderr)}))
  assert.equal(result.status,0,result.stderr||result.stdout);assert.ok(guard)
  assert.ok(counts.tests>16);assert.equal(counts.pass,counts.tests)
  for(const name of['fail','cancelled','skipped','todo'])assert.equal(counts[name],0)
  assert.ok(Object.values(guard.attempts).every(value=>value===0));assert.equal(guard.cleanupTimers.pending,0)
  assert.equal(guard.cleanupTimers.created,guard.cleanupTimers.cleared)
  assert.ok(guard.files.every(item=>item.unchangedAtExit))
 })
}else{
// Authored transport controls use actual standard Response/ReadableStream
// objects. They make no external request or publisher/job qualification claim.
const RealResponse=globalThis.Response,RealReadableStream=globalThis.ReadableStream
const names=['scraper-support/shared/responseBodyDisposal.js','scraper/btlindia/native.js','scraper/nitaragormalonellp/native.js',
 'scraper-support/utils/visibleNativeHtml.js','scraper-support/utils/activeNativeHtml.js',
 'scraper-support/utils/inventoryEvidence.js','scraper-support/utils/sourceObservationEvidence.js','src/utils/jobSourceContent.js']
const allowed=new Set(names.map(name=>path.resolve(backend,name)))
const attempts={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0}
const deny=kind=>()=>{attempts[kind]++;throw Error('HTTP disposal proof denies '+kind)}
globalThis.fetch=deny('network')
for(const module of[http,https]){module.request=deny('network');module.get=deny('network')}
http2.connect=deny('network');net.connect=deny('network');net.createConnection=deny('network')
net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
tls.connect=deny('network');tls.createServer=deny('network');dgram.createSocket=deny('network')
for(const module of[dns,dns.promises])for(const key of Object.keys(module))if(/^(?:lookup|resolve|reverse)/.test(key)&&typeof module[key]==='function')module[key]=deny('network')
for(const key of['exec','execFile','spawn','fork','execSync','execFileSync','spawnSync'])childProcess[key]=deny('child')
workerThreads.Worker=class{constructor(){deny('worker')()}}
process.dlopen=deny('addon')
for(const module of[fs,fs.promises])for(const key of Object.keys(module))if(/^(?:write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(key)&&typeof module[key]==='function')module[key]=deny('fsWrite')
fs.createWriteStream=deny('fsWrite')
const open=fs.open,openSync=fs.openSync,promiseOpen=fs.promises.open,readOnly=flags=>flags==='r'||flags==='rs'||flags===0
fs.open=(filename,flags,...rest)=>readOnly(flags)?open(filename,flags,...rest):deny('fsWrite')()
fs.openSync=(filename,flags,...rest)=>readOnly(flags)?openSync(filename,flags,...rest):deny('fsWrite')()
fs.promises.open=(filename,flags,...rest)=>readOnly(flags)?promiseOpen(filename,flags,...rest):deny('fsWrite')()
syncBuiltinESMExports()
const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
assert.equal(typeof globalThis.DOMMatrix,'undefined')
const imported=new Map(),testSHA256=sha(fs.readFileSync(self))
registerHooks({resolve(specifier,context,next){
 if(/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier))return deny('database')()
 if(/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier))return deny('browser')()
 const result=next(specifier,context)
 if(!isBuiltin(result.url)&&(!result.url.startsWith('file:')||!allowed.has(fileURLToPath(result.url))))return deny('unexpectedModule')()
 return result
},load(url,context,next){
 if(url.startsWith('file:')){
  const filename=fileURLToPath(url);if(!allowed.has(filename))return deny('unexpectedModule')()
  const name=path.relative(backend,filename).replaceAll('\\','/'),workspaceRaw=fs.readFileSync(filename)
  const loadedFrom=replayNames.includes(name)?path.join(replayRoot,name):filename,raw=loadedFrom===filename?workspaceRaw:fs.readFileSync(loadedFrom)
  imported.set(filename,{path:name,sha256:sha(raw),bytes:raw.length,workspaceSHA256:sha(workspaceRaw),loadedFrom})
  if(loadedFrom!==filename)return{format:'module',shortCircuit:true,source:raw.toString('utf8')}
 }
 return next(url,context)
}})
const sources=[]
for(const source of['btlindia','nitaragormalonellp'])sources.push({source,read:(await import(pathToFileURL(path.join(backend,'scraper',source,'native.js')))).nativeFetch})
const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
const observations=[]
const rawSetTimeout=globalThis.setTimeout,rawClearTimeout=globalThis.clearTimeout
const cleanupHandles=new Set();let cleanupTimersCreated=0,cleanupTimersCleared=0
globalThis.setTimeout=(callback,ms,...rest)=>{const handle=rawSetTimeout(callback,ms,...rest);if(ms===1000){cleanupTimersCreated++;cleanupHandles.add(handle)}return handle}
globalThis.clearTimeout=handle=>{if(cleanupHandles.delete(handle))cleanupTimersCleared++;return rawClearTimeout(handle)}
const URL='https://authored-transport.invalid/careers'
const outcome=error=>({status:error?.status,code:error?.code,message:error?.message,causeMessage:error?.cause?.message})

for(const {source,read}of sources)for(const kind of['cancel-throw-403','cancel-reject-429','cancel-stall-503','caller-abort-stall','redirect-cancel-reject','ordinary-403','success-200','preabort']){
 test(source+' actual stream '+kind,{timeout:5000},async()=>{
  const entered=deferred(),release=deferred(),caller=new AbortController(),reason=Object.freeze({authoredCaller:source})
  let calls=0,cancels=0,settled=false,result
  const cleanup=Object.freeze(Error('Authored underlying cancellation failure'))
  const status=kind==='cancel-reject-429'?429:kind==='cancel-stall-503'?503:kind==='redirect-cancel-reject'||kind==='success-200'?200:403
  const stream=new RealReadableStream({cancel(){cancels++;entered.resolve();if(kind==='cancel-throw-403')throw cleanup;if(kind==='cancel-reject-429'||kind==='redirect-cancel-reject')return Promise.reject(cleanup);if(kind==='cancel-stall-503'||kind==='caller-abort-stall')return release.promise}})
  const response=new RealResponse(kind==='success-200'?'Authored plain response body, not publisher evidence.':stream,{status})
  Object.defineProperty(response,'url',{value:kind==='redirect-cancel-reject'?'https://authored-transport.invalid/other':URL})
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,URL);assert.ok(options.signal instanceof AbortSignal);return response}
  if(kind==='preabort')caller.abort(reason)
  const pending=reflect(read(URL,{signal:caller.signal}));pending.then(value=>{result=value;settled=true})
  try{
   if(kind==='cancel-stall-503'){
    await entered.promise;await pause(1200)
    observations.push({source,kind,settledBeforeCancelRelease:settled,cancels})
    assert.equal(settled,true,'Known HTTP503 must settle within disposal grace despite an unsettled underlying cancel')
    assert.equal(result.ok,false);assert.equal(result.reason.status,503)
   }else if(kind==='caller-abort-stall'){
    await entered.promise;caller.abort(reason);await pause(100)
    observations.push({source,kind,settledBeforeCancelRelease:settled,cancels})
    assert.equal(settled,true,'Caller cancellation must settle while underlying response cancellation remains pending')
    assert.equal(result.ok,false);assert.equal(result.reason,reason)
   }else{
    result=await pending
    observations.push({source,kind,ok:result.ok,observedError:outcome(result.reason),calls,cancels})
    if(kind==='success-200'){assert.equal(result.ok,true);assert.equal(result.value,'Authored plain response body, not publisher evidence.');assert.equal(cancels,0)}
    else if(kind==='preabort'){assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.equal(calls,0);assert.equal(cancels,0)}
    else if(kind==='redirect-cancel-reject'){assert.equal(result.ok,false);assert.match(result.reason.message,/unexpected native redirect/);assert.equal(cancels,1)}
    else{assert.equal(result.ok,false);assert.equal(result.reason.status,status,'Observed HTTP status must survive rejected cancellation');assert.equal(cancels,1)}
   }
  }finally{
   release.resolve();await pending;await turn();globalThis.fetch=deny('network')
  }
 })
}
after(()=>{
 const files=[...imported].map(([filename,item])=>({...item,unchangedAtExit:sha(fs.readFileSync(filename))===item.workspaceSHA256,effectiveSourceUnchangedAtExit:sha(fs.readFileSync(item.loadedFrom))===item.sha256}))
 assert.ok(files.every(item=>item.unchangedAtExit&&item.effectiveSourceUnchangedAtExit));assert.equal(sha(fs.readFileSync(self)),testSHA256)
 assert.ok(Object.values(attempts).every(value=>value===0));assert.equal(typeof globalThis.DOMMatrix,'undefined');assert.equal(cleanupHandles.size,0)
 globalThis.setTimeout=rawSetTimeout;globalThis.clearTimeout=rawClearTimeout
 console.log('HTTP_DISPOSAL_PROOF '+JSON.stringify({permissions,attempts,files,testSHA256,observations,cleanupTimers:{created:cleanupTimersCreated,cleared:cleanupTimersCleared,pending:cleanupHandles.size},authoredTransportOnly:true,externalRequests:0}))
})

const helperPath=path.join(backend,'scraper-support/shared/responseBodyDisposal.js')
const helper=async()=>{
 assert.equal(fs.existsSync(helperPath),true,'The shared bounded response disposer is required')
 return import(pathToFileURL(helperPath))
}
const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent disposal watchdog')),2500)})])}finally{clearTimeout(timer)}}
function targetFor(target,cancel){
 const stream=new RealReadableStream({cancel})
 if(target==='response')return{value:new RealResponse(stream),close(){}}
 const reader=stream.getReader();return{value:reader,close(){reader.releaseLock()}}
}
for(const target of['response','reader'])for(const bestEffort of[false,true])for(const mode of['reject','throw','pending','delayed']){
 test('disposer '+target+' '+mode+' bestEffort='+bestEffort,{timeout:5000},async()=>{
  const api=await helper(),dispose=target==='response'?api.disposeResponseBody:api.disposeResponseReader
  assert.equal(typeof dispose,'function')
  const entered=deferred(),release=deferred(),primary=Object.freeze(Error('Authored disposal rejection'))
  let calls=0,settled=false,result
  const owned=targetFor(target,()=>{calls++;entered.resolve();if(mode==='throw')throw primary;if(mode==='reject')return Promise.reject(primary);return release.promise})
  const pending=reflect(dispose(owned.value,{bestEffort}));pending.then(value=>{settled=true;result=value})
  try{
   await bounded(entered.promise)
   if(mode==='delayed'){
    await turn();assert.equal(settled,false,'Prompt owned disposal must complete before returning')
    release.resolve();result=await bounded(pending);assert.equal(result.ok,true)
   }else if(mode==='pending'){
    await pause(1200);assert.equal(settled,true,'A pending cancellation must have a bounded grace')
    assert.equal(result.ok,bestEffort);if(!bestEffort)assert.equal(result.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT')
   }else{
    result=await bounded(pending);assert.equal(result.ok,bestEffort);if(!bestEffort)assert.equal(result.reason,primary)
   }
   assert.equal(calls,1);observations.push({unit:target,mode,bestEffort,calls,ok:result.ok})
  }finally{release.resolve();await bounded(pending);owned.close()}
 })
}
for(const target of['response','reader'])for(const label of['null','false','zero','empty','frozen','default']){
 test('disposer '+target+' caller '+label+' wins pending cancellation',{timeout:5000},async()=>{
  const api=await helper(),dispose=target==='response'?api.disposeResponseBody:api.disposeResponseReader
  const caller=new AbortController(),entered=deferred(),late=deferred()
  const reason=label==='frozen'?Object.freeze({authoredCaller:target}):({null:null,false:false,zero:0,empty:''})[label]
  let calls=0,settled=false,result,rejectLate
  const lateRejection=new Promise((_,reject)=>{rejectLate=reject})
  const owned=targetFor(target,()=>{calls++;entered.resolve();return lateRejection})
  const pending=reflect(dispose(owned.value,{signal:caller.signal,bestEffort:true}));pending.then(value=>{settled=true;result=value})
  try{
   await bounded(entered.promise);if(label==='default')caller.abort();else caller.abort(reason)
   await turn();assert.equal(settled,true);assert.equal(result.ok,false);assert.equal(result.reason,caller.signal.reason)
   assert.equal(calls,1);observations.push({unit:target,mode:'caller-abort',reason:label,calls,exact:true})
  }finally{rejectLate(Object.freeze(Error('Authored late disposal rejection')));await bounded(pending);await turn();owned.close();late.resolve()}
 })
}
for(const bestEffort of[false,true])for(const mode of['return','pending']){
 test('disposer monotonic grace '+mode+' bestEffort='+bestEffort,{timeout:5000},async()=>{
  const {disposeResponseBody}=await helper(),descriptor=Object.getOwnPropertyDescriptor(performance,'now')
  let clock=0,settled=false,result,calls=0;const release=deferred()
  Object.defineProperty(performance,'now',{configurable:true,value:()=>clock})
  const response=new RealResponse(new RealReadableStream({cancel(){calls++;clock=1001;return mode==='pending'?release.promise:undefined}}))
  const pending=reflect(disposeResponseBody(response,{bestEffort}));pending.then(value=>{settled=true;result=value})
  try{
   await turn();assert.equal(settled,true,'Elapsed grace must settle before callback dispatch or late result release')
   assert.equal(result.ok,bestEffort);if(!bestEffort)assert.equal(result.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT')
   assert.equal(calls,1);observations.push({unit:'authored-clock',mode,bestEffort,settledBeforeTimer:true})
  }finally{release.resolve();await bounded(pending);if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now}
 })
}
for(const bestEffort of[false,true])for(const mode of['body-getter','cancel-getter']){
 test('disposer accessor '+mode+' bestEffort='+bestEffort,async()=>{
  const {disposeResponseBody}=await helper(),primary=Object.freeze(Error('Authored disposal accessor failure'))
  let getters=0
  const response=mode==='body-getter'?Object.defineProperty({},'body',{get(){getters++;throw primary}})
   :{body:Object.defineProperty({},'cancel',{get(){getters++;throw primary}})}
  const result=await reflect(disposeResponseBody(response,{bestEffort}));assert.equal(result.ok,bestEffort)
  if(!bestEffort)assert.equal(result.reason,primary);assert.equal(getters,1)
 })
}
test('disposer accepts an actual bodyless Response without cancellation',async()=>{
 const {disposeResponseBody}=await helper();await disposeResponseBody(new RealResponse(null,{status:204}))
})

for(const {source,read}of sources)for(const phase of['headers','cleanup']){
 test(source+' request deadline phase '+phase,{timeout:5000},async()=>{
  // Authored delivered-timeout state only; no physical duration or publisher
  // response fact is claimed by this request-phase boundary control.
  const original=AbortSignal.timeout,owned=new AbortController()
  const timeout=Object.freeze(Object.assign(Error('Authored delivered request timeout'),{name:'TimeoutError'}))
  let deadlines=0,cancels=0
  AbortSignal.timeout=ms=>{assert.equal(ms,20000);deadlines++;return owned.signal}
  const response=new RealResponse(new RealReadableStream({cancel(){cancels++;if(phase==='cleanup')owned.abort(timeout)}}),{status:403})
  Object.defineProperty(response,'url',{value:URL})
  globalThis.fetch=async()=>{if(phase==='headers')owned.abort(timeout);return response}
  try{
   const result=await reflect(read(URL))
   assert.equal(result.ok,false);assert.equal(deadlines,1)
   if(phase==='headers'){assert.equal(result.reason,timeout);assert.equal(cancels,0)}
   else{assert.equal(result.reason.status,403,'An owned timeout delivered during failure disposal must retain the already-observed HTTP403');assert.equal(cancels,1)}
   observations.push({source,unit:'request-phase',phase,deadlines,cancels,expectedReason:true})
  }finally{AbortSignal.timeout=original;globalThis.fetch=deny('network')}
 })
}

for(const target of['response','reader'])for(const label of['absent','undefined','null','false','zero','empty','frozen']){
 test('disposer '+target+' cancellation argument '+label,async()=>{
  const api=await helper(),dispose=target==='response'?api.disposeResponseBody:api.disposeResponseReader
  const reason=label==='frozen'?Object.freeze({authoredCancellationReason:true}):({null:null,false:false,zero:0,empty:''})[label]
  let underlyingCalls=0,underlyingReason,methodCalls=0,arity
  const owned=targetFor(target,value=>{underlyingCalls++;underlyingReason=value})
  const receiver=target==='response'?owned.value.body:owned.value,original=receiver.cancel
  Object.defineProperty(receiver,'cancel',{configurable:true,value:function(...args){
   assert.equal(this,receiver);methodCalls++;arity=args.length;return Reflect.apply(original,this,args)
  }})
  try{
   await dispose(owned.value,label==='absent'?undefined:{reason})
   assert.equal(methodCalls,1);assert.equal(underlyingCalls,1)
   assert.equal(arity,label==='absent'?0:1,'Explicit cancellation reason must retain argument arity')
   assert.equal(underlyingReason,reason,'Underlying stream cancellation must receive the exact existing reason')
  }finally{owned.close()}
 })
}

}
