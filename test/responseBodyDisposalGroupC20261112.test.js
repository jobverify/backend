import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import childProcess from 'node:child_process'
import {gunzipSync} from 'node:zlib'
import {installGuard,backendReadNames} from './helpers/responseBodyDisposalGroupCGuard20261112.js'

const self=fileURLToPath(import.meta.url)
const backend=path.resolve(process.env.HTTP_DISPOSAL_BACKEND||fileURLToPath(new URL('../',import.meta.url)))
if(!process.permission){
 test('Group C response disposal runs all113 causal and retained-fixture cases in a restricted child',{timeout:125000},()=>{
  const helper=path.join(path.dirname(self),'helpers','responseBodyDisposalGroupCGuard20261112.js')
  const args=['--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict','--test-reporter=tap',
   ...backendReadNames().map(name=>'--allow-fs-read='+path.join(backend,name)),
   '--allow-fs-read='+self,'--allow-fs-read='+helper,self]
  const env={...process.env,NODE_OPTIONS:'',HTTP_DISPOSAL_BACKEND:backend};delete env.NODE_TEST_CONTEXT
  const hash=raw=>createHash('sha256').update(raw).digest('hex')
  const before={test:hash(fs.readFileSync(self)),helper:hash(fs.readFileSync(helper))}
  const run=childProcess.spawnSync(process.execPath,args,{cwd:backend,env,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024})
  const text=run.stdout||'',markers=text.split(/\r?\n/).filter(line=>line.includes('HTTP_DISPOSAL_GROUP_C '))
  let guard=null,markerError=null
  if(markers.length)try{guard=JSON.parse(markers.at(-1).split('HTTP_DISPOSAL_GROUP_C ')[1])}catch(error){markerError=error.message}
  const counts=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name=>[name,Number(text.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]??-1)]))
  console.log('HTTP_DISPOSAL_GROUP_C_CHILD '+JSON.stringify({arguments:args,exitCode:run.status,timedOut:run.error?.code==='ETIMEDOUT',error:run.error?.message,counts,guard,markerError,
   stdoutSHA256:hash(text),stderrSHA256:hash(run.stderr||''),testSHA256:before.test,helperSHA256:before.helper}))
  assert.equal(run.error,undefined,run.error?.message)
  assert.equal(run.status,0,run.stderr||text);assert.equal(markerError,null);assert.ok(guard)
  assert.deepEqual(counts,{tests:113,pass:113,fail:0,cancelled:0,skipped:0,todo:0})
  assert.ok(Object.values(guard.attempts).every(value=>value===0));assert.equal(guard.cleanupTimers.pending,0)
  assert.equal(guard.cleanupTimers.created,guard.cleanupTimers.cleared)
  assert.ok(guard.files.every(file=>file.unchangedAtExit));assert.equal(guard.dataUnchanged,true);assert.equal(guard.harnessUnchanged,true)
  assert.equal(guard.observations.filter(row=>row.genuineRetainedReplay).length,12)
  assert.equal(hash(fs.readFileSync(self)),before.test);assert.equal(hash(fs.readFileSync(helper)),before.helper)
 })
}else{
// Authored stream controls are not publisher captures or employer/job claims.
// Genuine fixture bytes below remain separately identified and unchanged.
const RealResponse=globalThis.Response,RealReadableStream=globalThis.ReadableStream
const guard=installGuard(),observations=[]
const modules={}
for(const [name,file]of Object.entries({
 precision:'precisionprecastsolutions/script.js',rave:'ravetechnologies/script.js',
 saml:'samcosecuritieslimited/script.js',sam:'samco/script.js',sag:'saginfotech/script.js',
 sedin:'sedintechnologies/script.js',uhp:'uhptechnologiespvtltd/script.js',
 samlNative:'samcosecuritieslimited/native.js',samNative:'samco/native.js',sagNative:'saginfotech/native.js',
 currentSedin:'sedintechnologies/currentZoho.js',publicIO:'uniqus/currentPublicTransport.js',
 currentZoho:'uniqus/currentNative.js',lakshya:'lakshya/currentNative.js',loginext:'loginext/currentNative.js',
 thirdWave:'stanplus/nativeInventory.js',stanplus:'stanplus/script.js',perfios:'perfios/script.js',
}))modules[name]=await guard.load('scraper/'+file)
const {readInventoryEvidence}=await guard.load('scraper-support/utils/inventoryEvidence.js')
const reflect=promise=>Promise.resolve(promise).then(value=>({ok:true,value}),reason=>({ok:false,reason}))
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),turn=()=>new Promise(resolve=>setImmediate(resolve))
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
async function bounded(promise,ms=2500){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Authored independent watchdog')),ms)})])}finally{clearTimeout(timer)}}
const fixedNow=()=> '2026-11-07T12:00:00.000Z'
const reset=()=>{globalThis.fetch=guard.deny('network')}
function response(body,status,url,type='text/html',headers={}){
 const value=new RealResponse(body,{status,headers:{'content-type':type,...headers}})
 Object.defineProperty(value,'url',{value:url});return value
}
function streamControl(mode,onCancel=()=>{}){
 const entered=deferred(),release=deferred(),cleanup=Object.freeze(Error('Authored cancellation failure'))
 let cancels=0
 const stream=new RealReadableStream({cancel(){cancels++;entered.resolve();onCancel();if(mode==='throw')throw cleanup;if(mode==='reject')return Promise.reject(cleanup);if(mode==='pending'||mode==='delayed')return release.promise}},{highWaterMark:0})
 return{stream,entered,release,cleanup,get cancels(){return cancels}}
}
const rawSetTimeout=globalThis.setTimeout,rawClearTimeout=globalThis.clearTimeout
const cleanupHandles=new Set();let created=0,cleared=0
globalThis.setTimeout=(callback,ms,...rest)=>{const handle=rawSetTimeout(callback,ms,...rest);if(ms===1000){created++;cleanupHandles.add(handle)}return handle}
globalThis.clearTimeout=handle=>{if(cleanupHandles.delete(handle))cleared++;return rawClearTimeout(handle)}

const authoredURL='https://authored-group-c.invalid/careers'
const flows=[
 {name:'Precision current public run',url:'https://ppspl.com/',deadline:20000,wrappedFetchError:true,call:o=>modules.precision.run(o)},
 {name:'Samco Securities exported nativeFetch',url:authoredURL,deadline:20000,call:o=>modules.samlNative.nativeFetch(authoredURL,o)},
 {name:'Samco exported nativeFetch',url:authoredURL,deadline:20000,call:o=>modules.samNative.nativeFetch(authoredURL,o)},
 {name:'SAG exported nativeFetch',url:authoredURL,deadline:20000,call:o=>modules.sagNative.nativeFetch(authoredURL,o)},
 {name:'Sedin current public run',url:'https://sedintechnologies.com/careers/',deadline:20000,call:o=>modules.currentSedin.runCurrentSedinZoho(o)},
 {name:'Sedin exported historical factory',url:'https://sedintechnologies.com/career/',deadline:20000,historical:true,wrappedFetchError:true,call:o=>modules.sedin.createSedinTechnologiesScraper().run(o)},
 {name:'UHP current public run',url:'https://uhptech.com/careers/',deadline:20000,wrappedFetchError:true,call:o=>modules.uhp.run(o)},
 {name:'Uniqus shared public transport',url:authoredURL,deadline:25000,call:o=>modules.publicIO.createCurrentPublicTransport('authored-group-c',['https://authored-group-c.invalid'],o).fetchPage(authoredURL)},
]
const errorKinds=['throw-403','reject-429','pending-503','caller-pending','identity-reject','ordinary-403','delayed-403','preabort']
for(const flow of flows)for(const kind of errorKinds)test(flow.name+' '+kind,{timeout:6000},async()=>{
 const caller=new AbortController(),reason=Object.freeze({authoredCaller:flow.name})
 const mode=kind==='throw-403'?'throw':kind==='reject-429'||kind==='identity-reject'?'reject':kind==='pending-503'||kind==='caller-pending'?'pending':kind==='delayed-403'?'delayed':'ordinary'
 const control=streamControl(mode),status=kind==='identity-reject'?200:kind==='reject-429'?429:kind==='pending-503'?503:403
 let calls=0,settled=false,result
 const fetchImpl=async(url,init={})=>{calls++;assert.equal(url,flow.url);assert.ok(init.signal instanceof AbortSignal);return response(control.stream,status,kind==='identity-reject'?'https://foreign-response.invalid/changed':flow.url)}
 globalThis.fetch=fetchImpl
 if(kind==='preabort')caller.abort(reason)
 const pending=reflect(flow.call({signal:caller.signal,fetchImpl,now:fixedNow}));pending.then(value=>{settled=true;result=value})
 try{
  if(kind==='preabort'){result=await bounded(pending);assert.equal(result.reason,reason);assert.equal(calls,0);assert.equal(control.cancels,0)}
  else{
   await bounded(control.entered.promise)
   if(kind==='caller-pending'){caller.abort(reason);await pause(100);assert.equal(settled,true,'Exact caller abort must release pending cleanup');assert.equal(result.reason,reason)}
   else if(kind==='pending-503'){await pause(1200);assert.equal(settled,true,'Observed503 must settle before pending cleanup is released');assert.equal(result.reason.status,503)}
   else{
    if(kind==='delayed-403'){await turn();assert.equal(settled,false,'Prompt owned cancellation must finish before reporting the primary');control.release.resolve()}
    result=await bounded(pending);assert.equal(result.ok,false)
    if(kind==='identity-reject')assert.match(result.reason.message,/unexpected native redirect|response URL identity changed/)
    else assert.equal(result.reason.status,status,'Cleanup failure must preserve observed HTTP status')
   }
   assert.equal(calls,1);assert.equal(control.cancels,1)
  }
  observations.push({flow:flow.name,kind,historical:!!flow.historical,calls,cancels:control.cancels,settledBeforeRelease:settled,status:result?.reason?.status})
 }finally{control.release.resolve();await bounded(pending);await turn();reset()}
})

// These controls simulate delivery of the existing exact request timeout signal.
// Threshold arguments are asserted, no source timeout policy or code is changed.
for(const flow of flows)for(const phase of['after-known-403','before-headers'])test(flow.name+' owned timeout '+phase,{timeout:5000},async()=>{
 const original=AbortSignal.timeout,owned=new AbortController(),ownedReason=Object.freeze(Error('Authored request deadline delivery'))
 let admitted=0,calls=0
 AbortSignal.timeout=ms=>{if(ms===flow.deadline){admitted++;return owned.signal}return original(ms)}
 const control=streamControl('ordinary',()=>owned.abort(ownedReason))
 const fetchImpl=async url=>{calls++;assert.equal(url,flow.url);if(phase==='before-headers'){owned.abort(ownedReason);throw ownedReason}return response(control.stream,403,flow.url)}
 globalThis.fetch=fetchImpl
 try{
  const result=await bounded(reflect(flow.call({fetchImpl,now:fixedNow})))
  assert.equal(result.ok,false);assert.equal(calls,1);assert.equal(admitted,1)
  if(phase==='after-known-403'){assert.equal(result.reason.status,403,'Known HTTP primary survives owned timeout delivered during disposal');assert.equal(control.cancels,1)}
  else if(flow.wrappedFetchError){assert.equal(result.reason.cause,ownedReason);assert.equal(result.reason.status,undefined);assert.equal(control.cancels,0)}
  else{assert.equal(result.reason,ownedReason);assert.equal(control.cancels,0)}
  observations.push({flow:flow.name,phase,requestTimeoutMs:flow.deadline,status:result.reason?.status})
 }finally{AbortSignal.timeout=original;control.release.resolve();reset()}
})

const jsonFile=name=>JSON.parse(guard.read(name).toString('utf8'))
const gzipFile=name=>JSON.parse(gunzipSync(guard.read(name)).toString('utf8'))
function bytesFor(row){return row.bodyBase64!=null?Buffer.from(row.bodyBase64,'base64'):Buffer.from(row.body??'',row.bodyEncoding||'utf8')}
function replay(name,change=(row)=>row){
 const packet=gzipFile(name),rows=packet.requests||packet.packets,calls=[]
 const fetchImpl=async(input,init={})=>{
  const url=String(input),method=init.method||'GET',body=String(init.body||'')
  const row=rows.find(r=>(r.url===url||r.responseUrl===url)&&(r.method||'GET')===method&&(r.requestBody==null||r.requestBody===body))
  if(!row)return guard.deny('unexpectedRequest')()
  const raw=bytesFor(row);if(row.bodySHA256)assert.equal(guard.hash(raw),row.bodySHA256,'Original fixture body digest')
  calls.push({url,method,body});const changed=change({...row,raw},calls,init)
  if(changed instanceof RealResponse)return changed
  return response(changed.raw,changed.status,changed.responseUrl||changed.finalUrl||url,changed.contentType||'text/html')
 }
 return{calls,fetchImpl}
}
const fixtureCases=[
 ['Precision genuine retained native records','scraper/precisionprecastsolutions/test-data/2026-10-31-native-packets.json.gz',6,o=>modules.precision.run(o)],
 ['Samco Securities genuine retained native records','scraper/samcosecuritieslimited/test-data/2026-10-31-native-packets.json.gz',8,o=>modules.saml.run(o)],
 ['Samco genuine retained native records','scraper/samco/test-data/2026-10-31-native-packets.json.gz',8,o=>modules.sam.run(o)],
 ['SAG genuine retained native records','scraper/saginfotech/test-data/2026-10-31-native-packets.json.gz',5,o=>modules.sag.run(o)],
 ['UHP genuine retained native records','scraper/uhptechnologiespvtltd/test-data/2026-10-31-native-packets.json.gz',22,o=>modules.uhp.run(o)],
 ['Sedin current genuine retained native records','scraper/sedintechnologies/test-data/hard-failures-20261107.json.gz',8,o=>modules.currentSedin.runCurrentSedinZoho(o)],
 ['Sedin historical genuine retained native records','scraper/sedintechnologies/test-data/2026-10-31-native-packets.json.gz',9,o=>modules.sedin.createSedinTechnologiesScraper().run(o)],
 ...[['uniqus',23],['wissentechnology',49],['scaleflex',0]].map(([source,count])=>[source+' genuine current shared consumer','scraper/'+source+'/test-data/current-native-20261107.json.gz',count,o=>modules.currentZoho.runCurrentZohoSource(source,o)]),
 ['Lakshya genuine current shared consumer','scraper/lakshya/test-data/current-native-20261107.json.gz',23,o=>modules.lakshya.runCurrentLakshya(o)],
 ['LogiNext genuine current shared consumer','scraper/loginext/test-data/current-native-20261107.json.gz',25,o=>modules.loginext.runCurrentLogiNext(o)],
]
for(const [name,fixture,count,run]of fixtureCases)test(name,{timeout:20000},async()=>{
 const http=replay(fixture);globalThis.fetch=http.fetchImpl
 try{
  const jobs=await run({fetchImpl:http.fetchImpl,now:fixedNow}),evidence=readInventoryEvidence(jobs)
  assert.equal(jobs.length,count);assert.equal(evidence.listingComplete,false);assert.notEqual(evidence.status,'verified-empty')
  assert.ok(jobs.every(j=>j.sourceListingComplete===false&&j.lifecycleCleanupAllowed!==true))
  if(name.startsWith('SAG')||name.startsWith('Precision'))assert.ok(jobs.every(j=>j.country==null))
  if(name.startsWith('scaleflex')){assert.equal(evidence.indiaFacetCount,null);assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,3)}
  const stable=jobs.map(j=>({id:j.jobId,title:j.title,country:j.country,sourceUrl:j.sourceUrl,applyUrl:j.applyUrl,postingDate:j.postingDate,jobDescription:j.jobDescription,sourceDetailComplete:j.sourceDetailComplete}))
  observations.push({fixture,name,count:jobs.length,selectedNativeFieldsSHA256:guard.hash(JSON.stringify(stable)),requests:http.calls.length,genuineRetainedReplay:true,liveAcquisition:false})
 }finally{reset()}
})

for(const [source,module]of[['samcosecuritieslimited',modules.saml],['samco',modules.sam]])for(const stage of['listing','second-detail'])test(source+' partial '+stage+' retains HTTP failure behind rejected cancel',{timeout:10000},async()=>{
 const control=streamControl('reject');let details=0,denied=false,deniedIndex=0
 const http=replay('scraper/'+source+'/test-data/2026-10-31-native-packets.json.gz',(row,calls)=>{
  const detail=/getpositiondescription/i.test(row.url)&&row.method==='POST'
  if(detail)details++
  if(!denied&&(stage==='listing'?row.method==='POST':detail&&details===2)){denied=true;deniedIndex=calls.length;return response(control.stream,stage==='listing'?503:403,row.url)}
  return row
 });globalThis.fetch=http.fetchImpl
 try{
  const jobs=await module.run({now:fixedNow}),audit=jobs.nativeCollectionEvidence,failure=audit.nativeDiscoveryFailures[0]
  assert.equal(denied,true);assert.equal(http.calls.length,deniedIndex);assert.equal(control.cancels,1)
  assert.equal(jobs.length,stage==='listing'?0:1);assert.equal(audit.sourceUnavailable,true)
  assert.equal(failure.status,stage==='listing'?503:403);assert.equal(failure.kind,stage==='listing'?'native_unavailable':'access_denied')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  observations.push({source,stage,preservedRoles:jobs.length,status:failure.status,failureKind:failure.kind,partialObservation:true})
 }finally{control.release.resolve();reset()}
})

const raveHome='<!-- Authored transport setup, not a publisher capture --><title>NEC Software Solutions - Orchestrating a Brighter World</title><h1>NEC Software Solutions</h1><a href="https://www.necsws.com/india/careers/">Careers</a>'
const raveCareers='<!-- Authored transport setup --><title>Careers - NEC Software Solutions</title><h1>Careers</h1><a href="https://jobs.smartrecruiters.com/NECSWS/123-role">Jobs</a>'
const raveBoard='<!-- Authored transport setup --><title>Careers at NECSWS</title><script>window._jsErrorTrackerOptions={}</script><div id="career-site-ui"></div>'
const canonical='https://careers.smartrecruiters.com/NECSWS'
for(const kind of['reject','pending','delayed','caller-pending','foreign-location'])test('Rave canonical redirect strict '+kind,{timeout:6000},async()=>{
 const control=streamControl(kind==='caller-pending'?'pending':kind),caller=new AbortController(),reason=Object.freeze({authoredCaller:'Rave redirect'})
 const continuation=Object.freeze(Error('Authored validated redirect continuation'))
 let targets=0,settled=false,result
 globalThis.fetch=async url=>{
  if(url===modules.rave.SUCCESSOR_HOMEPAGE_URL)return response(raveHome,200,url)
  if(url===modules.rave.CAREERS_URL)return response(raveCareers,200,url)
  if(url===modules.rave.SMARTRECRUITERS_BOARD_URL)return response(kind==='foreign-location'?'Authored foreign redirect refusal':control.stream,302,url,'text/html',{location:kind==='foreign-location'?'https://foreign-redirect.invalid/board':canonical})
  if(url===canonical){targets++;return response(raveBoard,200,url)}
  return guard.deny('unexpectedRequest')()
 }
 const pending=reflect(modules.rave.run({signal:caller.signal,fetchJson:async()=>{throw continuation}}));pending.then(value=>{settled=true;result=value})
 try{
  if(kind==='foreign-location'){result=await bounded(pending);assert.equal(result.reason.status,302);assert.equal(targets,0)}
  else{
   await bounded(control.entered.promise)
   if(kind==='delayed'){await turn();assert.equal(settled,false);assert.equal(targets,0);control.release.resolve();result=await bounded(pending);assert.equal(result.reason,continuation);assert.equal(targets,1)}
   else if(kind==='pending'){await pause(1200);assert.equal(settled,true,'Strict pending redirect disposal must expire');assert.equal(result.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT');assert.equal(targets,0)}
   else if(kind==='caller-pending'){caller.abort(reason);result=await bounded(pending);assert.equal(result.reason,reason);assert.equal(targets,0)}
   else{result=await bounded(pending);assert.equal(result.reason,control.cleanup);assert.equal(targets,0)}
   assert.equal(control.cancels,1)
  }
  observations.push({rave:'canonical-redirect',kind,targets,status:result?.reason?.status,code:result?.reason?.code})
 }finally{control.release.resolve();await bounded(pending);await turn();reset()}
})

for(const kind of['pending-byte-limit','reject-byte-limit','caller-byte-limit','closed-eof','errored-stream'])test('Rave active reader '+kind,{timeout:6000},async()=>{
 const entered=deferred(),release=deferred(),caller=new AbortController(),reason=Object.freeze({authoredCaller:'Rave reader'}),readFailure=Object.freeze(Error('Authored native read error'))
 let cancels=0,settled=false,result,calls=0
 const stream=new RealReadableStream({start(controller){if(kind==='errored-stream')controller.error(readFailure);else{controller.enqueue(new TextEncoder().encode(kind==='closed-eof'?raveHome:'x'.repeat(3000001)));if(kind==='closed-eof')controller.close()}},cancel(){cancels++;entered.resolve();if(kind==='reject-byte-limit')return Promise.reject(Error('Authored reader cancellation rejection'));return release.promise}})
 globalThis.fetch=async url=>{calls++;if(url===modules.rave.SUCCESSOR_HOMEPAGE_URL)return response(stream,200,url);if(url===modules.rave.CAREERS_URL&&kind==='closed-eof')return response('Authored denied response body',403,url);return guard.deny('unexpectedRequest')()}
 const pending=reflect(modules.rave.run({signal:caller.signal}));pending.then(value=>{settled=true;result=value})
 try{
  if(kind==='closed-eof'){result=await bounded(pending);assert.equal(result.reason.code,'RAVE_CAREERS_BLOCKED');assert.equal(cancels,0);assert.equal(calls,2)}
  else if(kind==='errored-stream'){result=await bounded(pending);assert.equal(result.reason,readFailure);assert.equal(cancels,0)}
  else{
   await bounded(entered.promise)
   if(kind==='pending-byte-limit'){await pause(1200);assert.equal(settled,true,'Byte-budget primary must not await cleanup forever');assert.match(result.reason.message,/body exceeds byte bound/)}
   else if(kind==='caller-byte-limit'){caller.abort(reason);result=await bounded(pending);assert.equal(result.reason,reason)}
   else{result=await bounded(pending);assert.match(result.reason.message,/body exceeds byte bound/)}
   assert.equal(cancels,1)
  }
  observations.push({rave:'reader',kind,cancels,calls,settledBeforeRelease:settled})
 }finally{release.resolve();await bounded(pending);await turn();reset()}
})

// Exercise the real public shared function with an authored selectable spec.
// This is not the registered Perfios legacy-transition qualification path.
for(const kind of['reject','pending','delayed','caller-pending'])test('shared Darwinbox authored session strict '+kind,{timeout:6000},async()=>{
 const control=streamControl(kind==='caller-pending'?'pending':kind),caller=new AbortController(),reason=Object.freeze({authoredCaller:'Darwinbox session'})
 const origin='https://authored-session.invalid',seed=origin+'/ms/candidatev2/main',corporate='https://authored-corporate.invalid/careers'
 const html='<!-- Authored ownership control --><base href="/ms/candidatev2/"><script src="main.authored.js"></script>',client='/* Authored inert client bytes; never executed */'
 const handoff='<a href="'+seed+'">Authored public handoff</a>'
 const spec={source:'authored-session-control',brand:'Authored employer',tenant:'authored',tenantId:'authored',origin,handoff:seed,corporateHandoff:seed,
  review:{corporatePages:[{url:corporate,status:200,sha256:guard.hash(handoff)}],clientUrl:origin+'/ms/candidatev2/main.authored.js',clientSha256:guard.hash(client),rendererSha256:guard.hash(html),schemas:{}}}
 const continuation=Object.freeze(Error('Authored completed session continuation'))
 let apiCalls=0,settled=false,result
 const fetchImpl=async(url,init={})=>{
  if(url===corporate)return response(handoff,200,url)
  if(url===seed&&init.headers)return response(html,200,url)
  if(url===spec.review.clientUrl)return response(client,200,url,'application/javascript')
  if(url===seed&&!init.headers)return response(control.stream,200,url,'text/html',{'set-cookie':'authored-session=1; Path=/'})
  if(url.startsWith(origin+'/ms/candidateapi/')){apiCalls++;throw continuation}
  return guard.deny('unexpectedRequest')()
 }
 const pending=reflect(modules.thirdWave.runReviewedThirdWaveDarwinboxInventory(spec,{signal:caller.signal,fetchImpl,now:fixedNow}));pending.then(value=>{settled=true;result=value})
 try{
  await bounded(control.entered.promise)
  if(kind==='delayed'){await turn();assert.equal(settled,false);assert.equal(apiCalls,0);control.release.resolve();result=await bounded(pending);assert.equal(result.reason,continuation);assert.equal(apiCalls,1)}
  else if(kind==='pending'){await pause(1200);assert.equal(settled,true,'Strict session cleanup must expire before any API read');assert.equal(result.reason.code,'NATIVE_RESPONSE_CLEANUP_TIMEOUT');assert.equal(apiCalls,0)}
  else if(kind==='caller-pending'){caller.abort(reason);result=await bounded(pending);assert.equal(result.reason,reason);assert.equal(apiCalls,0)}
  else{result=await bounded(pending);assert.equal(result.reason,control.cleanup);assert.equal(apiCalls,0)}
  assert.equal(control.cancels,1);observations.push({session:'authored-selectable-spec',kind,apiCalls,cancels:control.cancels,code:result?.reason?.code,notRegisteredPerfiosReplay:true})
 }finally{control.release.resolve();await bounded(pending);await turn();reset()}
})

test('Stanplus public seed ownership with authored corporate prelude and genuine reviewed candidate bytes',{timeout:6000},async()=>{
 const current=gzipFile('test/test-data/darwinbox-current-client-20261105.json.gz')
 const review=jsonFile('scraper/stanplus/reviewedNativeScope.json'),seed='https://redhealth.darwinbox.in/ms/candidatev2/main',client='https://redhealth.darwinbox.in/ms/candidatev2/main.819c4120b20f8091.js'
 const control=streamControl('delayed'),continuation=Object.freeze(Error('Authored Stanplus API continuation'))
 let apiCalls=0,settled=false
 const fetchImpl=async(url,init={})=>{
  if(review.corporatePages.some(p=>p.url===url))return response('<!-- Authored pre-seed handoff, not captured corporate evidence --><a href="'+seed+'">Roles</a>',200,url)
  if(url===seed&&init.headers)return response(current.shell,200,url)
  if(url===client)return response(current.client,200,url,'application/javascript')
  if(url===seed&&!init.headers)return response(control.stream,200,url,'text/html',{'set-cookie':'authored-session=1; Path=/'})
  if(url.startsWith('https://redhealth.darwinbox.in/ms/candidateapi/')){apiCalls++;throw continuation}
  return guard.deny('unexpectedRequest')()
 }
 const pending=reflect(modules.stanplus.run({fetchImpl,now:fixedNow}));pending.then(()=>{settled=true})
 try{await bounded(control.entered.promise);await turn();assert.equal(settled,false);assert.equal(apiCalls,0);control.release.resolve();const result=await bounded(pending);assert.equal(result.reason,continuation);assert.equal(apiCalls,1);assert.equal(control.cancels,1);observations.push({session:'Stanplus actual public run',genuineCandidateBytes:true,authoredCorporatePrelude:true,fullNativeInventoryReplay:false})}
 finally{control.release.resolve();await bounded(pending);await turn();reset()}
})

test('Perfios public legacy transition still refuses unreviewed authored shell bytes before session',{timeout:6000},async()=>{
 const bridge='https://perfios.darwinbox.in/ms/candidate/careers/',calls=[]
 const fetchImpl=async url=>{
  calls.push(url)
  if(url==='https://perfios.ai/careers/')return response('<!-- Authored negative gate control --><a href="'+bridge+'">Roles</a>',200,url)
  if(url===bridge)return response('<!-- Authored unreviewed legacy shell, expected refusal -->',200,url)
  return guard.deny('unexpectedRequest')()
 }
 const result=await bounded(reflect(modules.perfios.run({fetchImpl,now:fixedNow})))
 assert.equal(result.ok,false);assert.match(result.reason.message,/legacy transition shell changed/)
 assert.deepEqual(calls,['https://perfios.ai/careers/',bridge])
 observations.push({source:'perfios',legacyTransitionRefused:true,authoredNegative:true,fullNativeInventoryReplay:false})
})

test('Rave retained genuine native criteria remain partial through authored public-page transport prelude',{timeout:6000},async()=>{
 const detail=jsonFile('test/test-data/recruitmentGoal20261106/rave-current-detail.json')
 const row={id:detail.id,name:detail.name,company:detail.company,location:detail.location,releasedDate:detail.releasedDate,visibility:'PUBLIC',ref:modules.rave.SMARTRECRUITERS_LISTING_API_URL+'/'+detail.id,postingUrl:detail.postingUrl,applyUrl:detail.applyUrl}
 let listings=0
 globalThis.fetch=async url=>{
  if(url===modules.rave.SUCCESSOR_HOMEPAGE_URL)return response(raveHome,200,url)
  if(url===modules.rave.CAREERS_URL)return response(raveCareers,200,url)
  if(url===modules.rave.SMARTRECRUITERS_BOARD_URL)return response(raveBoard,200,url)
  return guard.deny('unexpectedRequest')()
 }
 try{
  const jobs=await modules.rave.run({now:fixedNow,fetchJson:async url=>{if(url.includes('/postings?')){listings++;return{offset:0,limit:100,totalFound:1,content:[row]}}assert.equal(url,row.ref);return structuredClone(detail)}})
  assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.match(jobs[0].jobDescription,/minimum 5\+ years in Java\/Javascript programming experience/)
  assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(listings,2)
  observations.push({source:'ravetechnologies',retainedNativeCriteriaSHA256:guard.hash(JSON.stringify(detail)),authoredCorporatePrelude:true,retainedJobs:1,liveAcquisition:false})
 }finally{reset()}
})

after(()=>{
 const report=guard.finish()
 report.cleanupTimers={created,cleared,pending:cleanupHandles.size}
 report.observations=observations
 report.authoredTransportOnlyForCausalControls=true
 report.fixtureLimit='Retained replay is not a new acquisition. Missing October Stanplus/Perfios inventories remain unverified; no full Perfios legacy-transition replay claim.'
 console.log('HTTP_DISPOSAL_GROUP_C '+JSON.stringify(report))
 assert.ok(Object.values(report.attempts).every(value=>value===0));assert.ok(report.files.every(item=>item.unchangedAtExit))
 assert.equal(report.dataUnchanged,true);assert.equal(report.harnessUnchanged,true);assert.equal(cleanupHandles.size,0)
 globalThis.setTimeout=rawSetTimeout;globalThis.clearTimeout=rawClearTimeout
 assert.equal(typeof globalThis.DOMMatrix,'undefined')
})

}
