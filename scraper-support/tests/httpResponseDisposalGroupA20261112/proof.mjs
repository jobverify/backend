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
const manifestPath=path.resolve(process.env.HTTP_DISPOSAL_CLOSURE||path.join(here,'closure.json'))
const sha=raw=>createHash('sha256').update(raw).digest('hex')
const realRead=fs.readFileSync,manifest=JSON.parse(realRead(manifestPath,'utf8'))
const testSHA256=sha(realRead(self)),manifestSHA256=sha(realRead(manifestPath))
const RealResponse=globalThis.Response,RealReadableStream=globalThis.ReadableStream
const modulePins=new Map(manifest.modules.map(row=>[path.resolve(backend,row.path),row]))
const filePins=new Map([...manifest.modules,...manifest.additional_reads].map(row=>[path.resolve(backend,row.path),row]))
const readable=new Set([...filePins.keys(),self,manifestPath,...manifest.absent_allowed_read_paths.map(name=>path.resolve(backend,name))])
for(const [filename,pin]of filePins){const raw=realRead(filename);assert.equal(sha(raw),pin.sha256,filename);assert.equal(raw.length,pin.bytes)}
const attempts={network:0,database:0,browser:0,child:0,worker:0,addon:0,fsWrite:0,unexpectedModule:0,unexpectedRead:0,unexpectedRequest:0}
const deny=kind=>()=>{attempts[kind]++;throw Error('Group A response disposal denies '+kind)}
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
const modules={}
for(const name of manifest.entries)modules[name]=await import(pathToFileURL(path.join(backend,name)))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),turn=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
const reflect=pending=>Promise.resolve(pending).then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const observe=pending=>{const box={settled:false,result:null};box.pending=reflect(pending).then(result=>{box.settled=true;box.result=result;return result});return box}
const observations=[],registered=[]
const runCase=(name,body)=>{registered.push(name);test(name,{concurrency:false,timeout:10000},body)}
const response=(body,url,status=200,headers={'content-type':'text/html'})=>{
 const value=new RealResponse(body,{status,headers});Object.defineProperty(value,'url',{value:url});return value
}
const streamControl=mode=>{
 const entered=deferred(),release=deferred(),cleanup=Object.freeze(Error('AUTHORED underlying cancellation failure'))
 let cancels=0,reason
 const stream=new RealReadableStream({cancel(value){cancels++;reason=value;entered.resolve();if(mode==='throw')throw cleanup;if(mode==='reject')return Promise.reject(cleanup);if(mode==='stall'||mode==='prompt')return release.promise}})
 return{stream,entered,release,cleanup,get cancels(){return cancels},get reason(){return reason}}
}
const setFetch=(expected,handler,calls)=>{globalThis.fetch=async(input,init={})=>{
 const url=String(input);if(!expected.includes(url))return deny('unexpectedRequest')()
 calls.push({url,method:init.method||'GET',redirect:init.redirect,signal:init.signal});assert.ok(init.signal instanceof AbortSignal)
 return handler(url,init)
}}
const errorRecord=result=>result.ok?{ok:true}:{ok:false,reasonType:typeof result.reason,...(result.reason instanceof Error?{name:result.reason.name,message:result.reason.message,status:result.reason.status,code:result.reason.code}:{})}
const opaque=()=>Object.freeze(Object.defineProperties({authoredCaller:true},{message:{get(){throw Error('Opaque caller message must not be read')}},code:{get(){throw Error('Opaque caller code must not be read')}}}))
const BOT_PROGRAM='/_astro/index.astro_astro_type_script_index_0_lang.qeH_4dqN.js'
const BOT_INITIAL='<html><head><meta property="og:site_name" content="Botminds"><link rel="canonical" href="https://www.botminds.ai/careers"><script type="application/ld+json">{"@type":"Organization","name":"Botminds","url":"https://www.botminds.ai"}</script><script type="module" src="'+BOT_PROGRAM+'"></script></head><body><div id="jobs"></div></body></html>'
const CREW_PAGE={status:200,url:'https://crewbloom.com/',html:'<title>CrewBloom Careers - AUTHORED CONTROL</title><h1>CrewBloom careers</h1><a href="https://apply.workable.com/crewbloom/">Explore remote roles</a>'}
const crewPage=async url=>{assert.equal(url,CREW_PAGE.url);return{...CREW_PAGE}}
const FLOWS=[
 {name:'Paradox FedEx current default reader',target:'https://careers.fedex.com/jobs?filter[country][0]=India',read:signal=>modules['scraper-support/shared/paradoxPublicInventory.js'].createParadoxPublicScraper('fedex').run({signal})},
 {name:'Aavas current default page',target:'https://www.aavas.in/career',read:signal=>modules['scraper/aavasfinanciers.workday/native.js'].runNative({signal})},
 {name:'Aplazo current default text',target:'https://www.aplazocareers.mx/',read:signal=>modules['scraper/aplazo/nativeCollector.js'].runNativeAplazo({signal})},
 {name:'Botminds current declared API client',target:'https://www.botminds.ai'+BOT_PROGRAM,read:signal=>modules['scraper/botminds/currentPublicApi.js'].runBotmindsPublicApi(BOT_INITIAL,{signal})},
 {name:'Bluestock exported archival nativeFetch',target:'https://bluestock.in/careers/',read:signal=>modules['scraper/bluestock/native.js'].nativeFetch('https://bluestock.in/careers/',{signal})},
 {name:'Buyhatke current default text',target:'https://compare.buyhatke.com/company/',read:signal=>modules['scraper/buyhatke/script.js'].run({signal})},
 {name:'Cloud Ambassadors exported legacy nativeFetch',target:'https://cloudambassadors.com/careers/',read:signal=>modules['scraper/cloudambassadors/native.js'].nativeFetch('https://cloudambassadors.com/careers/',{signal})},
 {name:'Continual Engine current nativeFetch',target:'https://www.continualengine.com/careers/',read:signal=>modules['scraper/continualengine/native.js'].nativeFetch('https://www.continualengine.com/careers/',{signal})},
 {name:'CrewBloom current default account JSON',target:'https://apply.workable.com/api/v1/accounts/crewbloom?full=true',read:signal=>modules['scraper/crewbloom/script.js'].run({signal,fetchPage:crewPage})},
 {name:'Credresolve current default text',target:'https://credresolve.co.in/',read:signal=>modules['scraper/credresolve/script.js'].run({signal})},
]

// Mutation caught: treating cancellation failure as the HTTP failure, returning
// while prompt cleanup is still owned, hanging behind a cancel promise, or
// replacing an external caller's opaque reason with a transport error.
for(const flow of FLOWS)for(const kind of['throw-403','reject-429','stall-503','caller-opaque-stall','ordinary-403','prompt-owned-403','preabort']){
 runCase(flow.name+' / '+kind,async()=>{
  const mode=kind.startsWith('throw')?'throw':kind.startsWith('reject')?'reject':kind.includes('stall')?'stall':kind.startsWith('prompt')?'prompt':'ordinary'
  const control=streamControl(mode),calls=[],caller=new AbortController(),callerReason=opaque()
  const status=kind==='reject-429'?429:kind==='stall-503'?503:403
  const value=response(control.stream,flow.target,status)
  setFetch([flow.target],()=>value,calls)
  if(kind==='preabort')caller.abort(callerReason)
  const box=observe(flow.read(caller.signal))
  try{
   if(kind==='stall-503'){
    await control.entered.promise;await pause(1250)
    assert.equal(box.settled,true,'Known HTTP503 must settle within finite cleanup grace')
   }else if(kind==='caller-opaque-stall'){
    await control.entered.promise;caller.abort(callerReason);await pause(100)
    assert.equal(box.settled,true,'External caller must settle while underlying cancellation remains pending')
   }else if(kind==='prompt-owned-403'){
    await control.entered.promise;await pause(20);assert.equal(box.settled,false,'Prompt disposal must remain owned until it settles');control.release.resolve()
   }
   const result=await box.pending
   if(kind==='caller-opaque-stall'||kind==='preabort')assert.equal(result.reason,callerReason)
   else{assert.equal(result.ok,false);assert.equal(result.reason.status,status,'The observed primary HTTP status must survive cancellation');if(flow.name.startsWith('Aavas'))assert.equal(result.reason.stage,'official-careers')}
   assert.equal(calls.length,kind==='preabort'?0:1);assert.equal(control.cancels,kind==='preabort'?0:1)
   observations.push({name:flow.name,kind,...errorRecord(result),calls:calls.length,cancels:control.cancels})
  }finally{control.release.resolve();await box.pending;await turn();globalThis.fetch=deny('network')}
 })
}

const COUCH_API='https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs?content=true'
const COUCH_PAGE='<title>Join the Couchbase Team - Careers</title><link rel="canonical" href="https://www.couchbase.com/careers/"><section aria-label="Open Positions" data-api-url="https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs" data-bucket-id="4488138006"></section>'
const couchRead=signal=>modules['scraper/couchbase/script.js'].run({signal,fetchText:async url=>{assert.equal(url,'https://www.couchbase.com/careers/');return COUCH_PAGE}})
const IDENTITY=[
 {name:'Aavas final URL',target:FLOWS[1].target,read:FLOWS[1].read,want:/unverified response final URL\/body/},
 {name:'Aplazo final URL',target:FLOWS[2].target,read:FLOWS[2].read,want:/unavailable or redirected/},
 ...[4,5,6,7,9].map(index=>({name:FLOWS[index].name+' final URL',target:FLOWS[index].target,read:FLOWS[index].read,want:/unexpected native redirect/})),
 {name:'Couchbase mandatory JSON final URL',target:COUCH_API,read:couchRead,want:/response URL or content-type identity changed/},
 {name:'Couchbase mandatory JSON MIME',target:COUCH_API,read:couchRead,want:/response URL or content-type identity changed/,mime:true},
]
for(const flow of IDENTITY)for(const kind of['reject','stall'])runCase(flow.name+' / '+kind,async()=>{
 const control=streamControl(kind),calls=[],caller=new AbortController()
 const value=response(control.stream,flow.mime?flow.target:'https://foreign-authored-negative.invalid/other',200,{'content-type':flow.mime?'text/plain':flow.name.startsWith('Couchbase')?'application/json':'text/html'})
 setFetch([flow.target],()=>value,calls);const box=observe(flow.read(caller.signal))
 try{
  if(kind==='stall'){await control.entered.promise;await pause(1250);assert.equal(box.settled,true,'Known identity failure must settle within finite cleanup grace')}
  const result=await box.pending;assert.equal(result.ok,false);assert.match(result.reason.message,flow.want);assert.equal(calls.length,1);assert.equal(control.cancels,1)
  observations.push({name:flow.name,kind,...errorRecord(result),calls:calls.length,cancels:control.cancels})
 }finally{control.release.resolve();await box.pending;await turn();globalThis.fetch=deny('network')}
})
runCase('Couchbase mandatory JSON / caller null abort while cleanup pending',async()=>{
 const control=streamControl('stall'),calls=[],caller=new AbortController()
 setFetch([COUCH_API],()=>response(control.stream,COUCH_API,200,{'content-type':'text/plain'}),calls);const box=observe(couchRead(caller.signal))
 try{await control.entered.promise;caller.abort(null);await pause(100);assert.equal(box.settled,true);assert.equal(box.result.reason,null);assert.equal(calls.length,1)}
 finally{control.release.resolve();await box.pending;await turn();globalThis.fetch=deny('network')}
})

const APLAZO_CAREERS='https://www.aplazocareers.mx/',APLAZO_API='https://api.ashbyhq.com/posting-api/job-board/aplazo'
const APLAZO_PAGE='<html><head><title>Inicio | Misitio</title><link rel="canonical" href="https://www.aplazocareers.mx"></head><body><h2>Careers</h2><p>En APLAZO AUTHORED CONTROL</p><a href="https://jobs.ashbyhq.com/aplazo">Conoce nuestras vacantes</a></body></html>'
for(const branch of['declared-byte-budget','API-MIME','reader-byte-budget'])for(const kind of['reject','stall'])runCase('Aplazo '+branch+' / '+kind,async()=>{
 const entered=deferred(),release=deferred(),cleanup=Error('AUTHORED reader cleanup failure'),calls=[]
 let cancels=0,cancelReason,readResponse
 const source={cancel(reason){cancels++;cancelReason=reason;entered.resolve();return kind==='reject'?Promise.reject(cleanup):release.promise}}
 if(branch==='reader-byte-budget')source.pull=controller=>controller.enqueue(new Uint8Array(800000))
 const stream=new RealReadableStream(source)
 const target=branch==='API-MIME'?APLAZO_API:APLAZO_CAREERS
 const headers={'content-type':branch==='API-MIME'?'text/html':'text/html',...(branch==='declared-byte-budget'?{'content-length':'3000001'}:{})}
 readResponse=response(stream,target,200,headers)
 setFetch(branch==='API-MIME'?[APLAZO_CAREERS,APLAZO_API]:[APLAZO_CAREERS],url=>url===target?readResponse:response(APLAZO_PAGE,APLAZO_CAREERS),calls)
 const box=observe(modules['scraper/aplazo/nativeCollector.js'].runNativeAplazo())
 try{
  await entered.promise
  if(kind==='stall'){if(branch==='reader-byte-budget')assert.equal(readResponse.body.locked,true);await pause(1250);assert.equal(box.settled,true,'Known budget/MIME rejection must not wait forever behind cleanup')}
  const result=await box.pending;assert.equal(result.ok,false);assert.match(result.reason.message,branch==='API-MIME'?/not JSON/:/source budget/);assert.equal(cancels,1)
  if(branch==='reader-byte-budget'){assert.equal(cancelReason,result.reason,'Reader disposal must retain the original primary error as its cancellation reason');assert.equal(readResponse.body.locked,false,'Acquired reader lock must be released')}
  assert.equal(calls.length,branch==='API-MIME'?2:1)
  observations.push({name:'Aplazo '+branch,kind,...errorRecord(result),cancels,calls:calls.length,readerUnlocked:!readResponse.body.locked})
 }finally{release.resolve();await box.pending;await turn();globalThis.fetch=deny('network')}
})

const ALL_OFFICIAL='https://www.allcargologistics.com/about-us/careers',ALL_ORIGIN='https://allcargologistics.darwinbox.in'
const ALL_HOME=ALL_ORIGIN+'/ms/candidatev2/main/careers/home',ALL_SEED=ALL_ORIGIN+'/ms/candidatev2/main/careers/allJobs',ALL_API=ALL_ORIGIN+'/ms/candidateapi/job/alljobs?companyId=main'
const ALL_PAGE='<title>Careers At Allcargo Logistics</title><a href="'+ALL_HOME+'">Join Our Team</a>'
const ALL_NATIVE='<title>Allcargo Logistics Ltd.</title><meta property="og:title" content="Allcargo Logistics Ltd."><body>Allcargo Logistics Ltd.</body>'
for(const kind of['protected-http-reject','protected-http-stall','seed-prompt-owned','seed-reject','seed-stall','seed-caller-zero'])runCase('Allcargo '+kind,async()=>{
 const mode=kind.endsWith('reject')?'reject':kind.includes('stall')||kind==='seed-caller-zero'?'stall':'prompt'
 const control=streamControl(mode),calls=[],caller=new AbortController();let seeds=0,listingCalls=0
 const fetchImpl=async(url,init={})=>{
  if(![ALL_OFFICIAL,ALL_HOME,ALL_SEED,ALL_API].includes(url))return deny('unexpectedRequest')()
  calls.push({url,signal:init.signal});assert.ok(init.signal instanceof AbortSignal)
  if(kind.startsWith('protected-http'))return response(control.stream,url,403)
  if(url===ALL_OFFICIAL)return response(ALL_PAGE,url)
  if(url===ALL_HOME)return response(ALL_NATIVE,url)
  if(url===ALL_API){listingCalls++;assert.equal(control.cancels,1);assert.equal(init.method,'POST');assert.equal(init.headers.Origin,ALL_ORIGIN);assert.equal(init.headers.Referer,ALL_SEED);assert.match(init.headers.Cookie,/public_session=authored/);assert.deepEqual(JSON.parse(init.body),{companyId:'main',sort_option:'new',limit:10,page:1});return response('{"status":"success","data":[],"job_counts":0}',url,200,{'content-type':'application/json'})}
  seeds++;return response(seeds===2?control.stream:ALL_NATIVE,url,200,{'content-type':'text/html','set-cookie':'public_session=authored; Path=/; Secure; HttpOnly'})
 }
 const box=observe(modules['scraper/allcargologistics/nativeInventory.js'].runCurrentAllcargoInventory({fetchImpl,signal:caller.signal}))
 try{
  await control.entered.promise
  if(kind==='seed-prompt-owned'){await pause(20);assert.equal(box.settled,false);assert.equal(listingCalls,0);control.release.resolve()}
  if(kind==='seed-stall'){await pause(1250);assert.equal(box.settled,true,'Strict successful seed cleanup must fail within finite grace');assert.equal(box.result.ok,false);assert.equal(box.result.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT');assert.equal(listingCalls,0)}
  if(kind==='seed-caller-zero'){caller.abort(0);await pause(100);assert.equal(box.settled,true);assert.equal(box.result.reason,0);assert.equal(listingCalls,0)}
  const result=await box.pending
  if(kind.startsWith('protected-http')){assert.equal(result.ok,false);assert.equal(result.reason.status,403);assert.equal(result.reason.failureKind,'public_access_denied');assert.equal(listingCalls,0)}
  else if(kind==='seed-prompt-owned'){assert.equal(result.ok,true);assert.equal(result.value.length,0);assert.equal(listingCalls,2)}
  else{assert.equal(result.ok,false);assert.equal(listingCalls,0);if(kind==='seed-reject')assert.equal(result.reason,control.cleanup)}
  observations.push({name:'Allcargo',kind,...errorRecord(result),calls:calls.length,cancels:control.cancels,listingCalls,authoredEmptyEnvelopeOnly:true})
 }finally{control.release.resolve();await box.pending;await turn();globalThis.fetch=deny('network')}
})

// Mutation caught: using the new cleanup grace to relax a source-owned request
// deadline, or detaching a prompt expired-response cleanup before it settles.
for(const name of['scraper/bluestock/native.js','scraper/cloudambassadors/native.js','scraper/continualengine/native.js'])runCase(name+' / local body deadline remains exact',async()=>{
 const deadline=new AbortController(),localReason=Object.freeze(Object.assign(Error('AUTHORED local native body deadline'),{name:'TimeoutError'}))
 const originalTimeout=AbortSignal.timeout,bodyGate=deferred(),bodyEntered=deferred(),calls=[];let streamController
 AbortSignal.timeout=ms=>ms===20000?deadline.signal:originalTimeout(ms)
 const flow=FLOWS.find(row=>row.name.includes(name.split('/')[1]==='cloudambassadors'?'Cloud Ambassadors':name.split('/')[1]==='bluestock'?'Bluestock':'Continual Engine'))
 const stream=new RealReadableStream({start(controller){streamController=controller},pull(){bodyEntered.resolve();return bodyGate.promise}})
 setFetch([flow.target],()=>response(stream,flow.target),calls)
 const box=observe(modules[name].nativeFetch(flow.target))
 try{await bodyEntered.promise;await turn();deadline.abort(localReason);streamController.enqueue(new TextEncoder().encode('AUTHORED body bytes'));streamController.close();bodyGate.resolve();const result=await box.pending;assert.equal(result.ok,false);assert.equal(result.reason,localReason);assert.equal(calls.length,1)}
 finally{bodyGate.resolve();await box.pending;AbortSignal.timeout=originalTimeout;globalThis.fetch=deny('network')}
})
runCase('CrewBloom expired unread response / prompt disposal stays owned and exact',async()=>{
 const deadline=new AbortController(),headers=deferred(),headerEntered=deferred(),control=streamControl('prompt'),calls=[]
 const localReason=Object.freeze(Object.assign(Error('AUTHORED local CrewBloom JSON deadline'),{name:'TimeoutError'})),originalTimeout=AbortSignal.timeout
 AbortSignal.timeout=ms=>ms===30000?deadline.signal:originalTimeout(ms)
 const flow=FLOWS.find(row=>row.name.startsWith('CrewBloom'))
 setFetch([flow.target],()=>{headerEntered.resolve();return headers.promise},calls)
 const box=observe(flow.read())
 try{
  await headerEntered.promise;deadline.abort(localReason);headers.resolve(response(control.stream,flow.target,200,{'content-type':'application/json'}));await control.entered.promise
  await pause(20);assert.equal(box.settled,false,'Prompt expired-response disposal remains owned');control.release.resolve()
  const result=await box.pending;assert.equal(result.ok,false);assert.equal(result.reason,localReason);assert.equal(calls.length,1);assert.equal(control.cancels,1)
 }finally{headers.resolve(response('{}',flow.target,200,{'content-type':'application/json'}));control.release.resolve();await box.pending;AbortSignal.timeout=originalTimeout;globalThis.fetch=deny('network')}
})


// Phase priority: a delivered request timeout may reject uncompleted work, but
// must not replace the HTTP failure already known before disposal was admitted.
for(const index of[2,4,6,7,8])runCase(FLOWS[index].name+' / observed HTTP403 survives request expiry during prompt disposal',async()=>{
 const flow=FLOWS[index],deadline=new AbortController(),control=streamControl('prompt'),calls=[]
 const localReason=Object.freeze(Object.assign(Error('AUTHORED deadline delivered after HTTP403'),{name:'TimeoutError'})),originalTimeout=AbortSignal.timeout
 const requestMs=index===8?30000:20000
 AbortSignal.timeout=ms=>ms===requestMs?deadline.signal:originalTimeout(ms)
 setFetch([flow.target],()=>response(control.stream,flow.target,403),calls)
 const box=observe(flow.read())
 try{
  await control.entered.promise;deadline.abort(localReason);await pause(20);assert.equal(box.settled,false,'Prompt disposal remains owned after the primary HTTP failure');control.release.resolve()
  const result=await box.pending;assert.equal(result.ok,false);assert.equal(result.reason.status,403,'A delivered request deadline must not replace the previously observed HTTP403');assert.equal(control.cancels,1);assert.equal(calls.length,1)
  observations.push({name:flow.name,kind:'observed-HTTP403-before-request-expiry',...errorRecord(result),calls:calls.length,cancels:control.cancels})
 }finally{control.release.resolve();await box.pending;AbortSignal.timeout=originalTimeout;await turn();globalThis.fetch=deny('network')}
})
runCase('Allcargo successful seed / delivered local request deadline forbids listing continuation',async()=>{
 const deadline=new AbortController(),control=streamControl('prompt'),localReason=Object.freeze(Object.assign(Error('AUTHORED expired public seed request'),{name:'TimeoutError'})),originalTimeout=AbortSignal.timeout
 let seeds=0,listingCalls=0
 AbortSignal.timeout=ms=>ms===30000?deadline.signal:originalTimeout(ms)
 const fetchImpl=async(url,init={})=>{
  assert.ok(init.signal instanceof AbortSignal)
  if(url===ALL_OFFICIAL)return response(ALL_PAGE,url)
  if(url===ALL_HOME)return response(ALL_NATIVE,url)
  if(url===ALL_SEED){seeds++;return response(seeds===2?control.stream:ALL_NATIVE,url,200,{'content-type':'text/html','set-cookie':'public_session=authored; Path=/; Secure; HttpOnly'})}
  if(url===ALL_API){listingCalls++;return response('{"status":"success","data":[],"job_counts":0}',url,200,{'content-type':'application/json'})}
  return deny('unexpectedRequest')()
 }
 const box=observe(modules['scraper/allcargologistics/nativeInventory.js'].runCurrentAllcargoInventory({fetchImpl}))
 try{await control.entered.promise;deadline.abort(localReason);await pause(20);assert.equal(listingCalls,0);control.release.resolve();const result=await box.pending;assert.equal(result.ok,false);assert.equal(result.reason,localReason);assert.equal(listingCalls,0,'An expired successful seed must never admit its listing POST')}
 finally{control.release.resolve();await box.pending;AbortSignal.timeout=originalTimeout;await turn()}
})

after(()=>{
 const files=[...imported].map(([filename,row])=>({...row,unchangedAtExit:sha(fs.readFileSync(filename))===row.sha256}))
 assert.ok(files.every(row=>row.unchangedAtExit));assert.equal(sha(fs.readFileSync(self)),testSHA256);assert.equal(sha(fs.readFileSync(manifestPath)),manifestSHA256)
 assert.ok(Object.values(attempts).every(value=>value===0),JSON.stringify(attempts));assert.equal(typeof globalThis.DOMMatrix,'undefined')
 console.log('HTTP_DISPOSAL_GROUP_A '+JSON.stringify({permissions,attempts,files,testSHA256,manifestSHA256,registered,observations,logicalReadPaths:[...readPaths].map(filename=>path.relative(backend,filename).replaceAll('\\','/')),authoredTransportOnly:true,externalRequests:0,sourceOrBackendTestsEdited:false}))
})
