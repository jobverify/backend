import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {registerHooks} from 'node:module'
import {getEventListeners} from 'node:events'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'

// This portable test is drafted outside backend until explicit source GO.
// Run from backend. Protocol modules below are labelled authored module-loader
// controls; they never return a parsed PDF model or establish native facts.
const backend=pathToFileURL(path.resolve(process.cwd())+path.sep)
const targets={bhel:{directory:'scraper/bharatheavyelectricals/',public:'script.js',decoder:'pdf20261107.js',export:'readBhelNativePdf'},nitara:{directory:'scraper/nitaragormalonellp/',public:'script.js',decoder:'nativePdf.js',export:'readNativePdf'}}
const controls=new Map();let nextId=0
registerHooks({resolve(specifier,context,next){
 const result=next(specifier,context),parent=context.parentURL&&new URL(context.parentURL),tag=parent?.searchParams.get('optional-pdf-protocol')
 if(!tag||!result.url.startsWith(backend.href))return result
 const value=new URL(result.url),relative=value.pathname.slice(backend.pathname.length)
 if(Object.values(targets).some(row=>relative.startsWith(row.directory))){value.searchParams.set('optional-pdf-protocol',tag);return {...result,url:value.href}}
 return result
},load(url,context,next){
 const value=new URL(url),tag=value.searchParams.get('optional-pdf-protocol'),control=controls.get(tag)
 if(control&&value.href.startsWith(backend.href)){
  const target=targets[control.family],relative=value.pathname.slice(backend.pathname.length)
  if(relative===target.directory+target.decoder){
   const key=JSON.stringify(tag),name=target.export
   return {format:'module',shortCircuit:true,source:`const control=globalThis.__otherOptionalPdfProtocols.get(${key}); control.moduleLoads++; control.loadedAfterReads=control.reads; control.entered.resolve(); await control.ready.promise; export const ${name}=(...args)=>{control.decoderCalls++; return control.decode(...args)}`}
  }
 }
 return next(url,context)
}})
globalThis.__otherOptionalPdfProtocols=controls
const reflect=async operation=>{try{return {ok:true,value:await operation()}}catch(reason){return {ok:false,reason}}}
const exact=(result,reason)=>{assert.equal(result.ok,false);assert.ok(Object.is(result.reason,reason),'Exact caller reason must survive')}
const at='2026-11-07T00:00:00.000Z',turn=()=>new Promise(resolve=>setImmediate(resolve))
const fixture=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL(name,backend))))
const bhelPackets=fixture('test/test-data/recruitmentGoal20261107/bhel-current-public-chain.json.gz').packets
const nitaraPackets=fixture('scraper/nitaragormalonellp/test-data/2026-10-31-native-packets.json.gz').requests
const makeControl=(family,{pending=false,decode=()=>{throw Error('Authored decoder must remain unadmitted')}}={})=>{
 const value={family,moduleLoads:0,decoderCalls:0,reads:0,loadedAfterReads:null,entered:Promise.withResolvers(),ready:Promise.withResolvers(),decode}
 if(!pending)value.ready.resolve()
 const key=String(++nextId);controls.set(key,value);return {key,value}
}
const publicImport=control=>{const row=targets[control.value.family],url=new URL(row.directory+row.public,backend);url.searchParams.set('optional-pdf-protocol',control.key);return import(url.href)}
const ordinaryReads=(family,control)=>family==='bhel'?{
 fetchPage:async url=>{control.reads++;const row=bhelPackets.find(value=>value.requestedURL===url);assert.ok(row,'Existing BHEL packet required');return {url:row.finalURL,status:row.status,body:Buffer.from(row.bodyBase64,'base64').toString('utf8'),rawBodyBase64:row.bodyBase64,bodyComplete:true,headers:row.headers}},now:()=>at,
}:{fetchText:async url=>{control.reads++;const row=nitaraPackets.find(value=>value.url===url);assert.ok(row,'Existing Nitara packet required');return Buffer.from(row.body,row.bodyEncoding).toString('utf8')},fetchPdf:async url=>{control.reads++;const row=nitaraPackets.find(value=>value.url===url);assert.ok(row,'Existing Nitara PDF bytes required');return Buffer.from(row.body,row.bodyEncoding)},now:()=>at}
const assertHeld=(family,jobs)=>{
 if(family==='bhel'){assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)}
 else{assert.ok(jobs.length>0);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);for(const row of jobs){assert.equal(row.jobDescription,null);assert.equal(row.country,null);assert.equal(row.sourceListingComplete,false)}}
}
const within=async pending=>{let timer;try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Authored control did not settle before module release')),500)})])}finally{clearTimeout(timer)}}

for(const [family,row]of Object.entries(targets)){
 test(`${family} actual public module imports without needing the installed display decoder`,async()=>{const module=await import(new URL(row.directory+row.public,backend));assert.equal(typeof module.run,'function')})
 test(`${family} direct helper returns a genuine retained PDF model with official geometry`,async()=>{
  const module=await import(new URL(row.directory+row.decoder,backend)),packets=family==='bhel'?bhelPackets:nitaraPackets
  const packet=packets.find(value=>/\.pdf(?:$|\?)/i.test(value.requestedURL??value.url)),bytes=Buffer.from(packet.bodyBase64??packet.body,packet.bodyEncoding??'base64')
  const result=await module[row.export](bytes)
  assert.ok(result.text.length>30);assert.ok(result.pages>0);assert.equal(result.publicationDateQualified,false);assert.ok(Array.isArray(result.visibilityLimits))
  if(family==='bhel')assert.equal(result.pageModels.length,result.pageCount)
  const geometry=await import('@napi-rs/canvas/geometry.js');assert.equal(globalThis.DOMMatrix,geometry.DOMMatrix)
 })
}
for(const cap of ['maxJobs','maxPages','maxRequests'])test(`BHEL zero ${cap} does not initialize an authored decoder module`,async()=>{
 const control=makeControl('bhel'),module=await publicImport(control);let clocks=0
 const result=await module.run({[cap]:0,fetchPage:()=>{control.value.reads++;throw Error('No acquisition')},now:()=>{clocks++;return at}})
 assertHeld('bhel',result);assert.equal(control.value.reads,0);assert.equal(clocks,0);assert.equal(control.value.decoderCalls,0);assert.equal(control.value.moduleLoads,0)
})
const reasons=[['null',()=>null],['false',()=>false],['zero',()=>0],['empty',()=> ''],['frozen',()=>Object.freeze(Error('Authored frozen caller'))],['default',()=>AbortSignal.abort().reason]]
for(const family of Object.keys(targets))for(const [label,makeReason]of reasons)test(`${family} preabort ${label} does not initialize the authored decoder module`,async()=>{
 const control=makeControl(family),module=await publicImport(control),caller=new AbortController(),reason=makeReason();caller.abort(reason)
 const result=await reflect(()=>module.run({signal:caller.signal,fetchPage:()=>{control.value.reads++;throw Error('No read')},fetchText:()=>{control.value.reads++;throw Error('No read')}}))
 exact(result,reason);assert.equal(control.value.reads,0);assert.equal(control.value.decoderCalls,0);assert.equal(control.value.moduleLoads,0);assert.equal(getEventListeners(caller.signal,'abort').length,0)
})
for(const family of Object.keys(targets))test(`${family} invalid homepage fails before authored decoder initialization`,async()=>{
 const control=makeControl(family),module=await publicImport(control)
 const result=await reflect(()=>module.run(family==='bhel'?{fetchPage:async url=>{control.value.reads++;return {url,status:200,body:'Authored invalid homepage',bodyComplete:true}}}:{fetchText:async()=>{control.value.reads++;return 'Authored invalid homepage'}}))
 assert.equal(result.ok,false);assert.equal(control.value.reads,1);assert.equal(control.value.decoderCalls,0);assert.equal(control.value.moduleLoads,0)
})
test('BHEL invalid configuration fails before authored decoder initialization',async()=>{
 const control=makeControl('bhel'),module=await publicImport(control),result=await reflect(()=>module.run({maxJobs:-1}))
 assert.equal(result.ok,false);assert.equal(result.reason.code,'BHEL_INVALID_OPTIONS');assert.equal(control.value.moduleLoads,0);assert.equal(control.value.decoderCalls,0)
})
for(const family of Object.keys(targets))test(`${family} ordinary acquisition failure stays before authored decoder initialization`,async()=>{
 const control=makeControl(family),module=await publicImport(control),primary=Object.freeze(Error('Authored acquisition primary'))
 const produce=async()=>{control.value.reads++;throw primary},result=await reflect(()=>module.run(family==='bhel'?{fetchPage:produce}:{fetchText:produce}))
 assert.equal(result.ok,false);assert.ok(result.reason===primary||result.reason.cause===primary);assert.equal(control.value.reads,1);assert.equal(control.value.decoderCalls,0);assert.equal(control.value.moduleLoads,0)
})
for(const family of Object.keys(targets))test(`${family} retained HTML and bytes admit an authored failure-only decoder protocol after the PDF read`,async()=>{
 const primary=Object.assign(Error('Authored decoder-module protocol failure'),{code:'AUTHORED_DECODER_PROTOCOL'}),control=makeControl(family,{decode:()=>{throw primary}}),module=await publicImport(control)
 const jobs=await module.run(ordinaryReads(family,control.value));assertHeld(family,jobs)
 assert.equal(control.value.decoderCalls,1);assert.equal(control.value.moduleLoads,1);assert.equal(control.value.loadedAfterReads,3)
})
for(const family of Object.keys(targets))test(`${family} pending authored decoder import cancellation settles without later decoder admission`,async()=>{
 const control=makeControl(family,{pending:true}),caller=new AbortController(),reason=Object.freeze(Error('Authored pending-import caller'))
 const imported=publicImport(control),first=await Promise.race([imported.then(module=>({module})),control.value.entered.promise.then(()=>({premature:true}))])
 if(first.premature){control.value.ready.resolve();await imported;assert.fail('Decoder module initialization happened before any run or admitted PDF')}
 const pending=reflect(()=>first.module.run({...ordinaryReads(family,control.value),signal:caller.signal}));await control.value.entered.promise;caller.abort(reason)
 let result
 try{result=await within(pending)}finally{control.value.ready.reject(Error('Authored late module initialization rejection'));await pending;await turn()}
 exact(result,reason);assert.equal(control.value.decoderCalls,0);assert.equal(control.value.loadedAfterReads,3);assert.equal(getEventListeners(caller.signal,'abort').length,0)
})
test('BHEL existing PDF deadline bounds a pending authored import and stops late decoder admission',async()=>{
 const control=makeControl('bhel',{pending:true}),imported=publicImport(control),first=await Promise.race([imported.then(module=>({module})),control.value.entered.promise.then(()=>({premature:true}))])
 if(first.premature){control.value.ready.resolve();await imported;assert.fail('Decoder module initialization happened before an admitted PDF')}
 const pending=first.module.run({...ordinaryReads('bhel',control.value),pdfTimeoutMs:20})
 let jobs
 try{jobs=await within(pending)}finally{control.value.ready.resolve();await pending;await turn()}
 assertHeld('bhel',jobs);assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.code,'BHEL_PDF_TIMEOUT');assert.equal(control.value.decoderCalls,0)
})
