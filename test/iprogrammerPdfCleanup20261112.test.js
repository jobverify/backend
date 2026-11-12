// Staged task-protocol regressions only. No employer/native-PDF fact proof.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {registerHooks,syncBuiltinESMExports} from 'node:module'
import {getEventListeners} from 'node:events'
import test from 'node:test'
import child from 'node:child_process'
import workers from 'node:worker_threads'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'
const self=fileURLToPath(import.meta.url),here=path.dirname(self)
const backend=path.resolve(process.env.IPROGRAMMER_PDF_CLEANUP_BACKEND||
 fileURLToPath(new URL(path.basename(here)==='test'?'../':'../../../../backend/',import.meta.url)))
const sha=value=>createHash('sha256').update(value).digest('hex')
const marker='--iprogrammer-cleanup-source'
const reasons=['null','false','zero','empty','frozen']
const amendmentCases=[{"mode":"deadline-getDocument-return","label":"frozen"},{"mode":"deadline-getDocument-throw","label":"frozen"},{"mode":"deadline-loading-return","label":"frozen"},{"mode":"deadline-loading-throw","label":"frozen"},{"mode":"deadline-page-return","label":"frozen"},{"mode":"deadline-page-throw","label":"frozen"},{"mode":"deadline-text-return","label":"frozen"},{"mode":"deadline-text-throw","label":"frozen"},{"mode":"deadline-assembly-return","label":"frozen"},{"mode":"deadline-assembly-throw","label":"frozen"},{"mode":"deadline-timely-return","label":"frozen"},{"mode":"deadline-postimport-return","label":"frozen"},{"mode":"phase-native-extraction","label":"frozen"},{"mode":"phase-owned-success","label":"frozen"},{"mode":"phase-clock-success","label":"frozen"},{"mode":"phase-clock-primary","label":"frozen"},{"mode":"phase-owned-primary","label":"undefined"},{"mode":"phase-owned-primary","label":"null"},{"mode":"phase-owned-primary","label":"false"},{"mode":"phase-owned-primary","label":"zero"},{"mode":"phase-owned-primary","label":"empty"},{"mode":"phase-owned-primary","label":"frozen"},{"mode":"phase-owned-caller","label":"null"},{"mode":"phase-owned-caller","label":"false"},{"mode":"phase-owned-caller","label":"zero"},{"mode":"phase-owned-caller","label":"empty"},{"mode":"phase-owned-caller","label":"frozen"}]
const cases=[...['success','delayed-success','success-cleanup-reject','bad-header','oversize','page-zero','page-eleven','late-task-reject',
 'success-stall','abort-stall','primary-stall','abort-late-destroy-reject','sync-overrun','late-loading','late-page','late-text'].map(mode=>({mode,label:'frozen'})),
 ...reasons.map(label=>({mode:'preabort',label})),...reasons.map(label=>({mode:'caller-mask',label})),
 ...['undefined',...reasons].map(label=>({mode:'parser-mask',label})),...reasons.map(label=>({mode:'cleanup-abort',label})),...amendmentCases]
const sourcePaths=['scraper/iprogrammersolutions/employerAnnouncement.js','scraper-support/shared/pdfDisplay.js',
 'scraper-support/utils/inventoryEvidence.js','scraper-support/shared/responseBodyDisposal.js']
const dependencyPaths=['node_modules/@napi-rs/canvas/package.json','node_modules/@napi-rs/canvas/geometry.js']
const reasonFor=label=>label==='frozen'?Object.freeze(Error('Authored frozen iProgrammer caller/parser')):
 ({undefined:undefined,null:null,false:false,zero:0,empty:''})[label]
const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const within=async(promise,ms=2500)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent triage watchdog')),ms)})])}finally{clearTimeout(timer)}}

function guard(){
 const counters={network:0,database:0,browser:0,child:0,worker:0,addon:0,write:0,unexpectedModule:0,unexpectedNative:0}
 const imported=new Map(),admission={displayInitializations:0,geometryResolutions:0}
 const deny=kind=>(..._args)=>{counters[kind]++;throw Error('Strict iProgrammer triage denies '+kind)}
 globalThis.fetch=deny('network')
 for(const module of [http,https]){module.get=deny('network');module.request=deny('network')}
 http2.connect=deny('network');net.connect=deny('network');net.createConnection=deny('network');net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
 tls.connect=deny('network');tls.createServer=deny('network');dgram.createSocket=deny('network')
 for(const module of [dns,dns.promises])for(const name of Object.keys(module))if(/^(?:lookup|resolve|reverse)/.test(name)&&typeof module[name]==='function')module[name]=deny('network')
 if(globalThis.WebSocket)globalThis.WebSocket=class{constructor(){deny('network')()}}
 if(globalThis.EventSource)globalThis.EventSource=class{constructor(){deny('network')()}}
 for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])child[name]=deny('child')
 workers.Worker=class{constructor(){deny('worker')()}};process.dlopen=deny('addon')
 for(const module of [fs,fs.promises])for(const name of Object.keys(module))if(/^(?:write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(name)&&typeof module[name]==='function')module[name]=deny('write')
 fs.createWriteStream=deny('write')
 const open=fs.open,openSync=fs.openSync,promiseOpen=fs.promises.open,isRead=flags=>flags===undefined||flags==='r'||flags==='rs'||flags===0
 fs.open=(filename,flags,...rest)=>isRead(flags)?open(filename,flags,...rest):deny('write')()
 fs.openSync=(filename,flags,...rest)=>isRead(flags)?openSync(filename,flags,...rest):deny('write')()
 fs.promises.open=(filename,flags,...rest)=>isRead(flags)?promiseOpen(filename,flags,...rest):deny('write')()
 syncBuiltinESMExports()
 const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(name=>[name,process.permission.has(name)]))
 assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
 assert.ok(process.execArgv.includes('--disallow-code-generation-from-strings'))
 assert.ok(process.execArgv.includes('--unhandled-rejections=strict'))
 assert.equal(process.permission.has('fs.read',path.join(backend,'node_modules/@napi-rs/canvas/index.js')),false)
 const allowed=new Set([self,...sourcePaths.concat(dependencyPaths).map(name=>path.join(backend,name))])
 registerHooks({resolve(specifier,context,next){
  if(/(?:mongoose|mongodb|mysql|sequelize|prisma|saveToDB\.js|classification\/gliclass)/i.test(specifier))return deny('database')()
  if(/(?:playwright|puppeteer|selenium)/i.test(specifier))return deny('browser')()
  if(/(?:\.node|js-binding\.js)(?:$|\?)/.test(specifier))return deny('unexpectedNative')()
  if(specifier==='pdfjs-dist/legacy/build/pdf.mjs')return{shortCircuit:true,url:'iprogrammer-task-control:display'}
  if(specifier==='@napi-rs/canvas/geometry.js')admission.geometryResolutions++
  const resolved=next(specifier,context)
  if(resolved.url.startsWith('file:')&&!allowed.has(fileURLToPath(resolved.url)))return deny('unexpectedModule')()
  return resolved
 },load(url,context,next){
  if(url==='iprogrammer-task-control:display')return{shortCircuit:true,format:'module',source:
   'globalThis.__iprogrammerTaskProtocol.displayInitialized();export const getDocument=options=>globalThis.__iprogrammerTaskProtocol.factory(options);export const VerbosityLevel={ERRORS:0};'}
  if(url.startsWith('file:')){
   const filename=fileURLToPath(url);assert.ok(allowed.has(filename));const raw=fs.readFileSync(filename)
   imported.set(filename,{filename,sha256:sha(raw),bytes:raw.length})
  }
  return next(url,context)
 }})
 return{counters,admission,permissions,finish(){
  const rows=[...imported.values()].map(({filename,...row})=>({...row,path:path.relative(backend,filename).replaceAll('\\','/'),unchangedAtExit:sha(fs.readFileSync(filename))===row.sha256}))
  assert.ok(rows.every(row=>row.unchangedAtExit));assert.ok(Object.values(counters).every(value=>value===0))
  return{counters,admission,permissions,importedFiles:rows,nodeVersion:process.version,codeGenerationDenied:true,
   taskProtocolOnly:true,actualPDFParserProof:false,externalGeometryAssignment:false,nativeEmployerFacts:false,
   canvasRootReadable:process.permission.has('fs.read',path.join(backend,'node_modules/@napi-rs/canvas/index.js'))}
 }}
}

async function sourceCase(mode,label){
 const execution=guard(),caller=new AbortController(),reason=reasonFor(label)
 const ordinary=Object.freeze(Error('Authored late parser failure')),cleanup=Object.freeze(Error('Authored destroy failure'))
 const entered=deferred(),destroyEntered=deferred(),lateLoading=deferred(),latePage=deferred(),lateText=deferred(),release=deferred()
 const observations={tasks:0,destroys:0,pages:0,texts:0,lateDocumentTouches:0,lateTextAdmissions:0,lateContentTouches:0,
  settledBeforeCleanupRelease:null,exactCallerReason:null,exactPrimaryReason:null}
 let options,returned=false,settled=false,output,error,early,primary=reason,elapsed=0
 const originalNow=performance.now,originalTimeout=AbortSignal.timeout,originalAny=AbortSignal.any
 const timeoutRequests=[],combined=[],unhandled=[]
 const onUnhandled=reason=>unhandled.push(reason)
 process.on('unhandledRejection',onUnhandled)
 AbortSignal.timeout=ms=>{timeoutRequests.push({ms,afterDisplayImport:execution.admission.displayInitializations===1});return Reflect.apply(originalTimeout,AbortSignal,[ms])}
 AbortSignal.any=signals=>{const signal=Reflect.apply(originalAny,AbortSignal,[signals]);combined.push(signal);return signal}
 const content={items:[{str:'  Authored first line. ',hasEOL:true},{str:'\tAuthored second line.  ',hasEOL:false},{str:42,hasEOL:false}]}
 const page={getTextContent:()=>{observations.texts++;if(returned)observations.lateTextAdmissions++
  if(mode==='late-text'){entered.resolve();return lateText.promise}return Promise.resolve(content)}}
 const document=()=>({get numPages(){if(returned)observations.lateDocumentTouches++;return mode==='page-zero'?0:mode==='page-eleven'?11:1},
  getPage:()=>{observations.pages++;if(mode==='late-page'){entered.resolve();return latePage.promise}return Promise.resolve(page)}})
 globalThis.__iprogrammerTaskProtocol={displayInitialized(){execution.admission.displayInitializations++;assert.equal(timeoutRequests.length,0)},factory(value){
  observations.tasks++;options=value
  let promise=mode==='parser-mask'||mode==='primary-stall'?Promise.reject(primary):
   ['caller-mask','abort-stall','abort-late-destroy-reject','late-loading','late-task-reject'].includes(mode)?lateLoading.promise:Promise.resolve(document())
  if(['caller-mask','abort-stall','abort-late-destroy-reject','late-loading','late-task-reject'].includes(mode))entered.resolve()
  return{promise,destroy(){observations.destroys++;destroyEntered.resolve()
   if(['caller-mask','parser-mask','success-cleanup-reject'].includes(mode))return Promise.reject(cleanup)
   if(mode==='cleanup-abort')caller.abort(reason)
   if(mode==='sync-overrun'){elapsed=1001;return Promise.resolve()}
   if(['success-stall','abort-stall','primary-stall','abort-late-destroy-reject','delayed-success'].includes(mode))return release.promise
   return Promise.resolve()
  }}
 }}
 const bytes=mode==='bad-header'?Buffer.from('Authored non-PDF header'):mode==='oversize'?Buffer.alloc(2*1024*1024+1,37):
  Buffer.from('%PDF-1.7\n% Authored invalid task sentinel; no employer, criteria, native model or publication evidence.\n')
 if(mode==='preabort')caller.abort(reason)
 if(mode==='sync-overrun')performance.now=()=>elapsed
 let pending
 try{
  const {parseNativeAnnouncementPdf}=await import(pathToFileURL(path.join(backend,sourcePaths[0])))
  pending=reflect(parseNativeAnnouncementPdf(bytes,{signal:caller.signal}));pending.then(()=>{settled=true})
  if(['caller-mask','abort-stall','abort-late-destroy-reject','late-loading','late-page','late-text','late-task-reject'].includes(mode)){
   await within(entered.promise);caller.abort(reason)
  }
  if(['success-stall','abort-stall','primary-stall','abort-late-destroy-reject'].includes(mode)){
   await within(destroyEntered.promise)
   const start=originalNow.call(performance)
   early=await Promise.race([pending,pause(1250).then(()=>({pending:true}))])
   observations.measuredCleanupWaitMs=Math.round(originalNow.call(performance)-start)
   observations.settledBeforeCleanupRelease=early.pending!==true
  }else if(mode==='delayed-success'){
   await within(destroyEntered.promise);await pause(20);assert.equal(settled,false);release.resolve();early=await within(pending)
   observations.settledBeforeCleanupRelease=false
  }else early=await within(pending)
  returned=true
  if(['late-task-reject','caller-mask','abort-stall','abort-late-destroy-reject'].includes(mode))lateLoading.reject(ordinary)
  else lateLoading.resolve(document())
  latePage.resolve(page)
  lateText.resolve({get items(){if(returned)observations.lateContentTouches++;return content.items}})
  if(mode==='abort-late-destroy-reject')release.reject(cleanup);else release.resolve()
  output=await within(pending);await turn();await turn()
  observations.exactCallerReason=!output.ok&&Object.is(output.reason,reason)
  observations.exactPrimaryReason=!output.ok&&Object.is(output.reason,primary)
  if(['success-stall','abort-stall','primary-stall','abort-late-destroy-reject'].includes(mode))assert.equal(early.pending,undefined,'cleanup must settle within its 1000ms grace without an external release')
  if(mode==='preabort'){assert.equal(output.ok,false);assert.equal(output.reason,reason);assert.equal(observations.tasks,0);assert.equal(execution.admission.displayInitializations,0)}
  else if(['bad-header','oversize'].includes(mode)){assert.equal(output.ok,false);assert.match(output.reason.message,/native download is not a bounded PDF/);assert.equal(observations.tasks,0);assert.equal(execution.admission.displayInitializations,0)}
  else if(['page-zero','page-eleven'].includes(mode)){assert.equal(output.ok,false);assert.match(output.reason.message,/published PDF page count/);assert.equal(observations.pages,0)}
  else if(['caller-mask','cleanup-abort','abort-stall','abort-late-destroy-reject','late-loading','late-page','late-text','late-task-reject'].includes(mode)){
   assert.equal(output.ok,false,'aborted caller must reject');assert.equal(output.reason,reason,'exact caller reason must survive cleanup')
  }else if(['parser-mask','primary-stall'].includes(mode)){assert.equal(output.ok,false);assert.equal(output.reason,primary,'earlier exact parser reason must survive cleanup')}
  else if(mode==='success-cleanup-reject'){assert.equal(output.ok,false);assert.equal(output.reason,cleanup)}
  else if(['success-stall','sync-overrun'].includes(mode)){assert.equal(output.ok,false);assert.equal(output.reason?.code,'NATIVE_PDF_CLEANUP_TIMEOUT')}
  else{assert.equal(output.ok,true);assert.equal(output.value,'Authored first line.\nAuthored second line.')}
  if(mode==='late-loading')assert.equal(observations.lateDocumentTouches,0,'no document inspection after abort')
  if(mode==='late-page')assert.equal(observations.lateTextAdmissions,0,'no text API admission after abort')
  if(mode==='late-text')assert.equal(observations.lateContentTouches,0,'no content inspection after abort')
 }catch(caught){error=caught}
 finally{
  release.resolve();lateLoading.resolve(document());latePage.resolve(page);lateText.resolve(content)
  if(pending)await within(pending);await turn();await turn()
  performance.now=originalNow;AbortSignal.timeout=originalTimeout;AbortSignal.any=originalAny
  process.removeListener('unhandledRejection',onUnhandled)
 }
 const abortListeners={caller:getEventListeners(caller.signal,'abort').length,combined:combined.map(signal=>getEventListeners(signal,'abort').length)}
 assert.equal(abortListeners.caller,0);assert.ok(abortListeners.combined.every(count=>count===0));assert.equal(unhandled.length,0)
 assert.ok(timeoutRequests.every(row=>row.ms===15000&&row.afterDisplayImport));assert.ok(timeoutRequests.length<=1)
 if(observations.tasks){
  assert.equal(observations.tasks,1);assert.equal(observations.destroys,1)
  assert.deepEqual(Object.keys(options).sort(),['data','disableFontFace','isEvalSupported','useSystemFonts','useWorkerFetch','verbosity'])
  assert.deepEqual(Buffer.from(options.data),bytes)
  assert.equal(options.disableFontFace,true);assert.equal(options.isEvalSupported,false);assert.equal(options.useSystemFonts,false);assert.equal(options.useWorkerFetch,false);assert.equal(options.verbosity,0)
 }
 const receipt={status:error?'regression-failed':'contract-passed',mode,label,observations,timeoutRequests,abortListeners,
  unhandledRejections:unhandled.length,guard:execution.finish(),
  outcome:{ok:output?.ok??null,reasonName:output?.reason?.name??null,reasonMessage:output?.reason?.message??null,
   wasCleanupError:output?.reason===cleanup,wasExactCaller:observations.exactCallerReason,wasExactPrimary:observations.exactPrimaryReason},
  error:error?{name:error.name,message:error.message,code:error.code}:null,
  claims:{taskProtocolOnly:true,nativeEmployerInput:false,nativeEmployerFacts:false,realPdfParserProof:false,externalGeometryAssignment:false}}
 console.log(JSON.stringify(receipt));if(error)process.exitCode=1
}

// Authored clock/deadline-delivery protocols. Physical real-clock evidence is separate.
async function deadlineCase(mode,label){
 const execution=guard(),caller=new AbortController(),owned=new AbortController(),reason=reasonFor(label)
 const primary=mode==='phase-owned-caller'||mode==='phase-clock-primary'?false:reason
 const nativeReason=Object.freeze(new DOMException('Authored owned extraction timeout','TimeoutError'))
 const ordinary=Object.freeze(Error('Authored synchronous stage failure'))
 const entered=deferred(),destroyEntered=deferred(),late=deferred(),release=deferred()
 const originalNow=performance.now,originalTimeout=AbortSignal.timeout,originalAny=AbortSignal.any
 const clockControlled=mode.startsWith('deadline-')||mode.startsWith('phase-clock-')
 const deliveryControlled=mode.startsWith('phase-')&&!mode.startsWith('phase-clock-')
 const observations={tasks:0,destroys:0,pages:0,texts:0,assembly:0,settledAfterOwnedTimeout:null}
 const timeoutRequests=[],combined=[],unhandled=[]
 let elapsed=0,settled=false,options,output,error
 if(clockControlled)performance.now=()=>elapsed
 AbortSignal.timeout=ms=>{
  const native=Reflect.apply(originalTimeout,AbortSignal,[ms])
  timeoutRequests.push({ms,afterDisplayImport:execution.admission.displayInitializations===1,clockAtCreation:elapsed,
   nativeCallForwarded:true,ownedDeliveryControlled:deliveryControlled})
  return deliveryControlled?owned.signal:native
 }
 AbortSignal.any=signals=>{const result=Reflect.apply(originalAny,AbortSignal,[signals]);combined.push(result);return result}
 const onUnhandled=value=>unhandled.push(value);process.on('unhandledRejection',onUnhandled)
 const stage=name=>{
  if(mode==='deadline-'+name+'-return'||mode==='deadline-'+name+'-throw'){
   elapsed=15001;if(mode.endsWith('-throw'))throw ordinary
  }
 }
 const content={get items(){observations.assembly++;stage('assembly');return[{str:'Authored phase text.',hasEOL:false}]}}
 const page={getTextContent(){observations.texts++;stage('text');if(mode==='phase-clock-success')elapsed=14990;return Promise.resolve(content)}}
 const document={numPages:1,getPage(){observations.pages++;stage('page');return Promise.resolve(page)}}
 globalThis.__iprogrammerTaskProtocol={displayInitialized(){execution.admission.displayInitializations++;assert.equal(timeoutRequests.length,0)
  if(mode==='deadline-postimport-return')elapsed=50000
 },factory(value){
  observations.tasks++;options=value;stage('getDocument')
  if(mode==='deadline-timely-return')elapsed=14999
  if(mode==='deadline-postimport-return')elapsed=64999
  if(mode==='phase-clock-primary')elapsed=14990
  const promise=mode==='phase-owned-primary'||mode==='phase-owned-caller'||mode==='phase-clock-primary'?Promise.reject(primary):
   mode==='phase-native-extraction'?late.promise:Promise.resolve(document)
  if(mode==='phase-native-extraction')entered.resolve()
  return{get promise(){stage('loading');return promise},destroy(){
   observations.destroys++;destroyEntered.resolve()
   if(mode==='phase-clock-primary'||mode==='phase-clock-success')elapsed=15010
   return ['phase-owned-success','phase-owned-primary','phase-owned-caller'].includes(mode)?release.promise:Promise.resolve()
  }}
 }}
 const bytes=Buffer.from('%PDF-1.7\n% Authored deadline task sentinel only; no native PDF model or employer facts.\n')
 let pending
 try{
  const {parseNativeAnnouncementPdf}=await import(pathToFileURL(path.join(backend,sourcePaths[0])))
  pending=reflect(parseNativeAnnouncementPdf(bytes,{signal:caller.signal}));pending.then(()=>{settled=true})
  if(mode==='phase-native-extraction'){
   await within(entered.promise);owned.abort(nativeReason)
  }else if(['phase-owned-success','phase-owned-primary','phase-owned-caller'].includes(mode)){
   await within(destroyEntered.promise);owned.abort(nativeReason);await turn();await turn()
   observations.settledAfterOwnedTimeout=settled
   if(mode==='phase-owned-caller')caller.abort(reason)
   release.resolve()
  }
  output=await within(pending)
  if(mode.startsWith('deadline-')&&!['deadline-timely-return','deadline-postimport-return'].includes(mode)){
   assert.equal(output.ok,false,'elapsed extraction must reject after synchronous work returns or throws')
   assert.ok(output.reason instanceof DOMException);assert.equal(output.reason.name,'TimeoutError')
   assert.notEqual(output.reason,ordinary)
   if(mode.includes('getDocument')||mode.includes('loading'))assert.equal(observations.pages,0)
   if(mode.includes('page'))assert.equal(observations.texts,0)
  }else if(mode==='phase-native-extraction'){
   assert.equal(output.ok,false);assert.equal(output.reason,nativeReason,'delivered owned extraction reason stays exact')
  }else if(mode==='phase-owned-caller'){
   assert.equal(observations.settledAfterOwnedTimeout,false,'owned deadline must not settle caller-only cleanup')
   assert.equal(output.ok,false);assert.equal(output.reason,reason,'caller remains independent after owned timeout fired first')
  }else if(mode==='phase-owned-primary'||mode==='phase-clock-primary'){
   if(mode==='phase-owned-primary')assert.equal(observations.settledAfterOwnedTimeout,false)
   assert.equal(output.ok,false);assert.equal(output.reason,primary,'completed extraction failure survives later owned timeout')
  }else{
   if(mode==='phase-owned-success')assert.equal(observations.settledAfterOwnedTimeout,false)
   assert.equal(output.ok,true);assert.equal(output.value,'Authored phase text.')
  }
 }catch(caught){error=caught}finally{
  release.resolve();if(mode==='phase-native-extraction')late.reject(ordinary);else late.resolve(document)
  if(pending)await within(pending);await turn();await turn()
  performance.now=originalNow;AbortSignal.timeout=originalTimeout;AbortSignal.any=originalAny
  process.removeListener('unhandledRejection',onUnhandled)
 }
 const abortListeners={caller:getEventListeners(caller.signal,'abort').length,owned:getEventListeners(owned.signal,'abort').length,
  combined:combined.map(signal=>getEventListeners(signal,'abort').length)}
 assert.equal(abortListeners.caller,0);assert.equal(abortListeners.owned,0)
 assert.ok(abortListeners.combined.every(count=>count===0));assert.equal(unhandled.length,0)
 assert.equal(timeoutRequests.length,1);assert.equal(timeoutRequests[0].ms,15000);assert.ok(timeoutRequests[0].afterDisplayImport)
 assert.equal(observations.tasks,1);assert.equal(observations.destroys,mode==='deadline-getDocument-throw'?0:1)
 assert.deepEqual(Buffer.from(options.data),bytes)
 assert.deepEqual(Object.keys(options).sort(),['data','disableFontFace','isEvalSupported','useSystemFonts','useWorkerFetch','verbosity'])
 assert.equal(options.disableFontFace,true);assert.equal(options.isEvalSupported,false);assert.equal(options.useSystemFonts,false);assert.equal(options.useWorkerFetch,false);assert.equal(options.verbosity,0)
 const receipt={status:error?'regression-failed':'contract-passed',mode,label,observations,timeoutRequests,abortListeners,
  unhandledRejections:unhandled.length,guard:execution.finish(),
  outcome:{ok:output?.ok??null,reasonName:output?.reason?.name??null,reasonMessage:output?.reason?.message??null,
   exactCaller:output?.ok===false&&Object.is(output.reason,reason),exactPrimary:output?.ok===false&&Object.is(output.reason,primary),
   exactOwned:output?.reason===nativeReason},
  error:error?{name:error.name,message:error.message,code:error.code}:null,
  claims:{taskProtocolOnly:true,clockControlled,ownedDeadlineDeliveryControlled:deliveryControlled,oneRealNativeTimeoutRequestForwarded:true,
   physicalTimingProof:false,nativeEmployerFacts:false,actualPdfParserProof:false,externalGeometryAssignment:false}}
 console.log(JSON.stringify(receipt));if(error)process.exitCode=1
}

function readGrants(){return[self,path.join(backend,'package.json'),path.join(backend,'../package.json'),
 ...sourcePaths.concat(dependencyPaths).map(name=>path.join(backend,name))].map(name=>'--allow-fs-read='+name)}
if(process.argv.includes(marker)){
 const index=process.argv.indexOf(marker)
 try{const args=process.argv.slice(index+1);await (args[0].startsWith('deadline-')||args[0].startsWith('phase-')?deadlineCase(...args):sourceCase(...args))}catch(error){console.log(JSON.stringify({status:'harness-failed',error:{name:error.name,message:error.message,stack:error.stack}}));process.exitCode=1}
}else{
 for(const row of cases)test('iProgrammer task cleanup '+row.mode+' '+row.label,()=>{
  const env={...process.env,NODE_OPTIONS:'',IPROGRAMMER_PDF_CLEANUP_BACKEND:backend};delete env.NODE_TEST_CONTEXT;delete env.NODE_PATH
  const result=child.spawnSync(process.execPath,['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict',
   ...readGrants(),self,marker,row.mode,row.label],{cwd:backend,env,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:1024*1024})
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr||result.stdout)
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.status,'contract-passed')
 })
}
