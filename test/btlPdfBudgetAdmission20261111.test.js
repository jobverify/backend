import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {getEventListeners} from 'node:events'
import {registerHooks,syncBuiltinESMExports} from 'node:module'
import childProcess from 'node:child_process'
import workerThreads from 'node:worker_threads'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'

// Retained acquisition bytes plus labelled authored import/decoder failures.
// No protocol below parses a PDF, returns a model or establishes native facts.
const backend=path.resolve(process.env.BTL_PDF_BUDGET_BACKEND||fileURLToPath(new URL('../',import.meta.url)))
const self=fileURLToPath(import.meta.url),marker='--btl-pdf-budget-source',sha=value=>createHash('sha256').update(value).digest('hex')
const reasonFor=label=>label==='frozen'?Object.freeze(Error('Authored frozen synchronous-load caller')):({null:null,false:false,zero:0,empty:''})[label]

async function sourceCase(route,mode,label){
 const attempts={network:0,database:0,browser:0,childWorker:0},imported=new Map()
 const deny=()=>{attempts.network++;throw Error('BTL PDF budget controls deny physical network I/O')}
 globalThis.fetch=deny
 for(const module of [http,https]){module.request=deny;module.get=deny}
 http2.connect=deny;net.connect=deny;net.createConnection=deny;net.createServer=deny;net.Socket.prototype.connect=deny
 tls.connect=deny;tls.createServer=deny;dgram.createSocket=deny
 for(const module of [dns,dns.promises])for(const key of Object.keys(module))if(/^(?:lookup|resolve|reverse)/.test(key)&&typeof module[key]==='function')module[key]=deny
 const denyCapability=()=>{attempts.childWorker++;throw Error('BTL PDF budget controls deny child/worker creation')}
 for(const key of ['exec','execFile','spawn','fork','execSync','execFileSync','spawnSync'])childProcess[key]=denyCapability
 workerThreads.Worker=class{constructor(){denyCapability()}}
 syncBuiltinESMExports()
 const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
 const target=pathToFileURL(path.join(backend,'scraper/btlindia',route==='current'?'currentPdf.js':'nativePdf.js')).href
 const protocol='btl-budget-authored:'+route,exportName=route==='current'?'readCurrentBtlPdf':'readNativePdf'
 registerHooks({resolve(specifier,context,next){
  if(/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier)){attempts.database++;throw Error('BTL controls deny database modules')}
  if(/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier)){attempts.browser++;throw Error('BTL controls deny browser modules')}
  const resolved=next(specifier,context);return resolved.url===target?{url:protocol,shortCircuit:true}:resolved
 },load(url,context,next){
  if(url===protocol)return{format:'module',shortCircuit:true,source:'globalThis.__btlBudgetProtocol.load();export const '+exportName+'=(bytes,init)=>globalThis.__btlBudgetProtocol.decode(bytes,init);'}
  if(url.startsWith('file:')){
   const filename=fileURLToPath(url),relative=path.relative(backend,filename)
   if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&!relative.split(path.sep).includes('node_modules')){
    const bytes=fs.readFileSync(filename);imported.set(filename,{path:relative.replaceAll('\\','/'),filename,sha256:sha(bytes),bytes:bytes.length})
   }
  }
  return next(url,context)
 }})
 const finish=()=>console.log('BTL_PDF_BUDGET_GUARD '+JSON.stringify({attempts,permissions,DOMMatrixDefined:typeof globalThis.DOMMatrix!=='undefined',authoredImportBoundaryOnly:true,decoderReturnsModels:false,importedBackendFiles:[...imported.values()].map(({filename,...row})=>({...row,unchangedAtExit:sha(fs.readFileSync(filename))===row.sha256}))}))
 try{
  assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
  assert.equal(typeof globalThis.DOMMatrix,'undefined')
  const fixtureBytes=fs.readFileSync(path.join(backend,'test/test-data/recruitmentGoal20261107/btl-current.json.gz'))
  assert.equal(sha(fixtureBytes),'1f8a6219f2feda1c553a44a2f5deff5ae7832286fd2e2b86823df31a5d22c10b')
  const packets=new Map(JSON.parse(gunzipSync(fixtureBytes)).packets.map(row=>[row.requestedURL,row]))
  for(const row of packets.values()){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(sha(bytes),row.bodySHA256);assert.equal(bytes.length,row.bodyBytes)}
  const calls=[],decoders=[],timers=[],tracked=new Map(),caller=new AbortController(),reason=reasonFor(label)
  const primary=Object.freeze(Object.assign(Error('Authored failure-only decoder invocation'),{code:'AUTHORED_BTL_BUDGET_PROTOCOL'}))
  const primaryDescriptors=Object.getOwnPropertyDescriptors(primary)
  const configuration=mode==='source-expired'?{pdfTimeoutMs:5000,sourceTimeoutMs:1000,blockMs:1500}:mode==='on-time'?{pdfTimeoutMs:1000,sourceTimeoutMs:5000,blockMs:0}:{pdfTimeoutMs:80,sourceTimeoutMs:5000,blockMs:300}
  let loads=0,loadStarted,loadCompleted,callsAtLoad
  globalThis.__btlBudgetProtocol={load(){
   loads++;callsAtLoad=calls.length;loadStarted=performance.now()
   const end=loadStarted+configuration.blockMs
   while(performance.now()<end){/* Occupy the JS thread like synchronous module evaluation, before queued timers can run. */}
   if(mode==='caller')caller.abort(reason)
   loadCompleted=performance.now()
  },decode(bytes,init){
   assert.ok(Buffer.isBuffer(bytes));assert.ok([...packets.values()].some(row=>row.contentType==='application/pdf'&&row.bodySHA256===sha(bytes)))
   assert.ok(init.signal instanceof AbortSignal)
   decoders.push({signalAborted:init.signal.aborted,at:performance.now(),pdfTimers:timers.filter(row=>row.delay===configuration.pdfTimeoutMs).map(row=>({...row}))})
   throw primary
  }}
  const entry=await import(pathToFileURL(path.join(backend,'scraper/btlindia/script.js')).href)
  const {isFailure}=await import(pathToFileURL(path.join(backend,'scraper/btlindia/currentErrors.js')).href)
  assert.equal(loads,0,'Import must not initialize a decoder')
  const original=url=>{const row=packets.get(url);assert.ok(row,'Only retained original URLs are admitted');calls.push(url);return{...row,bytes:Buffer.from(row.bodyBase64,'base64')}}
  const options={pdfTimeoutMs:configuration.pdfTimeoutMs,sourceTimeoutMs:configuration.sourceTimeoutMs,now:()=> '2026-11-07T02:00:00Z',signal:caller.signal,...(route==='current'?{
   fetchResponse:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.ok(init.signal instanceof AbortSignal);return original(url)},
  }:{fetchText:async(url,init)=>{assert.ok(init.signal instanceof AbortSignal);return original(url).bytes.toString('utf8')},fetchPdf:async(url,init)=>{assert.ok(init.signal instanceof AbortSignal);return original(url).bytes}})}
  const originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout
  globalThis.setTimeout=(callback,delay,...args)=>{
   const row={delay,scheduledAt:performance.now(),deliveredAt:null,cancelledAt:null}
   const handle=originalSetTimeout((...values)=>{row.deliveredAt=performance.now();return callback(...values)},delay,...args)
   timers.push(row);tracked.set(handle,row);return handle
  }
  globalThis.clearTimeout=handle=>{const row=tracked.get(handle);if(row&&row.cancelledAt===null)row.cancelledAt=performance.now();return originalClearTimeout(handle)}
  let rejected=false,error
  try{try{await entry.run(options)}catch(value){rejected=true;error=value}}
  finally{globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout}
  await new Promise(resolve=>setImmediate(resolve))
  const result={route,mode,label:label||null,rejected,loads,decoderCalls:decoders.length,loadElapsed:loadCompleted-loadStarted,configuration,sourceCalls:calls.length,callsAtLoad,decoders,timers,sourceOwned:isFailure(error),exactAuthoredCause:error?.cause===primary,exactCallerReason:mode==='caller'&&Object.is(error,reason),callerAbortListeners:getEventListeners(caller.signal,'abort').length,pendingTimers:timers.filter(row=>row.cancelledAt===null&&row.deliveredAt===null).length,authoredFailureOnly:true,nativeFactsEstablished:false}
  console.log('BTL_PDF_BUDGET_RESULT '+JSON.stringify(result))
  assert.equal(rejected,true);assert.equal(loads,1);assert.equal(calls.length,callsAtLoad,'No new request after optional module evaluation')
  assert.equal(getEventListeners(caller.signal,'abort').length,0);assert.equal(result.pendingTimers,0)
  assert.deepEqual(Object.getOwnPropertyDescriptors(primary),primaryDescriptors)
  if(mode==='caller'){
   assert.ok(Object.is(error,reason),'The caller reason has priority even when PDF elapsed time is exceeded')
   assert.equal(decoders.length,0)
  }else if(mode==='on-time'){
   assert.equal(isFailure(error),true);assert.equal(error.cause,primary)
   assert.equal(decoders.length,route==='current'?2:1)
   assert.ok(decoders.every(row=>row.signalAborted===false&&row.pdfTimers.every(timer=>row.at-timer.scheduledAt<configuration.pdfTimeoutMs)))
  }else{
   assert.ok(loadCompleted-loadStarted>=configuration.blockMs)
   const deadlineTimers=timers.filter(row=>row.delay===(mode==='source-expired'?configuration.sourceTimeoutMs:configuration.pdfTimeoutMs))
   assert.ok(deadlineTimers.length>0&&deadlineTimers.every(row=>row.deliveredAt===null),'The deadline callback must not supply the admission check')
   assert.equal(isFailure(error),true)
   assert.equal(decoders.length,0,'BTL_PDF_BUDGET_ADMISSION: an expired gate cannot invoke a decoder after synchronous import evaluation')
   assert.match(error.message,mode==='source-expired'?/source deadline exceeded/:/PDF decode deadline exceeded/)
  }
 }catch(error){console.error(error);process.exitCode=1}finally{finish()}
}

if(process.argv.includes(marker)){
 const at=process.argv.indexOf(marker);await sourceCase(...process.argv.slice(at+1))
}else{
 const run=(route,mode,label)=>{
  const args=['--permission','--allow-fs-read='+backend,'--allow-fs-read='+path.dirname(self),'--unhandled-rejections=strict','--disallow-code-generation-from-strings']
  // Optional phase-local exact-preimage replay; ordinary installed runs need no hook or report path.
  if(process.env.BTL_PDF_BUDGET_PRELOAD){const url=new URL(process.env.BTL_PDF_BUDGET_PRELOAD);args.push('--allow-fs-read='+path.dirname(fileURLToPath(url)),'--import='+url.href)}
  args.push(self,marker,route,mode,...(label?[label]:[]))
  const result=childProcess.spawnSync(process.execPath,args,{cwd:backend,env:{...process.env,NODE_OPTIONS:'',BTL_PDF_BUDGET_BACKEND:backend},encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:1024*1024})
  assert.equal(result.error,undefined,result.error?.message)
  const parse=prefix=>{const line=result.stdout.split(/\r?\n/).find(row=>row.startsWith(prefix));return line?JSON.parse(line.slice(prefix.length)):null}
  const guard=parse('BTL_PDF_BUDGET_GUARD '),observation=parse('BTL_PDF_BUDGET_RESULT ')
  console.log('BTL_PDF_BUDGET_CHILD '+JSON.stringify({route,mode,label:label||null,exitCode:result.status,guard,observation}))
  assert.ok(guard);assert.deepEqual(guard.attempts,{network:0,database:0,browser:0,childWorker:0})
  assert.deepEqual(guard.permissions,{addons:false,worker:false,child:false,'fs.write':false})
  assert.equal(guard.DOMMatrixDefined,false);assert.ok(guard.importedBackendFiles.every(row=>row.unchangedAtExit))
  assert.ok(guard.importedBackendFiles.every(row=>!row.path.endsWith('/rawCapture.js')))
  assert.equal(result.status,0,result.stderr||result.stdout)
 }
 for(const route of ['current','legacy']){
  test('BTL public '+route+' expired PDF budget stops decoder admission before a delayed timer',()=>run(route,'pdf-expired'))
  test('BTL public '+route+' on-time decoder failure keeps its exact cause',()=>run(route,'on-time'))
  test('BTL public '+route+' source deadline retains priority after synchronous import work',()=>run(route,'source-expired'))
  for(const reason of ['null','false','zero','empty','frozen'])test('BTL public '+route+' synchronous-load caller '+reason+' remains exact after PDF budget expiry',()=>run(route,'caller',reason))
 }
}
