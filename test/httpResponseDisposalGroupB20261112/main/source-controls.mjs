import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {backend,counters,denyFetch,requestFailure,readAllowed,hash,finishGuard,RealResponse,RealReadableStream} from './guard.mjs'

// All transport controls are authored. Retained fixture cases are identified
// separately. No publisher program is evaluated and no native fact is acquired.
const modules={}
for(const [key,name]of Object.entries({deitel:'deitelengineeringsolutionsllp/native.js',deitelRun:'deitelengineeringsolutionsllp/script.js',dinesh:'dineshchandraragrawalinfracon/script.js',everest:'everest.workday/script.js',fingent:'fingent/script.js',gati:'gati/nativeInventory.js',ghx:'ghxindia/script.js',globalpayments:'globalpayments.workday/transport.js',iqvia:'iqvia/script.js',keyence:'keyence/nativeInventory.js',m2nxt:'m2nxt/script.js',optum:'optum/currentNative.js'}))modules[key]=await import(pathToFileURL(path.join(backend,'scraper',name)))
const inventory=(await import(pathToFileURL(path.join(backend,'scraper-support/utils/inventoryEvidence.js')))).readInventoryEvidence
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),turn=()=>new Promise(resolve=>setImmediate(resolve))
const reflect=value=>Promise.resolve(value).then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const observations=[]
const opaque=()=>{const value=Object.create(null);Object.defineProperty(value,'message',{get(){counters.opaqueInspection++;throw Error('Opaque caller reason inspected')}});Object.defineProperty(value,Symbol.toPrimitive,{value(){counters.opaqueInspection++;throw Error('Opaque caller reason coerced')}});return Object.freeze(value)}
const response=(url,body,{status=200,type='text/html',headers={}}={})=>{const fields=new Headers(headers);if(!fields.has('content-type'))fields.set('content-type',type);const value=new RealResponse(body,{status,headers:fields});Object.defineProperty(value,'url',{value:url});return value}
const cancellation=(kind,{bytes=null}={})=>{
 const entered=deferred(),release=deferred(),cleanup=Object.freeze(Error('Authored underlying cancellation failure'))
 let count=0
 const stream=new RealReadableStream({start(controller){if(bytes)controller.enqueue(bytes)},cancel(){count++;entered.resolve();if(kind==='reject')return Promise.reject(cleanup);if(kind==='throw')throw cleanup;if(kind==='pending')return release.promise}})
 return{stream,entered,release,cleanup,get count(){return count}}
}
const withTimer=async(pending,ms)=>{let timer;try{return await Promise.race([pending,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('Harness boundary did not settle within '+ms+' ms')),ms)})])}finally{clearTimeout(timer)}}
const bound=async pending=>withTimer(pending,1800)
const enteredOrFinished=async(control,pending)=>{const result=await withTimer(Promise.race([control.entered.promise.then(()=>true),pending.then(()=>false)]),2000);assert.equal(result,true,'Cancellation path must be reached before checking its outcome')}
async function adverse(name,{start,fetch,status=null,message=null,kind='reject',strict=false,abort=false,delayRelease=false,lateReject=false,bytes=null,requestsExpected=null}){
 await test(name,async()=>{
  const control=cancellation(kind,{bytes}),caller=new AbortController(),reason=opaque(),calls=[]
  let settled=false,outcome,teardown=false
  const context={control,caller,calls,get teardown(){return teardown}}
  globalThis.fetch=async(url,options={})=>{calls.push(String(url));return fetch(String(url),options,context)}
  const pending=reflect(start(caller.signal,context));pending.then(value=>{outcome=value;settled=true})
  try{
   await enteredOrFinished(control,pending)
   const callsAtCancellation=calls.length
   if(abort){caller.abort(reason);await pause(80);assert.equal(settled,true,'Opaque caller abort must interrupt pending cancellation');assert.equal(outcome.ok,false);assert.equal(outcome.reason,reason)}
   else if(delayRelease){await pause(40);assert.equal(settled,false,'Strict disposal must own cancellation before continuation');control.release.resolve();outcome=await pending;assert.equal(outcome.ok,false);assert.equal(outcome.reason,context.nextRequestStop,'Continuation after completed disposal must reach the declared next boundary')}
   else if(kind==='pending'){
    await pause(1250);assert.equal(settled,true,'Disposal must settle within fixed grace while the admitted cancel stays pending');assert.equal(outcome.ok,false)
    if(strict){assert.notEqual(outcome.reason,control.cleanup);assert.equal(outcome.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT');assert.equal(calls.length,callsAtCancellation,'Strict timeout must stop all later requests')}
    else{if(status!==null)assert.equal(outcome.reason.status,status);if(message)assert.match(outcome.reason.message,message)}
   }else{
    outcome=await pending;assert.equal(outcome.ok,false)
    if(strict)assert.equal(outcome.reason,control.cleanup)
    else{if(status!==null)assert.equal(outcome.reason.status,status);if(message)assert.match(outcome.reason.message,message)}
   }
   assert.equal(control.count,1,'Cancellation must be admitted exactly once')
   if(requestsExpected!==null)assert.equal(calls.length,requestsExpected,'No later request may start before strict disposal completes')
   observations.push({name,authored:true,kind,cancellationCount:control.count,calls:calls.length,settledBeforeControlledRelease:settled,opaqueCaller:abort,strict})
  }finally{
   teardown=true
   if(lateReject)control.release.reject(control.cleanup);else control.release.resolve()
   await bound(pending);await turn();await turn();globalThis.fetch=denyFetch
  }
 })
}
const sourceRun=(key,signal,extra={})=>key==='deitel'?modules.deitel.nativeFetch('https://transport-control.authored.invalid/careers',{signal}):modules[key].run({signal,...extra})

for(const key of ['deitel','dinesh','fingent','m2nxt']){
 await adverse(key+' HTTP403 survives underlying rejection',{start:signal=>sourceRun(key,signal),status:403,fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
 await adverse(key+' HTTP503 settles while underlying cancellation is pending',{kind:'pending',start:signal=>sourceRun(key,signal),status:503,lateReject:key==='deitel',fetch:(url,_options,{control})=>response(url,control.stream,{status:503})})
 await adverse(key+' foreign redirect preserves identity failure',{start:signal=>sourceRun(key,signal),message:/unexpected native redirect/,fetch:(_url,_options,{control})=>response('https://foreign.authored.invalid/rejected',control.stream)})
}
await adverse('Deitel exact opaque caller during pending failure disposal',{kind:'pending',abort:true,start:signal=>sourceRun('deitel',signal),fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
await adverse('Fingent exact opaque caller during pending failure disposal',{kind:'pending',abort:true,start:signal=>sourceRun('fingent',signal),fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
await test('Deitel real request timeout during disposal preserves already-observed HTTP403',async()=>{
 const control=cancellation('pending'),caller=new AbortController(),timeline=[],started=performance.now()
 const mark=label=>timeline.push({label,elapsedMs:Math.round(performance.now()-started)})
 let requestSignal,outcome,calls=0,releaseTimer
 const onTimeout=()=>mark('owned-request-timeout')
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://phase-control.authored.invalid/careers');requestSignal=options.signal;requestSignal.addEventListener('abort',onTimeout,{once:true});await pause(19700);mark('HTTP403-headers-returned');return response(url,control.stream,{status:403})}
 mark('request-start')
 const pending=reflect(modules.deitel.nativeFetch('https://phase-control.authored.invalid/careers',{signal:caller.signal}));pending.then(value=>{outcome=value;mark('source-settled')})
 try{
  await withTimer(control.entered.promise,20500);mark('underlying-cancel-entered')
  releaseTimer=setTimeout(()=>{mark('underlying-cancel-resolved');control.release.resolve()},500)
  await bound(pending)
  observations.push({name:'Deitel request-phase priority',authored:true,actualRequestTimeoutMs:20000,fetchReturnDelayMs:19700,underlyingDisposalDelayMs:500,status:outcome.reason?.status,calls,timeline})
  const index=label=>timeline.findIndex(row=>row.label===label)
  assert.ok(index('HTTP403-headers-returned')<index('underlying-cancel-entered'))
  assert.ok(index('underlying-cancel-entered')<index('owned-request-timeout'))
  assert.ok(index('owned-request-timeout')<index('underlying-cancel-resolved'))
  assert.ok(index('underlying-cancel-resolved')<index('source-settled'))
  assert.equal(requestSignal.aborted,true);assert.equal(outcome.ok,false);assert.equal(outcome.reason.status,403);assert.equal(calls,1);assert.equal(control.count,1)
 }finally{clearTimeout(releaseTimer);requestSignal?.removeEventListener('abort',onTimeout);control.release.resolve();await bound(pending);await turn();globalThis.fetch=denyFetch}
})

const everestPages=()=>{
 const m=modules.everest
 return new Map([[m.HOMEPAGE_URL,{url:'https://www.everestglobal.com/us-en',body:'<title>Welcome to Everest | Everest</title><link rel="canonical" href="https://www.everestglobal.com/us-en"><p>We underwrite opportunity.</p><a href="/us-en/career-opportunities">Careers</a><a href="/us-en/about-us">About us</a>'}],[m.CAREERS_PAGE_URL,{url:m.CAREERS_OVERVIEW_URL,body:`<title>Careers | Everest</title><link rel="canonical" href="${m.CAREERS_OVERVIEW_URL}"><h1>Careers</h1><p>Ready to take your next step?</p><a href="${m.WORKDAY_BOARD_URL}">Search Jobs</a>`}],[m.WORKDAY_BOARD_URL,{url:m.WORKDAY_BOARD_URL,body:`<meta property="og:title" content="Careers"><meta property="og:url" content="${m.WORKDAY_BOARD_URL}"><script>window.workday = { tenant: "everestre", siteId: "careers" };</script><p>Beware of recruitment fraud. EVEREST is a leading international reinsurance and insurance group</p>`}]])
}
const everestFetch=(status)=>(url,_options,{control})=>{const page=everestPages().get(url);if(page)return response(page.url,page.body);if(url===modules.everest.JOBS_API_URL)return response(url,control.stream,{status,type:'application/json'});return requestFailure(url)}
await adverse('Everest JSON HTTP429 survives rejecting cancellation',{start:signal=>sourceRun('everest',signal),status:429,fetch:everestFetch(429)})
await adverse('Everest JSON HTTP503 pending cancellation is independently bounded',{kind:'pending',start:signal=>sourceRun('everest',signal),status:503,fetch:everestFetch(503)})
await adverse('Everest source deadline cannot replace already-observed HTTP403',{kind:'pending',start:signal=>sourceRun('everest',signal,{sourceDeadlineMs:200}),status:403,fetch:everestFetch(403)})
await adverse('Everest external opaque caller wins over known HTTP and pending cancellation',{kind:'pending',abort:true,start:signal=>sourceRun('everest',signal),fetch:everestFetch(403)})

for(const [label,type,final]of [['foreign URL','text/html','https://foreign.authored.invalid/ghx'],['foreign MIME','text/plain',null]])await adverse('GHX identity '+label+' survives rejected cancellation',{start:signal=>sourceRun('ghx',signal),message:/identity changed/,fetch:(url,_options,{control})=>response(final||url,control.stream,{type})})
await adverse('GHX known nonretryable identity failure beats outer attempt timeout',{kind:'pending',start:signal=>sourceRun('ghx',signal),message:/identity changed/,requestsExpected:1,fetch:(_url,_options,{control})=>response('https://foreign.authored.invalid/ghx',control.stream)})
await adverse('GHX existing outer abort keeps opaque caller exact',{kind:'pending',abort:true,start:signal=>sourceRun('ghx',signal),requestsExpected:1,fetch:(_url,_options,{control})=>response('https://foreign.authored.invalid/ghx',control.stream)})

for(const key of ['iqvia','optum']){
 await adverse(key+' access HTTP429 survives rejected cancellation',{start:signal=>sourceRun(key,signal),status:429,fetch:(url,_options,{control})=>response(url,control.stream,{status:429})})
 await adverse(key+' HTTP403 pending cancellation is independently bounded',{kind:'pending',start:signal=>sourceRun(key,signal),status:403,fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
 await adverse(key+' source deadline cannot replace observed HTTP403',{kind:'pending',start:signal=>sourceRun(key,signal,{sourceDeadlineMs:200}),status:403,fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
 await adverse(key+' pending failure disposal retains external opaque reason',{kind:'pending',abort:true,start:signal=>sourceRun(key,signal),fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
}
await adverse('Optum early per-response byte failure owns pending reader cleanup',{kind:'pending',bytes:new Uint8Array(4*1024*1024+1),start:signal=>sourceRun('optum',signal),message:/response-byte-budget/,fetch:(url,_options,{control})=>response(url,control.stream)})
await adverse('Optum aggregate byte failure survives rejected reader cleanup',{bytes:new Uint8Array(65),start:signal=>sourceRun('optum',signal,{maxTotalResponseBytes:64}),message:/response-byte-budget/,fetch:(url,_options,{control})=>response(url,control.stream)})

const gatiRun=(signal,fetchImpl=globalThis.fetch)=>modules.gati.runCurrentGatiInventory({signal,fetchImpl})
for(const [label,status,kind]of [['rejection',403,'reject'],['pending',429,'pending']])await adverse('Gati access stop '+label+' preserves observed status and stops reads',{kind,start:signal=>gatiRun(signal),status,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status})})
await adverse('Gati pending denial disposal retains exact opaque caller',{kind:'pending',abort:true,start:signal=>gatiRun(signal),requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status:403})})
await adverse('Gati early streaming budget failure owns pending reader cancellation',{kind:'pending',bytes:new Uint8Array(4000001),start:signal=>gatiRun(signal),message:/response budget exceeded/,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status:301})})

const GATI_SEED='https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/allJobs'
const parseFixture=name=>JSON.parse(gunzipSync(readAllowed(name)))
const gatiFixture=parseFixture('scraper/gati/test-inputs/current-declared-client-20261106.json.gz')
const gatiFixtureResponse=(url,init={})=>{
 const row=gatiFixture.responses.find(row=>row.url===url);if(!row)return requestFailure(url)
 const body=Buffer.from(row.bodyBase64,'base64');assert.equal(hash(body),row.bodySHA256)
 if(row.method){assert.equal(init.method,row.method);assert.equal(init.body,row.requestBody)}
 return response(url,body,{status:row.status,headers:{...row.headers,...(url===GATI_SEED?{'set-cookie':'offline_public_session=synthetic; Path=/'}:{})}})
}
for(const [label,kind,abort,delayRelease]of [['rejection','reject',false,false],['timeout','pending',false,false],['opaque caller','pending',true,false],['owned delayed completion','pending',false,true]]){
 await adverse('Gati metadata-only seed strict '+label,{kind,abort,delayRelease,strict:true,start:signal=>gatiRun(signal),fetch:(url,init,context)=>{
  if(url===GATI_SEED&&!init.headers?.Referer){
   // The first seed URL is a full checked surface; only later cookie-seed
   // requests with the same URL are metadata-only. Distinguish by count.
   const visits=context.calls.filter(value=>value===GATI_SEED).length
   if(visits>1){context.nextRequestStop??=Object.freeze(Error('Authored next API stop'));context.seedReached=true;return response(url,context.control.stream,{headers:{'set-cookie':'offline_public_session=synthetic; Path=/'}})}
  }
  if(context.seedReached){if(!context.teardown&&!delayRelease)return requestFailure(url);throw context.nextRequestStop}
  return gatiFixtureResponse(url,init)
 }})
}

const authoredKeyence=()=>{
 const origin='https://candidate.authored.invalid',seed=origin+'/ms/candidatev2/main/careers/allJobs',corporate='https://employer.authored.invalid/careers'
 const corporateBody='<a href="'+seed+'">Authored careers control</a>',clientUrl=origin+'/ms/candidatev2/main.authored.js',client='/* Authored inert client bytes; hash only, never executed. */'
 const shell='<base href="/ms/candidatev2/"><script src="/ms/candidatev2/main.authored.js"></script>'
 return{origin,seed,corporate,corporateBody,clientUrl,client,shell,spec:{source:'authored-http-disposal-control',company:'Authored control',brand:'Authored control',tenant:'authored',tenantId:'0',origin,handoff:seed,review:{corporatePages:[{url:corporate,status:200,sha256:hash(corporateBody)}],clientUrl,clientSha256:hash(client),rendererSha256:hash(shell),schemas:{}}}}
}
for(const [label,kind,abort,delayRelease]of [['rejection','reject',false,false],['timeout','pending',false,false],['opaque caller','pending',true,false],['owned delayed completion','pending',false,true]]){
 const authored=authoredKeyence()
 await adverse('Keyence exported helper authored metadata seed strict '+label,{kind,abort,delayRelease,strict:true,start:signal=>modules.keyence.runReviewedDarwinboxInventory(authored.spec,{signal}),fetch:(url,init,context)=>{
  if(url===authored.corporate)return response(url,authored.corporateBody)
  if(url===authored.seed&&init.headers)return response(url,authored.shell)
  if(url===authored.clientUrl)return response(url,authored.client,{type:'application/javascript'})
  if(url===authored.seed){context.seedReached=true;context.nextRequestStop??=Object.freeze(Error('Authored next API stop'));return response(url,context.control.stream,{headers:{'set-cookie':'authored=synthetic; Path=/'}})}
  if(context.seedReached){if(!context.teardown&&!delayRelease)return requestFailure(url);throw context.nextRequestStop}
  return requestFailure(url)
 }})
}

const GP=modules.globalpayments.BASE
const gpRun=(signal,{maxBytes=8}={})=>modules.globalpayments.createNativeTransport({signal,maxBytes})(GP)
await adverse('Global Payments rejected foreign redirect keeps URL policy error',{start:signal=>gpRun(signal),message:/unsafe public URL/,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status:302,headers:{location:'https://foreign.authored.invalid/jobs'}})})
await adverse('Global Payments missing redirect location keeps known error through pending cleanup',{kind:'pending',start:signal=>gpRun(signal),message:/Missing or excessive redirect/,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status:302})})
for(const [label,kind]of [['rejected cancellation','reject'],['pending cancellation','pending']])await adverse('Global Payments exact-resource redirect strict '+label,{kind,strict:true,start:signal=>gpRun(signal),requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status:302,headers:{location:GP}})})
await adverse('Global Payments declared length budget keeps failure through pending disposal',{kind:'pending',start:signal=>gpRun(signal),message:/byte limit/,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{headers:{'content-length':'9'}})})
await adverse('Global Payments streaming byte limit owns pending reader cleanup',{kind:'pending',bytes:new Uint8Array(9),start:signal=>gpRun(signal),message:/byte limit/,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream)})
await adverse('Global Payments streaming byte failure survives rejected reader cleanup',{bytes:new Uint8Array(9),start:signal=>gpRun(signal),message:/byte limit/,requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream)})
await adverse('Global Payments strict pending redirect keeps external opaque reason',{kind:'pending',abort:true,strict:true,start:signal=>gpRun(signal),requestsExpected:1,fetch:(url,_options,{control})=>response(url,control.stream,{status:302,headers:{location:GP}})})
await test('Global Payments valid redirect owns cancellation completion before second request',async()=>{
 const control=cancellation('pending'),calls=[];let completed=false
 globalThis.fetch=async url=>{calls.push(String(url));if(calls.length===1)return response(String(url),control.stream,{status:302,headers:{location:GP}});assert.equal(completed,true);if(calls.length===2)return response(String(url),'Authored bytes');return requestFailure(url)}
 const pending=reflect(modules.globalpayments.createNativeTransport({maxBytes:100})(GP))
 try{await enteredOrFinished(control,pending);await pause(40);assert.equal(calls.length,1);completed=true;control.release.resolve();const outcome=await pending;assert.equal(outcome.ok,true);assert.equal(outcome.value.body.toString(),'Authored bytes');assert.equal(calls.length,2);assert.equal(control.count,1);observations.push({name:'Global Payments strict completed redirect continuation',authored:true,calls:2,cancellationCount:1})}finally{control.release.resolve();await bound(pending);globalThis.fetch=denyFetch}
})

const snapshot=value=>{
 const volatile=new Set(['scrapedAt','verifiedAt','observedAt','startedAt','completedAt'])
 return JSON.parse(JSON.stringify(value,(key,field)=>volatile.has(key)?undefined:field))
}
const recordFixture=(name,jobs,calls)=>{const evidence=inventory(jobs);observations.push({name,authored:false,retainedFixtureOnly:true,calls,roles:jobs.length,inventoryStatus:evidence?.status,listingComplete:evidence?.listingComplete,signature:hash(JSON.stringify(snapshot({jobs,evidence,nativeCollectionEvidence:jobs.nativeCollectionEvidence||null})))})}
for(const [key,folder,count]of [['deitelRun','deitelengineeringsolutionsllp',0],['dinesh','dineshchandraragrawalinfracon',15],['fingent','fingent',8],['m2nxt','m2nxt',16]])await test(key+' unchanged captured raw HTTP bodies retain qualified observations',async()=>{
 const fixture=parseFixture('scraper/'+folder+'/test-data/2026-10-31-native-packets.json.gz'),calls=[]
 globalThis.fetch=async(url,init={})=>{calls.push(String(url));const row=fixture.requests.find(row=>row.url===String(url)&&(row.method||'GET')===(init.method||'GET'));if(!row)return requestFailure(url);const body=Buffer.from(row.body,row.bodyEncoding||'utf8');assert.equal(hash(body),row.bodySHA256);return response(row.finalUrl||String(url),body,{status:row.status,type:row.contentType})}
 try{const jobs=await modules[key].run({now:()=> '2026-10-31T09:00:00.000Z'});assert.equal(jobs.length,count);assert.equal(inventory(jobs).listingComplete,false);assert.equal(inventory(jobs).reportedTotal,null);recordFixture(key,jobs,calls.length)}finally{globalThis.fetch=denyFetch}
})
await test('Gati unchanged raw captured inventory retains incomplete company scope',async()=>{
 const calls=[];globalThis.fetch=async(url,init)=>{calls.push(String(url));return gatiFixtureResponse(String(url),init)}
 try{const jobs=await modules.gati.runCurrentGatiInventory({fetchImpl:globalThis.fetch,now:()=> '2026-11-06T12:00:00.000Z'});assert.equal(jobs.length,0);assert.equal(inventory(jobs).listingComplete,false);assert.equal(inventory(jobs).reportedTotal,null);recordFixture('gati',jobs,calls.length)}finally{globalThis.fetch=denyFetch}
})
await test('Optum unchanged captured native role survives ordinary EOF cleanup',async()=>{
 const fixture=parseFixture('scraper/optum/test-data/native-current-20261107.json.gz'),rows=[...fixture.listings,fixture.detail],calls=[]
 globalThis.fetch=async url=>{calls.push(String(url));const row=rows.find(row=>row.requestUrl===String(url));if(!row)return requestFailure(url);assert.equal(hash(Buffer.from(row.body)),row.sha256);return response(row.url||String(url),row.body,{status:row.status,type:row.contentType})}
 try{const jobs=await modules.optum.createOptumScraper({maxPages:1,maxJobs:1}).run({now:()=>fixture.capturedAt});assert.equal(jobs.length,1);assert.equal(inventory(jobs).listingComplete,false);recordFixture('optum',jobs,calls.length)}finally{globalThis.fetch=denyFetch}
})
await test('GHX unchanged full unavailable-role transcript retains native reconciliation',async()=>{
 const fixture=parseFixture('scraper/ghxindia/test-data/unavailable-role-20261109.json.gz'),pending=[...fixture.responses],calls=[]
 globalThis.fetch=async url=>{const index=pending.findIndex(row=>row.requestedUrl===String(url));if(index<0)return requestFailure(url);const row=pending.splice(index,1)[0];calls.push(row.phase);assert.equal(hash(Buffer.from(row.body)),row.sha256);return response(row.finalUrl,row.body,{status:row.status,type:row.contentType,headers:row.location?{location:row.location}:{}})}
 try{const jobs=await modules.ghx.run({now:()=> '2026-11-09T07:00:00.000Z'});assert.equal(jobs.length,14);assert.equal(inventory(jobs).listingComplete,true);assert.deepEqual(calls,fixture.responses.map(row=>row.phase));assert.equal(pending.length,0);recordFixture('ghx',jobs,calls.length)}finally{globalThis.fetch=denyFetch}
})
after(()=>console.log('HTTP_DISPOSAL_GROUP_B '+JSON.stringify({...finishGuard(),observations,fixtureLimits:['No genuine Everest or IQVIA corpus present in assigned source folders.','Referenced backend/scraper/keyence/fixtures/native-20261029.json.gz is absent; seed ownership control uses the actual exported helper with an explicitly authored public spec, never native job facts.'],publisherProgramsExecuted:0})))
