import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

// Portable after promotion to backend/test. The override runs this exact draft
// outside backend during RED. Every source case executes in a strict child.
const backend=path.resolve(process.env.GAIL_PDF_LIFECYCLE_TEST_BACKEND||fileURLToPath(new URL('../',import.meta.url)))
const self=fileURLToPath(import.meta.url)
const labels=['null','false','zero','empty','frozen']
const cases=[]
for(const kind of ['import-pending','loading-abort-pending-destroy','loading-abort-rejected-destroy','loading-abort-resolved-destroy'])for(const label of labels)cases.push({kind,label})
cases.push({kind:'import-pending-reject',label:'false'},{kind:'loading-abort-late-rejected-destroy',label:'frozen'})
for(const label of labels)cases.push({kind:'preabort',label})
cases.push({kind:'validation',label:'frozen'},{kind:'ordinary-import-failure',label:'frozen'})
for(const label of ['undefined',...labels])cases.push({kind:'primary-rejection-cleanup-reject',label})
for(const label of labels)cases.push({kind:'page-pending-abort',label})
cases.push({kind:'text-pending-abort',label:'frozen'},{kind:'loading-late-resolve',label:'frozen'},{kind:'page-synchronous-abort',label:'frozen'},{kind:'cleanup-abort',label:'frozen'})
for(const variant of ['within-grace','resolved-overrun','pending-overrun','late-reject-overrun'])cases.push({kind:'cleanup-monotonic',label:'frozen',variant})
cases.push({kind:'deadline-starts-after-import',label:'frozen'},{kind:'genuine-generic-BTL',label:'frozen'})
for(const stage of ['getDocument','loading','page','text','assembly'])for(const settlement of ['return','throw'])cases.push({kind:'extraction-clock',label:'frozen',variant:stage+'-'+settlement})
cases.push({kind:'extraction-clock',label:'frozen',variant:'timely-return'},{kind:'extraction-native-delivery',label:'frozen'})
cases.push({kind:'cleanup-phase',label:'frozen',variant:'success'})
for(const label of ['undefined',...labels])cases.push({kind:'cleanup-phase',label,variant:'primary'})
for(const label of labels)cases.push({kind:'cleanup-phase',label,variant:'caller-after-owned'})

async function scenario(config){
 const {default:assert}=await import('node:assert/strict')
 const {default:fs}=await import('node:fs')
 const {default:path}=await import('node:path')
 const {pathToFileURL}=await import('node:url')
 const {createHash}=await import('node:crypto')
 const {gunzipSync}=await import('node:zlib')
 const {getEventListeners}=await import('node:events')
 const {registerHooks,syncBuiltinESMExports}=await import('node:module')
 const backend=process.env.GAIL_PDF_LIFECYCLE_TEST_BACKEND,kind=config.kind,label=config.label
 const sha=x=>createHash('sha256').update(x).digest('hex'),sourcePath=path.join(backend,'scraper/gailindia.workday/pdf.js'),sourceBefore=sha(fs.readFileSync(sourcePath))
 const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(k=>[k,process.permission.has(k)]))
 assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
 assert.ok(process.execArgv.includes('--disallow-code-generation-from-strings'))
 const attempts={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,nativeBinding:0}
 const deny=k=>()=>{attempts[k]++;throw Error('GAIL lifecycle test denies '+k)}
 globalThis.fetch=deny('network')
 for(const name of ['node:http','node:https']){const m=(await import(name)).default;m.get=deny('network');m.request=deny('network')}
 const http2=(await import('node:http2')).default;http2.connect=deny('network')
 const net=(await import('node:net')).default;net.connect=deny('network');net.createConnection=deny('network');net.createServer=deny('network');net.Socket.prototype.connect=deny('network')
 const tls=(await import('node:tls')).default;tls.connect=deny('network');tls.createServer=deny('network')
 ;(await import('node:dgram')).default.createSocket=deny('network')
 const dns=(await import('node:dns')).default
 for(const m of [dns,dns.promises])for(const k of Object.keys(m))if(/^(?:lookup|resolve|reverse)/.test(k)&&typeof m[k]==='function')m[k]=deny('network')
 const cp=(await import('node:child_process')).default;for(const k of ['spawn','spawnSync','fork','exec','execSync','execFile','execFileSync'])cp[k]=deny('child')
 ;(await import('node:worker_threads')).default.Worker=class{constructor(){deny('worker')()}}
 process.dlopen=deny('addon')
 for(const m of [fs,fs.promises])for(const k of Object.keys(m))if(/^(?:write|append|truncate|ftruncate|unlink|rm|rmdir|mkdir|mkdtemp|rename|copyFile|cp|link|symlink|chmod|chown|lchown|fchown|utimes|lutimes|futimes)/.test(k)&&typeof m[k]==='function')m[k]=deny('fsWrite')
 fs.createWriteStream=deny('fsWrite')
 for(const [m,k]of [[fs,'open'],[fs,'openSync'],[fs.promises,'open']]){const original=m[k];m[k]=(p,flags,...args)=>flags==='r'||flags==='rs'||flags===0?original(p,flags,...args):deny('fsWrite')()}
 syncBuiltinESMExports()
 const cap=()=>Promise.withResolvers(),turn=()=>new Promise(r=>setImmediate(r)),delay=ms=>new Promise(r=>setTimeout(r,ms))
 const bounded=async(p,ms=2200)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('GAIL test watchdog')),ms)})])}finally{clearTimeout(timer)}}
 const reason=label==='frozen'?Object.freeze(Error('Authored frozen opaque reason')):({undefined:undefined,null:null,false:false,zero:0,empty:''})[label]
 const ordinary=Object.freeze(Object.assign(Error('Authored canonical/task failure'),{code:'AUTHORED_GAIL_FAILURE'})),cleanupFailure=Object.freeze(Error('Authored destroy failure'))
 const caller=new AbortController(),s={kind,imports:0,tasks:0,destroys:0,pages:0,texts:0,metadataAfterAbort:0,importEntered:cap(),importGate:cap(),taskEntered:cap(),loading:cap(),pageEntered:cap(),pageGate:cap(),textEntered:cap(),textGate:cap(),destroyEntered:cap(),destroyGate:cap(),options:null}
 globalThis.__gailLifecycle=s
 const canonical=pathToFileURL(path.join(backend,'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href,indexURL=pathToFileURL(path.join(backend,'node_modules/@napi-rs/canvas/index.js')).href
 let expectedOptionalRootDenials=0
 registerHooks({resolve(specifier,context,next){
  if(/^(?:mongoose|mongodb|mysql|mysql2|pg|prisma|knex|sequelize)(?:\/|$)/.test(specifier))return deny('database')()
  if(/^(?:puppeteer|playwright|selenium)(?:\/|$)/.test(specifier))return deny('browser')()
  if(/js-binding\.js|\.node(?:$|\?)/.test(specifier))return deny('nativeBinding')()
  return next(specifier,context)
 },load(url,context,next){
  if(url===canonical&&kind!=='genuine-generic-BTL')return{format:'module',shortCircuit:true,source:'const s=globalThis.__gailLifecycle;s.imports++;s.importEntered.resolve();await s.importGate.promise;if(s.rejectImport)throw s.importFailure;export const VerbosityLevel={ERRORS:0};export const getDocument=options=>s.factory(options);'}
  if(url===indexURL){try{return next(url,context)}catch(e){if(e?.code==='ERR_ACCESS_DENIED')expectedOptionalRootDenials++;throw e}}
  return next(url,context)
 }})
 const now=performance.now,nativeTimeout=AbortSignal.timeout,ownedTimeout=new AbortController(),naturalTimeouts=[];let clock=0
 const extended=kind==='extraction-clock'||kind==='extraction-native-delivery'||kind==='cleanup-phase'
 const [clockStage,clockSettlement]=config.variant?.split('-')??[]
 if(kind==='cleanup-monotonic'||kind==='deadline-starts-after-import'||kind==='extraction-clock')performance.now=()=>clock
 if(extended)AbortSignal.timeout=milliseconds=>{assert.equal(milliseconds,15000);const natural=nativeTimeout(milliseconds);naturalTimeouts.push(natural);return kind==='extraction-clock'?natural:ownedTimeout.signal}
 const failures=[],check=(ok,message)=>{if(!ok)failures.push(message)},reflect=p=>p.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
 const invalid=Buffer.from('%PDF-1.7\n% INVALID AUTHORED LIFECYCLE TASK PROTOCOL; no native facts.\n')
 const clockStageResult=stage=>{if(kind==='extraction-clock'&&clockStage===stage){clock=clockStage==='timely'?14999:15001;if(clockSettlement==='throw')throw ordinary}}
 const completeProtocol={get items(){clockStageResult('assembly');return[{str:'Authored lifecycle task protocol',hasEOL:false}]}}
 const textProtocol={getTextContent(){s.texts++;s.textEntered.resolve();clockStageResult('text');return kind==='extraction-clock'||kind==='cleanup-phase'?Promise.resolve(completeProtocol):s.textGate.promise}}
 const documentProtocol={get numPages(){if(caller.signal.aborted)s.metadataAfterAbort++;return kind==='text-pending-abort'?2:1},getPage(){s.pages++;s.pageEntered.resolve();clockStageResult('page');if(kind==='page-synchronous-abort'){caller.abort(reason);return textProtocol}return kind==='extraction-clock'||kind==='cleanup-phase'?textProtocol:s.pageGate.promise}}
 // Stage controls exist only to expose caller-visible admission/cleanup. They
 // are never represented as a PDF parser, provider model or native evidence.
 s.factory=options=>{
  s.options=options;clockStageResult('getDocument');clockStageResult('timely')
  s.tasks++;s.options=options;s.taskEntered.resolve()
  if(kind==='extraction-native-delivery')ownedTimeout.abort(ordinary)
  return{get promise(){if(kind==='extraction-clock'&&clockStage==='loading'){clock=15001;return clockSettlement==='throw'?Promise.reject(ordinary):s.loading.promise}return s.loading.promise},destroy(){s.destroys++;s.destroyEntered.resolve()
   if(kind==='cleanup-phase')return s.destroyGate.promise
   if(kind==='cleanup-monotonic'){clock=config.variant==='within-grace'?999:1001;return ['pending-overrun','late-reject-overrun'].includes(config.variant)?s.destroyGate.promise:Promise.resolve()}
   if(kind==='loading-abort-rejected-destroy'||kind==='primary-rejection-cleanup-reject')return Promise.reject(cleanupFailure)
   if(['loading-abort-pending-destroy','loading-abort-late-rejected-destroy','cleanup-abort'].includes(kind))return s.destroyGate.promise
   return Promise.resolve()
  }}
 }
 const importPending=kind.startsWith('import-pending')||kind==='deadline-starts-after-import'
 if(!importPending)s.importGate.resolve()
 if(kind==='ordinary-import-failure'){s.rejectImport=true;s.importFailure=ordinary}
 const abortListenerBefore=getEventListeners(caller.signal,'abort').length
 let operation,outcome,settled=false,rawObserved={}
 try{
  const {readNativePDF}=await import(pathToFileURL(sourcePath))
  if(kind==='genuine-generic-BTL'){
   assert.equal(typeof globalThis.DOMMatrix,'undefined')
   const fixture=JSON.parse(gunzipSync(fs.readFileSync(path.join(backend,'test/test-data/recruitmentGoal20261107/btl-current.json.gz')))),packet=fixture.packets[1],bytes=Buffer.from(packet.bodyBase64,'base64')
   assert.equal(sha(bytes),'5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a')
   const result=await bounded(readNativePDF(bytes),18000)
   check(sha(JSON.stringify(result))==='797dd2f98090a45c9711fa670a40237b10efa5baac851cb6f085dd3589bcf505','genuine generic returned model must match preimage exactly')
   rawObserved={genericBTL:true,returnedModelSHA256:sha(JSON.stringify(result)),pages:result.pages.length,externalGeometryAssignment:false}
  }else if(kind==='validation'){
   for(const value of ['%PDF-1.7',[37,80,68,70,45],new Uint8Array(),Buffer.from('invalid'),Buffer.alloc(2097153)]){const r=await reflect(readNativePDF(value));check(!r.ok,'invalid type/header/size must reject');check(s.imports===0&&s.tasks===0,'invalid input must not import or admit')}
   const inclusive=Buffer.alloc(2097152);inclusive.write('%PDF-');operation=reflect(readNativePDF(inclusive));await bounded(s.taskEntered.promise);s.loading.reject(ordinary);const r=await bounded(operation);check(!r.ok&&r.reason===ordinary,'inclusive2MiB must reach unchanged producer failure');check(s.tasks===1,'inclusive2MiB must be admitted')
  }else if(extended){
   if(kind!=='cleanup-phase')s.loading.resolve(documentProtocol)
   operation=reflect(readNativePDF(invalid,{signal:caller.signal}));operation.then(r=>{outcome=r;settled=true})
   if(kind==='extraction-clock'){
    await bounded(operation)
    if(clockStage==='timely')check(outcome.ok&&JSON.stringify(outcome.value)==='{"pages":[{"page":1,"text":"Authored lifecycle task protocol "}]}','14999ms task protocol must retain exact text output')
    else check(!outcome.ok&&outcome.reason instanceof DOMException&&outcome.reason.name==='TimeoutError','synchronous extraction overrun must reject with TimeoutError before timer delivery')
    check(naturalTimeouts[0]?.aborted===false,'elapsed fallback must precede real native timer delivery')
   }else if(kind==='extraction-native-delivery'){
    await bounded(operation);check(!outcome.ok&&outcome.reason===ordinary,'already delivered extraction signal must retain its exact reason')
   }else{
    await bounded(s.taskEntered.promise)
    if(config.variant==='primary')s.loading.reject(reason);else s.loading.resolve(documentProtocol)
    await bounded(s.destroyEntered.promise);ownedTimeout.abort(ordinary);await turn();await turn()
    if(config.variant==='caller-after-owned'){caller.abort(reason);await delay(150);check(settled,'caller abort must settle cleanup after owned timeout fired first')}
    s.destroyGate.resolve();await bounded(operation)
    if(config.variant==='success')check(outcome.ok&&JSON.stringify(outcome.value)==='{"pages":[{"page":1,"text":"Authored lifecycle task protocol "}]}','late owned extraction timeout must not invalidate timely success')
    else check(!outcome.ok&&outcome.reason===reason,'cleanup phase must preserve earlier parser or exact later caller reason')
   }
   check(naturalTimeouts.length===1,'exactly one unchanged native15000ms timeout must be requested')
   rawObserved.extendedDeadline={clock,clockStage:clockStage??null,ownedNativeTimeoutCalls:naturalTimeouts.length,ownedControlledSignalAborted:ownedTimeout.signal.aborted,settled,returnedReasonName:outcome?.reason?.name??null}
  }else{
   if(kind==='preabort')caller.abort(reason)
   const options=kind==='ordinary-import-failure'?{}:{signal:caller.signal}
   operation=reflect(readNativePDF(invalid,options));operation.then(r=>{outcome=r;settled=true})
   if(kind==='preabort'){await bounded(operation);check(!outcome.ok&&outcome.reason===reason,'preabort must preserve exact reason');check(s.imports===0&&s.tasks===0,'preabort must avoid imports/tasks')}
   else if(kind==='ordinary-import-failure'){await bounded(operation);check(!outcome.ok&&outcome.reason===ordinary,'canonical import failure identity must survive');check(s.tasks===0,'failed import must not admit a task')}
   else if(importPending){
    await bounded(s.importEntered.promise)
    if(kind==='deadline-starts-after-import'){clock=20000;s.importGate.resolve();await bounded(s.taskEntered.promise);s.loading.reject(ordinary);await bounded(operation);check(!outcome.ok&&outcome.reason===ordinary,'15s extraction budget must start after imports');check(s.tasks===1,'long initialization must not consume extraction budget')}
    else{caller.abort(reason);await delay(150);check(settled,'caller abort must settle while display import remains pending');if(settled)check(!outcome.ok&&outcome.reason===reason,'pending import must preserve exact reason');rawObserved.beforeImportRelease={settled,tasks:s.tasks};if(kind==='import-pending-reject')s.importGate.reject(ordinary);else s.importGate.resolve();await bounded(operation);await turn();await turn();check(s.tasks===0,'late display settlement must not admit getDocument');check(!outcome.ok&&outcome.reason===reason,'late import rejection must not replace caller reason')}
   }else{
    await bounded(s.taskEntered.promise)
    if(kind==='primary-rejection-cleanup-reject'){s.loading.reject(reason);await bounded(operation);check(!outcome.ok&&outcome.reason===reason,'earlier opaque parser failure must survive destroy rejection')}
    else if(kind==='cleanup-abort'){s.loading.reject(ordinary);await bounded(s.destroyEntered.promise);caller.abort(reason);await delay(1250);check(settled,'caller abort during pending cleanup must settle within cleanup grace');s.destroyGate.resolve();await bounded(operation);check(!outcome.ok&&outcome.reason===reason,'caller abort during cleanup must preserve exact reason')}
    else if(kind==='cleanup-monotonic'){
     s.loading.resolve(documentProtocol);s.pageGate.resolve(textProtocol);s.textGate.resolve({items:[{str:'Authored lifecycle task protocol',hasEOL:false}]});await bounded(s.destroyEntered.promise);await delay(150);check(settled,'elapsed monotonic cleanup grace must settle before timer callback/release');rawObserved.beforeDestroyRelease={settled,clock}
     if(config.variant==='late-reject-overrun')s.destroyGate.reject(cleanupFailure);else s.destroyGate.resolve();await bounded(operation)
     if(config.variant==='within-grace')check(outcome.ok&&JSON.stringify(outcome.value)==='{"pages":[{"page":1,"text":"Authored lifecycle task protocol "}]}','within-grace task protocol preserves exact text joins')
     else check(!outcome.ok&&outcome.reason?.code==='NATIVE_PDF_CLEANUP_TIMEOUT','cleanup overrun must return existing cleanup timeout kind')
    }else if(kind==='page-pending-abort'||kind==='page-synchronous-abort'){
     s.loading.resolve(documentProtocol);await bounded(s.pageEntered.promise);if(kind==='page-pending-abort')caller.abort(reason);await bounded(operation);s.pageGate.resolve(textProtocol);await turn();await turn();if(s.texts)s.textGate.reject(ordinary);check(!outcome.ok&&outcome.reason===reason,'page-stage abort must preserve exact reason');check(s.texts===0,'late page settlement must not admit text extraction')
    }else if(kind==='text-pending-abort'){
     s.loading.resolve(documentProtocol);s.pageGate.resolve(textProtocol);await bounded(s.textEntered.promise);caller.abort(reason);await bounded(operation);s.textGate.resolve({items:[{str:'Authored late task text',hasEOL:false}]});await turn();await turn();check(!outcome.ok&&outcome.reason===reason,'text-stage abort must preserve exact reason');check(s.pages===1,'late text must not admit a later page')
    }else{
     caller.abort(reason)
     if(kind.includes('pending-destroy')||kind==='loading-abort-late-rejected-destroy'){await bounded(s.destroyEntered.promise);await delay(1250);check(settled,'owned pending destroy must not hold cancellation beyond1000ms grace');rawObserved.beforeDestroyRelease={settled};if(kind==='loading-abort-late-rejected-destroy')s.destroyGate.reject(cleanupFailure);else s.destroyGate.resolve()}
     await bounded(operation);check(!outcome.ok&&outcome.reason===reason,'caller reason must survive owned destroy settlement')
     if(kind==='loading-late-resolve'){s.loading.resolve(documentProtocol);await turn();await turn();check(s.metadataAfterAbort===0&&s.pages===0,'late loading resolution must not resume document/page admission')}
    }
   }
  }
 }finally{
  s.importGate.resolve();s.destroyGate.resolve();s.pageGate.resolve(textProtocol)
  if(s.tasks&&kind!=='cleanup-monotonic'&&kind!=='loading-late-resolve')s.loading.reject(ordinary)
  if(s.texts&&kind!=='cleanup-monotonic'&&kind!=='text-pending-abort'&&!extended)s.textGate.reject(ordinary)
  if(operation)await bounded(operation)
  await turn();await turn();await delay(20)
  performance.now=now;AbortSignal.timeout=nativeTimeout
 }
 if(s.tasks){check(s.destroys===s.tasks,'every owned task must be destroyed exactly once');check(s.options.data instanceof Uint8Array,'existing parser input type must be retained');check(s.options.useWorkerFetch===false&&s.options.isEvalSupported===false&&s.options.disableFontFace===true&&s.options.useSystemFonts===false&&s.options.verbosity===0,'existing getDocument options must be retained')}
 check(getEventListeners(caller.signal,'abort').length===abortListenerBefore,'caller listeners must be detached')
 check(sha(fs.readFileSync(sourcePath))===sourceBefore,'source must remain unchanged during a source case')
 for(const [k,v]of Object.entries(attempts))check(v===0,'physical attempt '+k)
 const geometryDefined=typeof globalThis.DOMMatrix!=='undefined'
 if(geometryDefined){const geometry=await import(pathToFileURL(path.join(backend,'node_modules/@napi-rs/canvas/geometry.js')));check(globalThis.DOMMatrix===geometry.DOMMatrix,'only unchanged official geometry class may be installed')}
 check(typeof globalThis.Path2D==='undefined'&&typeof globalThis.ImageData==='undefined','rendering APIs must not be fabricated')
 const receipt={kind,label,variant:config.variant??null,authoredTaskProtocolOnly:kind!=='genuine-generic-BTL',genericBTLOnly:kind==='genuine-generic-BTL',sourceSHA256:sourceBefore,tasks:s.tasks,destroys:s.destroys,pages:s.pages,texts:s.texts,metadataAfterAbort:s.metadataAfterAbort,callerAbortListeners:getEventListeners(caller.signal,'abort').length,expectedOptionalRootDenials,geometryDefined,permissions,attempts,rawObserved,failures}
 console.log('GAIL_PDF_LIFECYCLE_CASE '+JSON.stringify(receipt))
 assert.deepEqual(failures,[],JSON.stringify(receipt))
 return receipt
}

if(process.env.GAIL_PDF_LIFECYCLE_CASE){
 try{await scenario(JSON.parse(process.env.GAIL_PDF_LIFECYCLE_CASE))}catch(error){console.error(error);process.exitCode=1}
}else{
 const grants=[self,'package.json','scraper/gailindia.workday/pdf.js','scraper-support/shared/pdfDisplay.js','scraper-support/shared/nativeJobPosting.js','scraper-support/shared/rmkNativePairHtml.js','node_modules/@napi-rs/canvas/package.json','node_modules/@napi-rs/canvas/geometry.js','node_modules/pdfjs-dist/package.json','node_modules/pdfjs-dist/legacy/build/pdf.mjs','node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs','test/test-data/recruitmentGoal20261107/btl-current.json.gz'].map(p=>path.isAbsolute(p)?p:path.join(backend,p))
 const rootPackage=path.join(backend,'../package.json');if(fs.existsSync(rootPackage))grants.push(rootPackage)
 for(const config of cases)test('GAIL native PDF lifecycle '+config.kind+' '+config.label+(config.variant?' '+config.variant:''),{timeout:12000},()=>{
  const env={...process.env,NODE_OPTIONS:'',GAIL_PDF_LIFECYCLE_TEST_BACKEND:backend,GAIL_PDF_LIFECYCLE_CASE:JSON.stringify(config)};delete env.NODE_TEST_CONTEXT
  const args=['--permission',...grants.map(p=>'--allow-fs-read='+p),'--disallow-code-generation-from-strings','--unhandled-rejections=strict','--max-old-space-size=256',self]
  const child=spawnSync(process.execPath,args,{cwd:backend,env,encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:1024*1024})
  assert.equal(child.error,undefined,child.error?.message)
  const line=child.stdout.split(/\r?\n/).find(x=>x.startsWith('GAIL_PDF_LIFECYCLE_CASE ')),receipt=line?JSON.parse(line.slice('GAIL_PDF_LIFECYCLE_CASE '.length)):null
  console.log('GAIL_PDF_LIFECYCLE_CHILD '+JSON.stringify({config,exitCode:child.status,receipt}))
  assert.ok(receipt,child.stderr||child.stdout)
  assert.equal(child.status,0,child.stderr||child.stdout)
  assert.deepEqual(receipt.permissions,{addons:false,worker:false,child:false,'fs.write':false})
  assert.ok(Object.values(receipt.attempts).every(v=>v===0));assert.deepEqual(receipt.failures,[])
 })
}
