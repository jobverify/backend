import assert from 'node:assert/strict'
import test, {after} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
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

// Authored standard-stream transport controls only. Corporate/policy strings
// identify the real source boundary; no response is a new publisher observation.
assert.ok(process.permission)
const backend=path.resolve(process.env.HTTP_DISPOSAL_BACKEND)
const self=fileURLToPath(import.meta.url),here=path.dirname(self)
const manifestPath=path.resolve(process.env.HTTP_DISPOSAL_CLOSURE||path.join(here,'closure-v2.json'))
const sha=raw=>createHash('sha256').update(raw).digest('hex')
const realRead=fs.readFileSync,manifest=JSON.parse(realRead(manifestPath,'utf8'))
const testSHA256=sha(realRead(self)),manifestSHA256=sha(realRead(manifestPath))
const RealResponse=globalThis.Response,RealReadableStream=globalThis.ReadableStream
const modulePins=new Map(manifest.modules.map(row=>[path.resolve(backend,row.path),row]))
const filePins=new Map([...manifest.modules,...manifest.additional_reads].map(row=>[path.resolve(backend,row.path),row]))
const readable=new Set([...filePins.keys(),self,manifestPath,...manifest.absent_allowed_read_paths.map(name=>path.resolve(backend,name))])
for(const [filename,pin]of filePins){const raw=realRead(filename);assert.equal(sha(raw),pin.sha256,filename);assert.equal(raw.length,pin.bytes)}
const attempts={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0}
const deny=kind=>()=>{attempts[kind]++;throw Error('Next RMK response disposal denies '+kind)}
globalThis.fetch=deny('network')
for(const module of[http,https]){module.request=deny('network');module.get=deny('network')}
http2.connect=deny('network');net.connect=deny('network');net.createConnection=deny('network');net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
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
const readPaths=new Set()
fs.readFileSync=(filename,...args)=>{
 const resolved=path.resolve(filename instanceof URL?fileURLToPath(filename):String(filename))
 if(!readable.has(resolved))return deny('unexpectedRead')()
 readPaths.add(resolved);return realRead(filename,...args)
}
syncBuiltinESMExports()
const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
assert.equal(typeof globalThis.DOMMatrix,'undefined')
const imported=new Map()
registerHooks({resolve(specifier,context,next){
 if(/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier))return deny('database')()
 if(/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier))return deny('browser')()
 const result=next(specifier,context)
 if(isBuiltin(result.url)&&context.parentURL?.startsWith('file:')&&modulePins.has(fileURLToPath(context.parentURL))&&!manifest.source_builtins.includes(result.url))return deny('unexpectedModule')()
 if(!isBuiltin(result.url)&&(!result.url.startsWith('file:')||!modulePins.has(fileURLToPath(result.url))))return deny('unexpectedModule')()
 return result
},load(url,context,next){
 if(url.startsWith('file:')){
  const filename=fileURLToPath(url),pin=modulePins.get(filename)
  if(!pin)return deny('unexpectedModule')()
  const raw=fs.readFileSync(filename);assert.equal(sha(raw),pin.sha256,filename)
  imported.set(filename,{path:pin.path,sha256:sha(raw),bytes:raw.length})
 }
 return next(url,context)
}})
// PREPARED ONLY: source execution requires a separate exact root runtime GO.
const modules={}
for(const name of manifest.entries)modules[name]=await import(pathToFileURL(path.join(backend,name)))
const FC=modules['scraper/firstcitizensindia/script.js']
const HERSHEY=modules['scraper/hershey.workday/script.js']
const HUBBELL=modules['scraper/hubbell.workday/script.js']
const FC_HOME='https://www.firstcitizens.com/'
const FC_LIMIT=2*1024*1024
const nativeTimeout=AbortSignal.timeout,nativePerformanceNow=performance.now
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const observe=operation=>{
 const box={settled:false,result:null}
 box.pending=Promise.resolve(operation).then(value=>({ok:true,value}),reason=>({ok:false,reason})).then(result=>{box.settled=true;box.result=result;return result})
 return box
}
const bounded=async(promise,milliseconds)=>{
 let timer
 try{return await Promise.race([promise.then(value=>({settled:true,value})),new Promise(resolve=>{timer=setTimeout(()=>resolve({settled:false}),milliseconds)})])}finally{clearTimeout(timer)}
}
const until=async(box,milliseconds)=>{await bounded(box.pending,milliseconds);return box.settled}
const entered=async(promise,label,milliseconds=300)=>assert.equal((await bounded(promise,milliseconds)).settled,true,label)
const opaque=()=>Object.freeze(Object.defineProperties({authoredCaller:true},{message:{get(){throw Error('Caller message accessor must not be read')}},code:{get(){throw Error('Caller code accessor must not be read')}}}))
const failureRecord=result=>result===null?null:result.ok?{ok:true}:{ok:false,reasonType:typeof result.reason,...(result.reason instanceof Error?{name:result.reason.name,message:result.reason.message,code:result.reason.code}:{})}
const observations=[],registered=[]
const runCase=(name,body)=>{registered.push(name);test(name,{concurrency:false,timeout:40000},body)}
const packet=(body,url,status=200,headers={'content-type':'text/html'})=>{
 const response=new RealResponse(body,{status,headers})
 Object.defineProperty(response,'url',{value:url})
 return response
}
// All readers and streams below are actual platform objects. Wrappers only
// observe receiver/argument count, then return the unchanged native operation.
const streamControl=({body='active',cancel='resolve',size=0}={})=>{
 const cancellationEntered=deferred(),readerEntered=deferred(),gate=deferred()
 const cleanupError=Object.freeze(Error('AUTHORED active underlying cancellation rejection'))
 const readError=Object.freeze(Error('AUTHORED already-errored stream reason'))
 const underlying={start(controller){
  if(body==='overflow')controller.enqueue(new Uint8Array(size))
  else if(body==='eof'){controller.enqueue(new TextEncoder().encode('<html><head><title>AUTHORED protocol control</title></head><body>AUTHORED nonqualifying control</body></html>'));controller.close()}
  else if(body==='errored')controller.error(readError)
 },cancel(...args){
  state.underlyingCalls++;state.underlyingReceiverExact=this===underlying;state.underlyingArity=args.length;state.underlyingReason=args[0]
  cancellationEntered.resolve()
  if(cancel==='reject')return Promise.reject(cleanupError)
  if(cancel==='throw')throw cleanupError
  if(cancel==='pending'||cancel==='prompt')return gate.promise
 }}
 const state={underlyingCalls:0,underlyingReceiverExact:null,underlyingArity:null,underlyingReason:undefined,bodyCalls:[],readerCalls:[],releaseCalls:[],readers:[]}
 const stream=new RealReadableStream(underlying)
 const nativeBodyCancel=stream.cancel,nativeGetReader=stream.getReader
 Object.defineProperty(stream,'cancel',{value:function(...args){
  state.bodyCalls.push({receiverExact:this===stream,arity:args.length,reasonUndefined:args[0]===undefined})
  return Reflect.apply(nativeBodyCancel,this,args)
 }})
 Object.defineProperty(stream,'getReader',{value:function(...args){
  assert.equal(this,stream)
  const reader=Reflect.apply(nativeGetReader,this,args),nativeCancel=reader.cancel,nativeRelease=reader.releaseLock
  state.readers.push({reader,nativeRelease});readerEntered.resolve()
  Object.defineProperty(reader,'cancel',{value:function(...cancelArgs){
   state.readerCalls.push({receiverExact:this===reader,arity:cancelArgs.length,reasonUndefined:cancelArgs[0]===undefined})
   return Reflect.apply(nativeCancel,this,cancelArgs)
  }})
  Object.defineProperty(reader,'releaseLock',{value:function(...releaseArgs){
   state.releaseCalls.push({receiverExact:this===reader,arity:releaseArgs.length})
   return Reflect.apply(nativeRelease,this,releaseArgs)
  }})
  return reader
 }})
 return{stream,state,cleanupError,readError,cancellationEntered,readerEntered,resolve:gate.resolve,reject:gate.reject,
  snapshot:()=>({underlyingCalls:state.underlyingCalls,underlyingReceiverExact:state.underlyingReceiverExact,underlyingArity:state.underlyingArity,underlyingReasonType:typeof state.underlyingReason,bodyCalls:[...state.bodyCalls],readerCalls:[...state.readerCalls],releaseCalls:[...state.releaseCalls],readerCount:state.readers.length,locked:stream.locked}),
  rescueRelease(){for(const {reader,nativeRelease}of state.readers)try{Reflect.apply(nativeRelease,reader,[])}catch{}},
 }
}
const readerContract=control=>{
 assert.equal(control.state.readerCalls.length,1,'Source must admit actual reader cancellation exactly once')
 assert.deepEqual(control.state.readerCalls[0],{receiverExact:true,arity:0,reasonUndefined:true})
 assert.equal(control.state.releaseCalls.length,1,'Source must release its actual reader on this path')
 assert.deepEqual(control.state.releaseCalls[0],{receiverExact:true,arity:0})
 assert.equal(control.stream.locked,false,'Source reader lock must be released before source settlement')
}
const bodyContract=control=>{
 assert.equal(control.state.bodyCalls.length,1,'Unread response body cancellation must be admitted exactly once')
 assert.deepEqual(control.state.bodyCalls[0],{receiverExact:true,arity:0,reasonUndefined:true})
 assert.equal(control.state.readers.length,0,'Unread HTTP/redirect cleanup must not acquire a reader')
 assert.equal(control.state.underlyingCalls,1)
 assert.equal(control.state.underlyingReceiverExact,true)
}
const intercept=(allowed,handler,calls)=>{globalThis.fetch=async(input,init={})=>{
 const url=String(input)
 if(!allowed.includes(url))return deny('unexpectedRequest')()
 assert.equal(init.method||'GET','GET');assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal)
 calls.push({url,method:init.method||'GET',redirect:init.redirect,credentials:init.credentials,abortedAtAdmission:init.signal.aborted})
 return handler(url,init)
}}
const finish=(t,name,control,box,calls,extra=()=>({}))=>t.after(async()=>{
 // Snapshot source behavior before any harness rescue. Rescue never counts as
 // a source releaseLock call and does not turn a failed source assertion green.
 const record={name,sourceSettled:box?.settled??null,outcome:failureRecord(box?.result??null),calls:[...calls],stream:control?.snapshot()??null,...extra()}
 observations.push(record)
 control?.resolve()
 if(box)assert.equal(await until(box,400),true,'Authored test housekeeping must settle after underlying cancellation is released')
 record.afterGateRescue={authoredGateReleased:true,outcome:failureRecord(box?.result??null),calls:[...calls],streamBeforeNativeLockRescue:control?.snapshot()??null,...extra()}
 control?.rescueRelease()
 globalThis.fetch=deny('network')
})
const firstCitizens=(t,name,options={})=>{
 const control=streamControl({body:options.body??'overflow',cancel:options.cancel??'resolve',size:FC_LIMIT+1}),calls=[]
 intercept([FC_HOME],(url,init)=>{options.onFetch?.(init);const response=packet(control.stream,url);return options.responseGate?options.responseGate(init,response):response},calls)
 const box=observe(FC.run({signal:options.signal}))
 finish(t,name,control,box,calls,options.extra)
 return{control,box,calls}
}
const budgetFailure=result=>{assert.equal(result.ok,false);assert.equal(result.reason.code,'NATIVE_COUNTRY_INVENTORY');assert.match(result.reason.message,/native response body budget exceeded/)}
const httpFailure=(result,status)=>{assert.equal(result.ok,false);assert.match(result.reason.message,new RegExp('Native HTTP '+status))}
const rmk=(t,name,{facade=HERSHEY,status=403,cancel='resolve',signal,redirect=false,invalid=false,eof=false,onFetch,responseGate,extra}={})=>{
 const control=streamControl({body:eof?'eof':'active',cancel}),calls=[],home=facade.NATIVE_CONFIG.home
 const destination=redirect?new URL(facade.NATIVE_CONFIG.homeRedirectPath,home).href:facade.NATIVE_CONFIG.origin+'/'
 intercept([home,destination],(url,init)=>{
  onFetch?.(url,init)
  if(url!==home)return packet(null,url,503,{})
  if(eof)return packet(control.stream,url)
  const response=packet(control.stream,url,status,redirect?{location:invalid?'https://foreign.invalid/roles':facade.NATIVE_CONFIG.homeRedirectPath}:{})
  return responseGate?responseGate(init,response):response
 },calls)
 const box=observe(facade.run({signal,now:'2026-11-12T00:00:00.000Z'}))
 finish(t,name,control,box,calls,extra)
 return{control,box,calls,home,destination}
}
// Real-time phase probes. The native timeout factory and monotonic clock are
// observed unchanged. Only offline response-header delivery is controlled.
const nativePhase=(milliseconds,{onNativeAbort}={})=>{
 const began=performance.now(),events=[],aborted=deferred()
 let requestSignal=null,requestAt=null,headerDelivery='immediate response control'
 const mark=(event,detail={})=>{const now=performance.now();events.push({event,elapsedMs:now-began,requestElapsedMs:requestAt===null?null:now-requestAt,...detail})}
 const attach=init=>{
  assert.equal(requestSignal,null,'One actual native request signal per phase control')
  assert.equal(AbortSignal.timeout,nativeTimeout);assert.equal(performance.now,nativePerformanceNow)
  requestSignal=init.signal;requestAt=performance.now();mark('request-admitted')
  assert.equal(requestSignal.aborted,false)
  requestSignal.addEventListener('abort',()=>{
   mark('native-request-abort',{reasonName:requestSignal.reason.name})
   onNativeAbort?.({mark,signal:requestSignal})
   aborted.resolve(requestSignal.reason)
  },{once:true})
 }
 const waitForAbort=async()=>{
  const result=await bounded(aborted.promise,milliseconds+1500)
  assert.equal(result.settled,true,'Actual native source request timeout must deliver')
  assert.equal(requestSignal.reason,result.value);assert.equal(result.value.name,'TimeoutError')
  const event=events.find(row=>row.event==='native-request-abort')
  assert.ok(event.requestElapsedMs>=milliseconds-1000,'Native request clock was not shortened')
  assert.ok(event.requestElapsedMs<milliseconds+5000,'Native request clock must deliver within measured watchdog slack')
  return result.value
 }
 const delayHeaders=(init,response)=>new Promise((resolve,reject)=>{
  headerDelivery='delayed response headers'
  let timer
  const rejectAbort=()=>{clearTimeout(timer);mark('headers-aborted-before-delivery');reject(init.signal.reason)}
  init.signal.addEventListener('abort',rejectAbort,{once:true})
  timer=setTimeout(()=>{
   init.signal.removeEventListener('abort',rejectAbort)
   if(init.signal.aborted){mark('headers-timer-found-abort');reject(init.signal.reason);return}
   mark('headers-delivered');resolve(response)
  },milliseconds-500)
 })
 const holdHeaders=init=>new Promise((_,reject)=>{
  headerDelivery='withheld until native abort'
  init.signal.addEventListener('abort',()=>{mark('headers-withheld-until-native-abort');reject(init.signal.reason)},{once:true})
 })
 return{attach,mark,waitForAbort,delayHeaders,holdHeaders,snapshot:()=>({sourceRequestTimeoutMs:milliseconds,headerDelivery,headerDelayTargetMs:headerDelivery==='delayed response headers'?milliseconds-500:null,events:events.map(row=>({...row})),nativeFactoryUnchanged:AbortSignal.timeout===nativeTimeout,monotonicClockUnchanged:performance.now===nativePerformanceNow})}
}

runCase('FC01 active byte-budget / cancellation rejection keeps primary and releases reader',async t=>{
 const name=t.name,{control,box}=firstCitizens(t,name,{cancel:'reject'})
 assert.equal(await until(box,300),true);budgetFailure(box.result);readerContract(control)
})
runCase('FC02 active byte-budget / pending cancellation has finite best-effort grace',async t=>{
 const {control,box}=firstCitizens(t,t.name,{cancel:'pending'})
 await entered(control.cancellationEntered.promise,'Active overflow must enter native cancellation')
 assert.equal(await until(box,1500),true,'Known byte-budget failure must settle during finite cleanup grace')
 budgetFailure(box.result);readerContract(control)
 // A late underlying rejection must remain observed under strict unhandled mode.
 control.reject(control.cleanupError);await turn()
})
runCase('FC03 prompt active cleanup remains owned before byte-budget failure',async t=>{
 const {control,box}=firstCitizens(t,t.name,{cancel:'prompt'})
 await entered(control.cancellationEntered.promise,'Prompt cleanup must be admitted');await turn()
 assert.equal(box.settled,false);control.resolve();assert.equal(await until(box,300),true);budgetFailure(box.result);readerContract(control)
})
for(const [label,reason]of[['null',null],['opaque-accessor-object',opaque()]])runCase('FC caller '+label+' during active cleanup stays exact',async t=>{
 const caller=new AbortController(),{control,box}=firstCitizens(t,t.name,{cancel:'pending',signal:caller.signal})
 await entered(control.cancellationEntered.promise,'Cleanup admitted before caller abort');caller.abort(reason)
 assert.equal(await until(box,200),true,'Caller abort must not wait behind pending underlying cancel')
 assert.equal(box.result.ok,false);assert.equal(box.result.reason,reason);readerContract(control)
})
runCase('FC06 caller zero during bounded pending read stays exact through pending cancellation',async t=>{
 const caller=new AbortController(),{control,box}=firstCitizens(t,t.name,{body:'active',cancel:'pending',signal:caller.signal})
 await entered(control.readerEntered.promise,'Actual reader acquired');await turn();caller.abort(0)
 await entered(control.cancellationEntered.promise,'Read-abort cleanup admitted')
 assert.equal(await until(box,200),true);assert.equal(box.result.ok,false);assert.equal(box.result.reason,0);readerContract(control)
})
runCase('FC07 closed EOF does not invoke pending underlying cancellation; reader released',async t=>{
 const {control,box}=firstCitizens(t,t.name,{body:'eof',cancel:'pending'})
 assert.equal(await until(box,300),true);assert.equal(box.result.ok,false)
 assert.match(box.result.reason.message,/current publisher identity changed/)
 assert.equal(control.state.underlyingCalls,0,'Native closed EOF cancel never calls underlying cancel')
 readerContract(control)
})
runCase('FC08 already-errored stream preserves original and does not invoke underlying cancel',async t=>{
 const {control,box}=firstCitizens(t,t.name,{body:'errored',cancel:'pending'})
 assert.equal(await until(box,300),true);assert.equal(box.result.ok,false);assert.equal(box.result.reason,control.readError)
 assert.equal(control.state.underlyingCalls,0);readerContract(control)
})
runCase('FC09 current facade pre-aborted symbol makes no request',async t=>{
 const reason=Symbol('AUTHORED FC preabort'),calls=[]
 intercept([FC_HOME],()=>assert.fail('No pre-aborted request'),calls)
 const box=observe(FC.run({signal:AbortSignal.abort(reason)}));finish(t,t.name,null,box,calls)
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);assert.equal(calls.length,0)
})

runCase('RMK01 Hershey known HTTP403 survives rejected unread-body cancellation',async t=>{
 const {control,box,calls}=rmk(t,t.name,{cancel:'reject'})
 assert.equal(await until(box,300),true);httpFailure(box.result,403);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK02 Hershey known HTTP429 survives bounded pending unread-body cancellation',async t=>{
 const {control,box,calls}=rmk(t,t.name,{status:429,cancel:'pending'})
 await entered(control.cancellationEntered.promise,'Unread HTTP cancellation admitted')
 assert.equal(await until(box,1500),true,'Known HTTP error must survive finite cleanup grace')
 httpFailure(box.result,429);bodyContract(control);assert.equal(calls.length,1)
 control.reject(control.cleanupError);await turn()
})
runCase('RMK03 Hershey known HTTP403 owns prompt cancellation before reporting',async t=>{
 const {control,box,calls}=rmk(t,t.name,{cancel:'prompt'})
 await entered(control.cancellationEntered.promise,'Prompt HTTP cleanup admitted');await turn();assert.equal(box.settled,false)
 control.resolve();assert.equal(await until(box,300),true);httpFailure(box.result,403);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK04 Hershey null caller during pending HTTP cleanup stays exact',async t=>{
 const caller=new AbortController(),{control,box,calls}=rmk(t,t.name,{cancel:'pending',signal:caller.signal})
 await entered(control.cancellationEntered.promise,'Primary HTTP observed before caller abort');caller.abort(null)
 assert.equal(await until(box,200),true);assert.equal(box.result.ok,false);assert.equal(box.result.reason,null);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK05 Hubbell valid redirect cleanup rejection forbids destination GET',async t=>{
 const {control,box,calls}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,cancel:'reject'})
 assert.equal(await until(box,300),true);assert.equal(box.result.ok,false);assert.equal(box.result.reason,control.cleanupError)
 bodyContract(control);assert.equal(calls.length,1,'Valid redirect needs successful strict cleanup before continuation')
})
runCase('RMK06 Hubbell valid redirect pending cleanup expires strictly without continuation',async t=>{
 const {control,box,calls}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,cancel:'pending'})
 await entered(control.cancellationEntered.promise,'Strict redirect cancellation admitted')
 assert.equal(await until(box,1500),true);assert.equal(box.result.ok,false);assert.equal(box.result.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT')
 bodyContract(control);assert.equal(calls.length,1)
 control.reject(control.cleanupError);await turn()
})
runCase('RMK07 Hubbell valid redirect owns prompt cleanup before destination GET',async t=>{
 const {control,box,calls,destination}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,cancel:'prompt'})
 await entered(control.cancellationEntered.promise,'Strict prompt redirect cleanup admitted');await turn()
 assert.equal(box.settled,false);assert.equal(calls.length,1);control.resolve()
 assert.equal(await until(box,300),true);httpFailure(box.result,503);bodyContract(control)
 assert.deepEqual(calls.map(row=>row.url),[HUBBELL.NATIVE_CONFIG.home,destination])
})
runCase('RMK08 Hubbell opaque caller during pending valid redirect forbids continuation',async t=>{
 const caller=new AbortController(),reason=opaque(),{control,box,calls}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,cancel:'pending',signal:caller.signal})
 await entered(control.cancellationEntered.promise,'Redirect observed before caller abort');caller.abort(reason)
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK09 invalid foreign redirect keeps validation primary when cleanup rejects',async t=>{
 const {control,box,calls}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,invalid:true,cancel:'reject'})
 assert.equal(await until(box,300),true);assert.equal(box.result.ok,false);assert.notEqual(box.result.reason,control.cleanupError)
 assert.match(box.result.reason.message,/Unapproved native GET or redirect origin/);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK10 successful EOF consumption does not cancel the already-consumed home body',async t=>{
 const {control,box,calls}=rmk(t,t.name,{eof:true,cancel:'pending'})
 assert.equal(await until(box,300),true);httpFailure(box.result,503)
 assert.equal(control.state.underlyingCalls,0);assert.equal(control.state.bodyCalls.length,0);assert.equal(calls.length,2)
})
for(const [facade,label,reason]of[[HERSHEY,'Hershey-zero',0],[HUBBELL,'Hubbell-symbol',Symbol('AUTHORED RMK preabort')]])runCase('RMK pre-aborted '+label+' caller makes no GET',async t=>{
 const calls=[];intercept([facade.NATIVE_CONFIG.home],()=>assert.fail('No pre-aborted native GET'),calls)
 const box=observe(facade.run({signal:AbortSignal.abort(reason)}));finish(t,t.name,null,box,calls)
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);assert.equal(calls.length,0)
})

runCase('FC10 native request expiry before headers wins without a response or reader',async t=>{
 const phase=nativePhase(20000),calls=[]
 intercept([FC_HOME],(_url,init)=>{phase.attach(init);return phase.holdHeaders(init)},calls)
 const box=observe(FC.run());finish(t,t.name,null,box,calls,()=>({phase:phase.snapshot()}))
 const reason=await phase.waitForAbort()
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);assert.equal(calls.length,1)
})
runCase('FC11 native request expiry during read stays exact without waiting for pending cancel',async t=>{
 const phase=nativePhase(20000),{control,box}=firstCitizens(t,t.name,{body:'active',cancel:'pending',onFetch:phase.attach,extra:()=>({phase:phase.snapshot()})})
 await entered(control.readerEntered.promise,'Read acquired before actual native expiry');phase.mark('reader-acquired')
 const reason=await phase.waitForAbort()
 await entered(control.cancellationEntered.promise,'Own-timeout cleanup admitted');phase.mark('cleanup-admitted-after-native-abort')
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);readerContract(control)
})
runCase('FC12 observed byte-budget primary owns prompt cleanup across actual later request expiry',async t=>{
 const phase=nativePhase(20000),{control,box}=firstCitizens(t,t.name,{cancel:'prompt',onFetch:phase.attach,responseGate:phase.delayHeaders,extra:()=>({phase:phase.snapshot()})})
 await entered(control.cancellationEntered.promise,'Byte-budget error must precede actual native request expiry',21500);phase.mark('byte-budget-cleanup-admitted')
 await phase.waitForAbort();await turn()
 assert.equal(box.settled,false,'Later native request expiry must not replace observed byte-budget failure or detach prompt cleanup')
 phase.mark('authored-prompt-cleanup-resolved');control.resolve()
 assert.equal(await until(box,300),true);budgetFailure(box.result);readerContract(control)
})
runCase('RMK13 native request expiry before headers stays exact without cleanup',async t=>{
 const phase=nativePhase(30000),calls=[]
 intercept([HERSHEY.NATIVE_CONFIG.home],(_url,init)=>{phase.attach(init);return phase.holdHeaders(init)},calls)
 const box=observe(HERSHEY.run());finish(t,t.name,null,box,calls,()=>({phase:phase.snapshot()}))
 const reason=await phase.waitForAbort()
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);assert.equal(calls.length,1)
})
runCase('RMK14 observed HTTP403 owns prompt cleanup across actual later request expiry',async t=>{
 const phase=nativePhase(30000),{control,box,calls}=rmk(t,t.name,{cancel:'prompt',onFetch:(url,init)=>{if(url===HERSHEY.NATIVE_CONFIG.home)phase.attach(init);else phase.mark('later-native-GET-observed',{url})},responseGate:phase.delayHeaders,extra:()=>({phase:phase.snapshot()})})
 await entered(control.cancellationEntered.promise,'HTTP403 must precede actual native request expiry',31500);phase.mark('known-HTTP403-cleanup-admitted')
 await phase.waitForAbort();await turn()
 assert.equal(box.settled,false,'Later native request expiry must not mask known HTTP403 or detach prompt cleanup')
 phase.mark('authored-prompt-cleanup-resolved');control.resolve()
 assert.equal(await until(box,300),true);httpFailure(box.result,403);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK15 actual native redirect request expiry forbids destination while cancel stays pending',async t=>{
 const phase=nativePhase(30000),{control,box,calls}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,cancel:'pending',onFetch:(url,init)=>{if(url===HUBBELL.NATIVE_CONFIG.home)phase.attach(init);else phase.mark('later-native-GET-observed',{url})},responseGate:phase.delayHeaders,extra:()=>({phase:phase.snapshot()})})
 await entered(control.cancellationEntered.promise,'Valid redirect cleanup must precede actual native request expiry',31500);phase.mark('valid-redirect-cleanup-admitted')
 const reason=await phase.waitForAbort()
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);bodyContract(control);assert.equal(calls.length,1)
})
runCase('RMK16 opaque caller beats actual native composite timeout in the same delivery turn',async t=>{
 const caller=new AbortController(),reason=opaque()
 const phase=nativePhase(30000,{onNativeAbort:({mark,signal})=>{
  assert.equal(signal.aborted,true);mark('native-composite-aborted-before-external-caller')
  caller.abort(reason);mark('external-caller-aborted-same-turn',{callerReasonIdentityExact:caller.signal.reason===reason})
 }})
 const {control,box,calls}=rmk(t,t.name,{facade:HUBBELL,status:301,redirect:true,cancel:'pending',signal:caller.signal,onFetch:(url,init)=>{if(url===HUBBELL.NATIVE_CONFIG.home)phase.attach(init);else phase.mark('later-native-GET-observed',{url})},responseGate:phase.delayHeaders,extra:()=>({phase:phase.snapshot()})})
 await entered(control.cancellationEntered.promise,'Strict cleanup admitted before actual native/external aborts',31500);phase.mark('valid-redirect-cleanup-admitted')
 await phase.waitForAbort()
 assert.equal(await until(box,200),true);assert.equal(box.result.reason,reason);bodyContract(control);assert.equal(calls.length,1)
})

assert.equal(registered.length,manifest.expected_cases)
after(()=>{
 const files=[...imported].map(([filename,row])=>({...row,unchangedAtExit:sha(fs.readFileSync(filename))===row.sha256}))
 assert.equal(files.length,modulePins.size)
 assert.ok(files.every(row=>row.unchangedAtExit))
 assert.equal(sha(fs.readFileSync(self)),testSHA256);assert.equal(sha(fs.readFileSync(manifestPath)),manifestSHA256)
 assert.ok(Object.values(attempts).every(value=>value===0),JSON.stringify(attempts))
 assert.equal(AbortSignal.timeout,nativeTimeout);assert.equal(performance.now,nativePerformanceNow);assert.equal(typeof globalThis.DOMMatrix,'undefined')
 console.log('READER_CLEANUP_NEXT_RMK '+JSON.stringify({permissions,attempts,files,testSHA256,manifestSHA256,registered,observations,logicalReadPaths:[...readPaths].map(filename=>path.relative(backend,filename).replaceAll('\\','/')),authoredProtocolOnly:true,sourceOrBackendTestsEdited:false,externalRequests:0,actualStandardResponsesAndStreams:true,sourceClockParametersChanged:false,nativeRequestExpiryObserved:true,timeoutFactorySubstituted:false,monotonicClockSubstituted:false,fixtureReplayed:false}))
})
