// PROPOSED ONLY: no application execution is authorized by this file's creation.
import assert from 'node:assert/strict'
import test,{after} from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {nativeReferences,observeNativeStream,assertNativeReferencesUnchanged} from './native-observers.mjs'
import {flow,root,sha,counters,permissions,imported,observedReads,deny,assertGuard} from './guard.mjs'

const clocks=Object.freeze({Date,now:Date.now,timeout:AbortSignal.timeout,performanceNow:performance.now})
const app=await import(pathToFileURL(path.join(root,flow.entry)))
const provider={source:'slb',companyName:'SLB',countryFilter:'India',companyCareerPage:flow.targetURL}
const directContract={source:'firebolt',companyName:'Firebolt',careersUrl:flow.targetURL,companyDomain:'firebolt.io',nativeSlug:'firebolt',nativeCompanyUid:'26.004',nativeRoleDescriptionHeading:'About the role',nativeClientSHA256:'664680f59b3640c168c58230a2f95965ff334c15937555dfd33b39f7dfca1ea4'}
let audit=null
const invoke=signal=>flow.id==='slb-current-reader'?app.runCurrentSlbCareers({provider,signal}):flow.id==='comeet-export-direct-contract'?app.createEmployerBoundComeetScraper(directContract).run({signal}):app.run({signal,onAudit:value=>{audit=value}})
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const turn=()=>new Promise(resolve=>setImmediate(resolve))
const observe=pending=>{const box={settled:false,result:null};box.promise=Promise.resolve(pending).then(value=>({ok:true,value}),reason=>({ok:false,reason})).then(result=>{box.settled=true;box.result=result;return result});return box}
const observations=[]
const isCohere=flow.id==='cohere-current'
const opaque=()=>{let reads=0;const reason=Object.freeze(Object.defineProperties({authoredCaller:true},Object.fromEntries(['name','message','code'].map(key=>[key,{get(){reads++;throw Error('Caller reason property must remain opaque: '+key)}}]))));return{reason,get reads(){return reads}}}
const response=(body,url=flow.targetURL,status=200,mime='text/html')=>{const value=new nativeReferences.ResponseConstructor(body,{status,headers:{'content-type':mime}});Object.defineProperty(value,'url',{value:url});return value}
function setFetch(handler){const calls=[];globalThis.fetch=async(input,init={})=>{const url=String(input);calls.push({url,method:init.method||'GET',signal:init.signal});assert.ok(init.signal instanceof AbortSignal);return handler(url,init,calls.length)};return calls}
const firstOnly=(handler)=>setFetch((url,init,count)=>{if(url!==flow.targetURL||count!==1)return deny('unexpectedRequest')();return handler(url,init)})
const primaryPattern=isCohere?/Cohere decoded body budget exhausted/:flow.id==='slb-current-reader'?/SLB current native contract: native response body bound/:flow.id==='coinbase-current'?/\[coinbase\] Native response exceeds 8 MiB limit/:/native response byte bound exceeded/
function primary(result){if(isCohere){assert.equal(result.ok,true);assert.ok(audit,'Normal audit callback required');assert.match(JSON.stringify(audit),primaryPattern)}else{assert.equal(result.ok,false);assert.match(result.reason?.message||'',primaryPattern)}}
function exactObservers(observer,{cancel=1,release=1}={}){assert.equal(observer.acquired.length,1);for(const row of observer.records){assert.equal(row.receiverExact,true);assert.equal(row.argc,0,'Preserve actual existing no-argument native call')};assert.equal(observer.records.filter(row=>row.operation==='cancel').length,cancel);assert.equal(observer.records.filter(row=>row.operation==='releaseLock').length,release);assert.equal(observer.stream.locked,false)}
function active(mode){const entered=deferred(),gate=deferred(),cleanup=Error('AUTHORED cancellation failure');let cancels=0,controller
 const stream=new nativeReferences.Stream({start(value){controller=value;value.enqueue(new Uint8Array(flow.maxBodyBytes+1))},cancel(reason){cancels++;assert.equal(reason,undefined);entered.resolve();if(mode==='throw')throw cleanup;if(mode==='reject')return Promise.reject(cleanup);if(mode==='pending'||mode==='prompt')return gate.promise}})
 return{stream,controller,observer:observeNativeStream(stream),entered,gate,cleanup,get cancels(){return cancels}}
}
const named=(name,body)=>test(flow.id+' / '+name,{concurrency:false,timeout:15000},body)
for(const name of flow.cases.filter(name=>name.startsWith('overflow-')))named(name,async()=>{
 audit=null;const mode=name==='overflow-cancel-throws'?'throw':name==='overflow-cancel-rejects'?'reject':name.includes('pending')?'pending':name==='overflow-prompt-owned'?'prompt':'ordinary'
 const control=active(mode),caller=new AbortController(),external=opaque(),calls=firstOnly(()=>response(control.stream)),box=observe(invoke(caller.signal));let duringPending=null
 try{
  await control.entered.promise
  if(name==='overflow-cancel-pending'){await pause(1250);duringPending={settled:box.settled,locked:control.stream.locked};observations.push({case:name,duringPending});assert.equal(box.settled,true,'Original failure must settle within bounded cleanup grace');assert.equal(control.stream.locked,false)}
  if(name==='overflow-caller-opaque-pending'){caller.abort(external.reason);await pause(100);duringPending={settled:box.settled,locked:control.stream.locked};observations.push({case:name,duringPending});assert.equal(box.settled,true,'Caller must settle while native cancellation is pending');assert.equal(box.result.reason,external.reason);assert.equal(external.reads,0)}
  if(name==='overflow-prompt-owned'){await pause(20);assert.equal(box.settled,false,'Prompt cancellation remains owned');assert.equal(control.stream.locked,true);control.gate.resolve()}
  const result=await box.promise
  if(name!=='overflow-caller-opaque-pending')primary(result)
  assert.equal(calls.length,1);assert.equal(control.cancels,1);exactObservers(control.observer)
  observations.push({case:name,settled:true,primaryPreserved:name!=='overflow-caller-opaque-pending',callerIdentity:name==='overflow-caller-opaque-pending',observer:control.observer.summary(),physicalRequests:calls.length})
 }finally{control.gate.resolve();await box.promise;await turn();globalThis.fetch=deny('network')}
})
named('closed-read-error-identity',async()=>{
 audit=null;const sentinel=Error('AUTHORED native read failure identity');let underlyingCancels=0
 const stream=new nativeReferences.Stream({start(controller){controller.error(sentinel)},cancel(){underlyingCancels++}}),observer=observeNativeStream(stream)
 const calls=firstOnly(()=>response(stream)),box=observe(invoke(new AbortController().signal))
 try{const result=await box.promise;if(isCohere){assert.equal(result.ok,true);assert.match(JSON.stringify(audit),/AUTHORED native read failure identity/)}else{assert.equal(result.ok,false);assert.equal(result.reason,sentinel)}assert.equal(calls.length,1);assert.equal(underlyingCancels,0,'Already errored native stream must not call underlying cancel');exactObservers(observer);observations.push({case:'closed-read-error-identity',cohereAuditContract:isCohere,underlyingCancels,observer:observer.summary()})}
 finally{await box.promise;globalThis.fetch=deny('network')}
})
named('closed-eof-malformed-control',async()=>{
 audit=null;const observers=[];const calls=setFetch((url,init,count)=>{
  const secondSlb=flow.id==='slb-current-reader'&&count===2&&url==='https://careers.slb.com/static/js/js-atomic-job-listing-search.js'
  if(!(count===1&&url===flow.targetURL)&&!secondSlb)return deny('unexpectedRequest')()
  const stream=new nativeReferences.Stream({start(controller){controller.enqueue(new TextEncoder().encode('AUTHORED malformed closed body'));controller.close()},cancel(){assert.fail('EOF stream underlying cancel must not run')}});observers.push(observeNativeStream(stream));return response(stream,url,isCohere?403:200,secondSlb?'application/javascript':flow.id==='coinbase-current'?'application/json':'text/html')
 });const box=observe(invoke(new AbortController().signal))
 try{const result=await box.promise;if(isCohere){assert.equal(result.ok,true);assert.ok(audit)}else assert.equal(result.ok,false);assert.equal(calls.length,flow.id==='slb-current-reader'?2:1);for(const observer of observers)exactObservers(observer,{cancel:0});observations.push({case:'closed-eof-malformed-control',authoredDenialOnly:isCohere,physicalRequests:calls.length,observers:observers.map(value=>value.summary())})}
 finally{await box.promise;globalThis.fetch=deny('network')}
})
named('preabort-opaque',async()=>{const external=opaque(),caller=new AbortController();caller.abort(external.reason);const calls=firstOnly(()=>assert.fail('Preaborted caller must not fetch'));try{const result=await observe(invoke(caller.signal)).promise;assert.equal(result.ok,false);assert.equal(result.reason,external.reason);assert.equal(external.reads,0);assert.equal(calls.length,0);observations.push({case:'preabort-opaque',callerIdentity:true,physicalRequests:0})}finally{globalThis.fetch=deny('network')}})
for(const name of flow.cases.filter(name=>name.startsWith('caller-')))named(name,async()=>{
 const caller=new AbortController(),external=opaque(),reason=name==='caller-null-pending-read'?null:external.reason,entered=deferred();let controller,underlyingCancels=0
 const stream=new nativeReferences.Stream({start(value){controller=value},pull(){entered.resolve()},cancel(){underlyingCancels++}}),observer=observeNativeStream(stream)
 const calls=firstOnly((url,init)=>{init.signal.addEventListener('abort',()=>controller.error(init.signal.reason),{once:true});return response(stream,url)})
 const box=observe(invoke(caller.signal));try{await entered.promise;await turn();assert.ok(observer.records.some(row=>row.operation==='read'));caller.abort(reason);const result=await box.promise;observations.push({case:name,callerIdentity:result.reason===reason,opaqueGetterReads:external.reads,underlyingCancels,observer:observer.summary()});assert.equal(result.ok,false);assert.equal(result.reason,reason);assert.equal(external.reads,0);assert.equal(underlyingCancels,0);assert.equal(calls.length,1);exactObservers(observer)}finally{if(!caller.signal.aborted)caller.abort(reason);await box.promise;globalThis.fetch=deny('network')}
})

// Genuine compatibility uses full native Response reads, never injected parsed
// JSON/page functions. Source clocks, pacing, limits and publication logic stand.
if(flow.compatibility)test(flow.id+' / genuine-capture-compatibility',{concurrency:false,timeout:180000},async()=>{
 audit=null;const pin=flow.compatibility.pin,raw=fs.readFileSync(path.join(root,pin.copy));assert.equal(sha(raw),pin.sha256)
 const data=JSON.parse(pin.path.endsWith('.gz')?gunzipSync(raw).toString('utf8'):raw.toString('utf8'))
 const packets=flow.id==='firebolt-current'?data.requests:flow.id==='cohere-current'?data.packets:flow.id==='slb-current-reader'?data.requests:[{url:flow.targetURL,status:200,headers:{'content-type':'application/json'}}]
 const used=new Set(),observers=[]
 const calls=setFetch((url,init)=>{
  const index=packets.findIndex((packet,index)=>!used.has(index)&&(packet.url||packet.requestedURL)===url&&(packet.method||'GET')===(init.method||'GET'))
  if(index<0)return deny('unexpectedRequest')();used.add(index);const packet=packets[index]
  const body=flow.id==='firebolt-current'?Buffer.from(data.entities[packet.bodySHA256],'base64'):flow.id==='cohere-current'?Buffer.from(packet.rawBodyBase64,'base64'):flow.id==='slb-current-reader'?Buffer.from(packet.text):raw
  if(packet.bodySHA256)assert.equal(sha(body),packet.bodySHA256);if(packet.bodyBytes!=null)assert.equal(body.length,packet.bodyBytes)
  if(flow.id==='slb-current-reader')assert.equal(init.body??null,packet.body??null,'Retain original SLB request body')
  const stream=new nativeReferences.Stream({start(controller){controller.enqueue(new Uint8Array(body));controller.close()},cancel(){assert.fail('Genuine EOF response must not be cancelled')}});observers.push(observeNativeStream(stream))
  const value=new nativeReferences.ResponseConstructor(stream,{status:packet.status,headers:packet.headers||{'content-type':packet.contentType||'text/html'}});Object.defineProperty(value,'url',{value:packet.finalURL||url});return value
 });const box=observe(invoke(new AbortController().signal))
 try{
  const result=await box.promise;assert.equal(result.ok,true);const jobs=result.value;assert.ok(Array.isArray(jobs));assert.equal(used.size,packets.length,'Every original retained response must be consumed');for(const observer of observers)exactObservers(observer,{cancel:0})
  let stable
  if(flow.id==='coinbase-current'){
   const ids=[7606826,7739592,7985187,8054055,8054153,8122777,8165441,8167571,8265918,8325213,8333273,8333981,8334152,8334157,8334161,8334164,8334764,8334767];assert.deepEqual(jobs.map(job=>job.jobId).sort((a,b)=>a-b),ids)
   for(const job of jobs){const original=data.jobs.find(row=>row.id===job.jobId);assert.deepEqual(job.nativeSourceRecord,original);assert.equal(job.nativeDescriptionRaw,original.content);assert.equal(job.sourceUrl,original.absolute_url);assert.equal(job.country,'India');assert.equal(job.sourceScopeComplete,false)}stable=jobs.map(job=>({id:job.jobId,native:job.nativeSourceRecord,description:job.nativeDescriptionRaw}))
  }else if(flow.id==='firebolt-current'){
   assert.equal(jobs.length,0);const proof=Object.getOwnPropertySymbols(jobs).map(symbol=>jobs[symbol]).find(value=>value?.nativeInventory);assert.ok(proof);assert.equal(proof.nativeInventory.observedNativePostings,3);assert.equal(proof.nativeInventory.locatedRolesWithFullContent,2);assert.deepEqual(proof.nativeInventory.unresolvedCountryPostings,['63.F1C']);assert.deepEqual(proof.nativeInventory.incompleteContentPostings,['63.F1C']);assert.equal(proof.nativeInventory.snapshots,2);stable=proof
  }else if(flow.id==='cohere-current'){
   assert.equal(jobs.length,0);assert.ok(audit);assert.equal(audit.observations.length,122);assert.equal(audit.coherePublicInventory.publicNativeRoleCount,122);for(const job of audit.observations){assert.ok(job.sourceNativeAPIRecord);assert.ok(job.sourceNativePosting);assert.ok(job.sourceNativeJobPosting);assert.equal(job.sourceNativePosting.descriptionHtml,job.sourceNativeAPIRecord.descriptionHtml);assert.equal(job.sourceNativePosting.descriptionHtml,job.sourceNativeJobPosting.description);assert.equal(job.sourceNativeApplication.activationVerified,false)}stable=audit.observations.map(job=>({jobId:job.jobId,sourceNativeAPIRecord:job.sourceNativeAPIRecord,sourceNativePosting:job.sourceNativePosting,sourceNativeJobPosting:job.sourceNativeJobPosting}))
  }else{
   assert.ok(jobs.length>0);for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.ok(job.jobDescription.length>=100);assert.equal(job.sourceDescription,job.jobDescription);assert.equal(job.nativeRoleClosingReconciled,true);assert.deepEqual(job.nativeSourceRecord.nativeListing,job.nativeSourceRecord.nativeClosingListing)}const collection=jobs[app.SLB_COLLECTION];assert.ok(collection);assert.equal(collection.openingNativeCount,43);assert.equal(collection.closingNativeCount,43);assert.equal(collection.nativeListingEnumerationComplete,true);assert.equal(collection.sourceScopeComplete,false);stable={jobs:jobs.map(job=>({id:job.nativeCurrentPostingId,description:job.jobDescription,sourceUrl:job.sourceUrl})),collection}
  }
  observations.push({case:'genuine-capture-compatibility',fixtureSHA256:pin.sha256,packets:used.size,returnedJobs:jobs.length,semanticSHA256:sha(JSON.stringify(stable)),historicalCompatibilityOnly:true,livePublisherClaim:false,sourceClockOverridden:false,sourcePacingOverridden:false})
 }finally{await box.promise;globalThis.fetch=deny('network')}
})
after(()=>{assertGuard();assertNativeReferencesUnchanged(assert);assert.equal(Date,clocks.Date);assert.equal(Date.now,clocks.now);assert.equal(AbortSignal.timeout,clocks.timeout);assert.equal(performance.now,clocks.performanceNow);console.log('READER_CLEANUP_RECEIPT '+JSON.stringify({flow:flow.id,sourcePins:flow.modules,imported:[...imported.values()],namedReads:[...observedReads],counters,permissions,observations,sourceClocksUnchanged:true,registeredCurrentImpact:flow.registeredCurrentImpact,livePublisherClaim:false}))})
