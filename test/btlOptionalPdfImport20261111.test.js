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

// The environment override permits a read-only, outside-backend RED draft.
// Installed in backend/test, the default is portable and needs no override.
const backend=path.resolve(process.env.BTL_OPTIONAL_PDF_TEST_BACKEND||fileURLToPath(new URL('../',import.meta.url)))
const self=fileURLToPath(import.meta.url),childMarker='--btl-optional-pdf-child'
const sha=value=>createHash('sha256').update(value).digest('hex')
const urls=Object.fromEntries(['script','currentReader','currentLegacy','native','currentPdf','nativePdf','currentErrors'].map(name=>[name,pathToFileURL(path.join(backend,'scraper/btlindia',name+'.js')).href]))
const CAREERS='https://www.btlnet.co.in/careers.php'
const reflect=promise=>promise.then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Independent BTL optional-import watchdog')),2500)})])}finally{clearTimeout(timer)}}
const reasonFor=label=>label==='frozen'?Object.freeze(Error('Authored frozen caller reason')):({null:null,false:false,zero:0,empty:''})[label]

async function sourceChild(mode,route,label){
 const attempts={network:0,database:0,browser:0,childWorker:0},imported=new Map(),optionalResolutions=[],optionalLoads=[]
 const deny=()=>{attempts.network++;throw Error('BTL optional-import controls deny physical network I/O')}
 globalThis.fetch=deny
 for(const module of [http,https]){module.request=deny;module.get=deny}
 http2.connect=deny;net.connect=deny;net.createConnection=deny;net.createServer=deny;net.Socket.prototype.connect=deny
 tls.connect=deny;tls.createServer=deny;dgram.createSocket=deny
 for(const module of [dns,dns.promises])for(const key of Object.keys(module))if(/^(?:lookup|resolve|reverse)/.test(key)&&typeof module[key]==='function')module[key]=deny
 const denyCapability=()=>{attempts.childWorker++;throw Error('BTL optional-import controls deny child/worker creation')}
 for(const key of ['exec','execFile','spawn','fork','execSync','execFileSync','spawnSync'])childProcess[key]=denyCapability
 workerThreads.Worker=class{constructor(){denyCapability()}}
 syncBuiltinESMExports()
 const permissions=Object.fromEntries(['addons','worker','child','fs.write'].map(kind=>[kind,process.permission.has(kind)]))
 const protocol=mode.startsWith('protocol-')
 // These two static authored modules control only the decoder import boundary.
 // They never implement pdfjs, return decoded models, or supply parser proof.
 const authored={
  'btl-authored:current':"await globalThis.__btlOptionalDecoder.load('current');export const readCurrentBtlPdf=(bytes,init)=>globalThis.__btlOptionalDecoder.read('current',bytes,init);",
  'btl-authored:legacy':"await globalThis.__btlOptionalDecoder.load('legacy');export const readNativePdf=(bytes,init)=>globalThis.__btlOptionalDecoder.read('legacy',bytes,init);",
 }
 const early=Object.freeze(Error('Decoder was loaded before an admitted PDF callback'))
 globalThis.__btlOptionalDecoder={load(){throw early},read(){throw early}}
 registerHooks({
  resolve(specifier,context,next){
   if(/^(?:mongoose|mongodb)(?:\/|$)/.test(specifier)||/saveToDB\.js(?:$|\?)/.test(specifier)){attempts.database++;throw Error('BTL controls deny database modules')}
   if(/^(?:puppeteer|playwright)(?:\/|$)/.test(specifier)){attempts.browser++;throw Error('BTL controls deny browser modules')}
   const resolved=next(specifier,context),kind=resolved.url===urls.currentPdf?'current':resolved.url===urls.nativePdf?'legacy':null
   if(kind){optionalResolutions.push({kind,parentURL:context.parentURL});if(protocol)return{url:'btl-authored:'+kind,shortCircuit:true}}
   return resolved
  },
  load(url,context,next){
   if(Object.hasOwn(authored,url)){optionalLoads.push(url);return{format:'module',source:authored[url],shortCircuit:true}}
   if(url.startsWith('file:')){
    const filename=fileURLToPath(url),relative=path.relative(backend,filename)
    if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&!relative.split(path.sep).includes('node_modules')){
     const bytes=fs.readFileSync(filename);imported.set(filename,{path:relative.replaceAll('\\','/'),sha256:sha(bytes),bytes:bytes.length,filename})
    }
    if(url===urls.currentPdf||url===urls.nativePdf)optionalLoads.push(url)
   }
   return next(url,context)
  },
 })
 const finish=()=>console.log('BTL_OPTIONAL_GUARD '+JSON.stringify({code:process.exitCode||0,attempts,permissions,optionalResolutions,optionalLoads,authoredDecoderBoundaryOnly:protocol,parserStub:false,DOMMatrixDefined:typeof globalThis.DOMMatrix!=='undefined',importedBackendFiles:[...imported.values()].map(({filename,...row})=>({...row,unchangedAtExit:sha(fs.readFileSync(filename))===row.sha256}))}))
 try{
  assert.deepEqual(permissions,{addons:false,worker:false,child:false,'fs.write':false})
  assert.equal(typeof globalThis.DOMMatrix,'undefined')
  const routeName=mode==='bad-html'?'script':{public:'script',publicLegacy:'script',current:'currentReader',legacy:'currentLegacy',native:'native'}[route]
  const entry=await import(urls[routeName])
  assert.equal(optionalResolutions.length,0,'Importing BTL must leave both optional PDF decoders unresolved')
  if(mode==='import')return
  const {isFailure}=await import(urls.currentErrors)
  const invoke=route==='public'||route==='publicLegacy'?entry.run:route==='current'?entry.runCurrentBtl:route==='legacy'?entry.runLegacyBtl:entry.collect
  let clocks=0,transports=0
  const clock=()=>{clocks++;return'2026-11-07T02:00:00Z'}
  const forbidden=()=>{transports++;throw Error('A no-PDF caller must not request source data')}
  const callOptions={now:clock,...(route==='legacy'||route==='publicLegacy'?{fetchText:forbidden,fetchPdf:forbidden}:{fetchResponse:forbidden})}
  if(mode==='callers'){
   for(const option of [{maxJobs:0},{maxPages:0}]){
    const jobs=await invoke({...callOptions,...option});assert.equal(jobs.length,0)
    assert.equal(clocks,0);assert.equal(transports,0);assert.equal(optionalResolutions.length,0)
   }
   for(const name of ['null','false','zero','empty','frozen']){
    const reason=reasonFor(name),caller=new AbortController();caller.abort(reason)
    const outcome=await reflect(invoke({...callOptions,signal:caller.signal}))
    assert.equal(outcome.ok,false);assert.equal(outcome.reason,reason);assert.equal(getEventListeners(caller.signal,'abort').length,0)
   }
   assert.equal(clocks,0);assert.equal(transports,0)
   for(const [option,kind]of [[{maxJobs:-1},RangeError],[{maxPages:1.5},RangeError],[{pdfTimeoutMs:15001},RangeError],[{readTimeoutMs:0},RangeError],[{observerTimeoutMs:0},RangeError],[{sourceTimeoutMs:240001},RangeError],[{onAudit:42},TypeError]]){
    const outcome=await reflect(invoke({...callOptions,...option}));assert.equal(outcome.ok,false);assert.ok(outcome.reason instanceof kind)
   }
   const invalidClock=await reflect(invoke({...callOptions,now:()=>new Date(NaN)}))
   assert.equal(invalidClock.ok,false);assert.equal(isFailure(invalidClock.reason),true);assert.match(invalidClock.reason.message,/invalid observation clock/)
   assert.equal(transports,0);assert.equal(optionalResolutions.length,0)
   console.log('BTL_OPTIONAL_RESULT '+JSON.stringify({mode,route,zeroCaps:2,exactPreabortReasons:5,invalidConfigurations:8,clocks,transports,optionalDecoderResolutions:0}));return
  }
  const fixtureBytes=fs.readFileSync(path.join(backend,'test/test-data/recruitmentGoal20261107/btl-current.json.gz'))
  assert.equal(sha(fixtureBytes),'1f8a6219f2feda1c553a44a2f5deff5ae7832286fd2e2b86823df31a5d22c10b')
  const fixture=JSON.parse(gunzipSync(fixtureBytes)),packets=new Map(fixture.packets.map(packet=>[packet.requestedURL,packet])),calls=[]
  for(const packet of packets.values()){const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.bodySHA256);assert.equal(bytes.length,packet.bodyBytes)}
  const original=url=>{const packet=packets.get(url);assert.ok(packet,'Only retained exact BTL response URLs are admitted');calls.push(url);return{...packet,bytes:Buffer.from(packet.bodyBase64,'base64')}}
  const fetchResponse=async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);assert.ok(init.signal instanceof AbortSignal);return original(url)}
  const fetchText=async(url,init)=>{assert.ok(init.signal instanceof AbortSignal);return original(url).bytes.toString('utf8')}
  const fetchPdf=async(url,init)=>{assert.ok(init.signal instanceof AbortSignal);return original(url).bytes}
  if(mode==='bad-html'){
   const bad=Buffer.from('<html><head><title>Another employer</title></head><body>No BTL role channel.</body></html>')
   const options=route==='legacy'?{fetchText:async()=>{calls.push(CAREERS);return bad.toString('utf8')}}:{fetchResponse:async()=>{calls.push(CAREERS);return{status:200,finalURL:CAREERS,headers:{'content-type':'text/html'},contentType:'text/html',bytes:bad}}}
   const outcome=await reflect(entry.run({now:clock,...options}))
   assert.equal(outcome.ok,false);assert.equal(isFailure(outcome.reason),true);assert.deepEqual(calls,[CAREERS]);assert.equal(optionalResolutions.length,0)
   if(route==='legacy'){assert.match(outcome.reason.cause.message,/btlindia native:/);assert.equal(outcome.reason.nativeCompatibilityAttempts.length,1)}
   else assert.match(outcome.reason.message,/publisher title differs/)
   console.log('BTL_OPTIONAL_RESULT '+JSON.stringify({mode,route,sourceOwnedFailure:true,sourceCalls:1,optionalDecoderResolutions:0}));return
  }
  if(mode==='supplied-decoder'){
   const reason=Object.freeze(Object.assign(Error('Authored supplied decoder failure'),{code:'AUTHORED_SUPPLIED_DECODER'})),caller=new AbortController();let supplied=0
   const rows=await entry.collect({fetchText,fetchPdf,now:clock,signal:caller.signal,decodePdf:async(bytes,init)=>{supplied++;assert.equal(sha(bytes),'5343c94153f6b157cf95a095b2a6d927fe31c294524a24638de59291861dfc0a');assert.equal(init.signal,caller.signal);throw reason}})
   assert.equal(supplied,1);assert.equal(rows.length,4);assert.equal(rows[0].rawNativeRoleEvidence.nativePdfFailure.kind,'AUTHORED_SUPPLIED_DECODER')
   assert.ok(rows.every(row=>row.jobDescription===null&&row.sourceDetailComplete===false));assert.equal(optionalResolutions.length,0)
   console.log('BTL_OPTIONAL_RESULT '+JSON.stringify({mode,route,suppliedDecoderCalls:supplied,heldRows:rows.length,optionalDecoderResolutions:0,parserProof:false}));return
  }
  if(mode==='actual-dependency'||mode==='actual-cached-dependency'){
   let originalFailure
   if(mode==='actual-cached-dependency'){
    try{await import(pathToFileURL(path.join(backend,'node_modules/pdfjs-dist/legacy/build/pdf.mjs')))}catch(reason){originalFailure=reason}
    assert.ok(originalFailure instanceof ReferenceError);assert.equal(originalFailure.message,'DOMMatrix is not defined')
   }
   const outcome=await reflect(entry.run({fetchResponse,now:clock}))
   if(originalFailure){
    assert.equal(outcome.ok,false);assert.equal(isFailure(outcome.reason),true);assert.match(outcome.reason.message,/PDF decode failed/);assert.equal(outcome.reason.cause,originalFailure)
    assert.ok(outcome.reason.nativeOriginalResponses.some(receipt=>receipt.contentType==='application/pdf'&&receipt.originalBodyComplete))
   }else{
    assert.equal(outcome.ok,true);assert.equal(outcome.value.length,4);assert.equal(calls.length,10)
    for(let index=0;index<4;index++){
     const row=outcome.value[index],expected=fixture.independentOracle.documents[index]
     assert.equal(row.nativeSourceRecord.pdfModel.pageCount,expected.pageCount);assert.equal(row.nativeSourceRecord.originalPDF.bodySHA256,expected.bodySHA256)
     assert.ok(row.jobDescription.length>2000);assert.equal(row.sourceDetailComplete,false);assert.equal(row.country,null)
    }
   }
   const geometry=await import('@napi-rs/canvas/geometry.js');assert.equal(globalThis.DOMMatrix,geometry.DOMMatrix)
   assert.ok(calls.length>=2);assert.equal(calls[0],CAREERS);assert.ok(optionalLoads.includes(urls.currentPdf))
   console.log('BTL_OPTIONAL_RESULT '+JSON.stringify({mode,route,retainedDataOnly:true,sourceCalls:calls.length,originalCachedParserCause:Boolean(originalFailure),genuineFreshParserSuccess:!originalFailure,parserStub:false}));return
  }
  assert.equal(protocol,true)
  const boundary=route==='legacy'?'legacy':'current',entered=deferred(),late=deferred(),caller=new AbortController(),ordinary=Object.freeze(Error('Authored decoder-boundary failure')),reason=reasonFor(label)
  let loads=0,reads=0,observedSignal
  const loading=mode.endsWith('-loading'),cancel=mode.startsWith('protocol-cancel-'),deadline=mode.startsWith('protocol-pdf-deadline-')||mode==='protocol-source-deadline-loading'
  globalThis.__btlOptionalDecoder={
   async load(kind){assert.equal(kind,boundary);loads++;if(loading){entered.resolve();if(mode==='protocol-failure-loading')throw ordinary;await late.promise}},
   async read(kind,bytes,init){assert.equal(kind,boundary);reads++;assert.ok(init.signal instanceof AbortSignal);observedSignal=init.signal;init.signal.throwIfAborted();const packet=[...packets.values()].find(packet=>packet.bodySHA256===sha(bytes));assert.equal(packet?.contentType,'application/pdf');assert.ok(calls.includes(packet.requestedURL));entered.resolve();if(mode==='protocol-failure-decoding')throw ordinary;await late.promise;init.signal.throwIfAborted();throw ordinary},
  }
  const options={now:clock,signal:caller.signal,...(route==='legacy'?{fetchText,fetchPdf}:{fetchResponse}),...(deadline?{pdfTimeoutMs:mode==='protocol-source-deadline-loading'?1000:100,sourceTimeoutMs:mode==='protocol-source-deadline-loading'?200:2000}:{})}
  const pending=reflect(invoke(options))
  try{
   await bounded(entered.promise)
   if(cancel)caller.abort(reason)
   const outcome=await bounded(pending)
   assert.equal(outcome.ok,false)
   if(cancel)assert.equal(outcome.reason,reason)
   else if(deadline){assert.equal(isFailure(outcome.reason),true);assert.match(outcome.reason.message,mode==='protocol-source-deadline-loading'?/source deadline exceeded/:/PDF decode deadline exceeded/)}
   else{assert.equal(isFailure(outcome.reason),true);assert.equal(outcome.reason.cause,ordinary)}
   if(observedSignal)assert.equal(observedSignal.aborted,true)
   const before=reads;late.resolve();await turn();await turn();await turn()
   assert.equal(reads,before,'Late import settlement must not invoke a decoder after source settlement')
   if(loading)assert.equal(reads,0)
   assert.equal(loads,1);assert.equal(getEventListeners(caller.signal,'abort').length,0)
   assert.ok(calls.length>=2);assert.equal(calls[0],CAREERS)
   console.log('BTL_OPTIONAL_RESULT '+JSON.stringify({mode,route,label:label||null,authoredDecoderBoundaryOnly:true,parserStub:false,loads,reads,sourceCalls:calls.length,exactExpectedRejection:true,lateDecoderAdmission:false}))
  }finally{late.resolve()}
 }catch(error){console.error(error);process.exitCode=1}finally{finish()}
}

if(process.argv.includes(childMarker)){
 const index=process.argv.indexOf(childMarker);await sourceChild(...process.argv.slice(index+1))
}else{
 const run=(mode,route,label)=>{
  const sourceReads=['scraper/btlindia','scraper/anandengineeringproductspvtltd','scraper-support/utils','scraper-support/native-sources','scraper-support/shared/pdfDisplay.js','src/utils/jobSourceContent.js','test/test-data/recruitmentGoal20261107/btl-current.json.gz','package.json','node_modules/@napi-rs/canvas/package.json','node_modules/@napi-rs/canvas/geometry.js','node_modules/pdfjs-dist/package.json','node_modules/pdfjs-dist/legacy/build/pdf.mjs','node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs','node_modules/pdfjs-dist/standard_fonts','node_modules/pdfjs-dist/cmaps','node_modules/pdfjs-dist/wasm'].map(name=>path.join(backend,name)).concat([self,path.resolve(backend,'../package.json')])
  const args=['--permission',...sourceReads.map(name=>'--allow-fs-read='+name),'--unhandled-rejections=strict','--disallow-code-generation-from-strings',self,childMarker,mode,route,...(label?[label]:[])]
  const result=childProcess.spawnSync(process.execPath,args,{cwd:backend,env:{...process.env,NODE_OPTIONS:'',BTL_OPTIONAL_PDF_TEST_BACKEND:backend},encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:2*1024*1024})
  assert.equal(result.error,undefined,result.error?.message)
  const line=result.stdout.split(/\r?\n/).find(row=>row.startsWith('BTL_OPTIONAL_GUARD ')),guard=line?JSON.parse(line.slice('BTL_OPTIONAL_GUARD '.length)):null
  console.log('BTL_OPTIONAL_CHILD '+JSON.stringify({mode,route,label:label||null,exitCode:result.status,guard}))
  assert.ok(guard,'The source child must emit its restriction receipt')
  assert.deepEqual(guard.attempts,{network:0,database:0,browser:0,childWorker:0})
  assert.deepEqual(guard.permissions,{addons:false,worker:false,child:false,'fs.write':false})
  assert.equal(guard.DOMMatrixDefined,mode==='actual-dependency'||mode==='actual-cached-dependency');assert.ok(guard.importedBackendFiles.every(row=>row.unchangedAtExit))
  assert.equal(result.status,0,result.stderr||result.stdout)
 }
 for(const route of ['public','current','legacy','native'])test('BTL '+route+' actual import does not load optional PDF decoders',()=>run('import',route))
 for(const route of ['public','publicLegacy','current','legacy'])test('BTL '+route+' actual zero caps, opaque preabort and invalid controls precede decoder resolution',()=>run('callers',route))
 for(const route of ['current','legacy'])test('BTL public '+route+' bad HTML produces a source-owned failure before decoder resolution',()=>run('bad-html',route))
 test('BTL supplied native collect decoder remains in control without optional resolution',()=>run('supplied-decoder','native'))
 test('BTL admitted retained PDF uses genuine geometry and all four complete native models',()=>run('actual-dependency','public'))
 test('BTL raw-first failed canonical parser preserves its original cached cause after genuine initialization',()=>run('actual-cached-dependency','public'))
 for(const route of ['current','legacy']){
  for(const stage of ['loading','decoding']){
   test('BTL '+route+' authored '+stage+' failure preserves its exact cause inside the decode gate',()=>run('protocol-failure-'+stage,route))
   for(const label of ['null','frozen'])test('BTL '+route+' cancellation during optional '+stage+' preserves '+label,()=>run('protocol-cancel-'+stage,route,label))
   test('BTL '+route+' PDF gate bounds optional '+stage+' and prevents late decoder admission',()=>run('protocol-pdf-deadline-'+stage,route))
  }
  test('BTL '+route+' source deadline bounds optional decoder loading',()=>run('protocol-source-deadline-loading',route))
 }
}
