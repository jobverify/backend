import {setTimeout as delay} from 'node:timers/promises'
import {types,isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readJasperCorporate,readJasperBoard,readJasperApi,readJasperOwn,reconcileJasperServerProgramme} from './currentProgrammeData.js'
import {SOURCE,CORPORATE,BOARD,API,need,sha,copyData,freezeData} from './currentProgrammeRenderer.js'

const plain=value=>value!==null&&typeof value==='object'&&!types.isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))
const own=(value,key,required=false)=>{
 need(plain(value),'options','Plain own-data options/metadata required')
 const d=Object.getOwnPropertyDescriptor(value,key)
 need(!d||Object.hasOwn(d,'value'),'options','Accessors cannot establish source provenance: '+key)
 need(!required||d,'response','Original response field unavailable: '+key)
 return d?.value
}
const supported=['signal','sourceTimeoutMs','requestTimeoutMs','maxRequests','maxResponseBytes','maxAggregateBytes','onAudit']
function optionsModel(options,transport){
 need(plain(options),'options','Controller options must be plain own data')
 for(const key of Reflect.ownKeys(options))need(typeof key==='string'&&[...supported,...transport].includes(key),'options','Unsupported source/profile/authority option')
 const result={};for(const key of [...supported,...transport]){const value=own(options,key);if(value!==undefined)result[key]=value}
 return result
}
const limit=(value,fallback,maximum,label)=>{value??=fallback;need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'bounds','Invalid downward '+label+' bound');return value}
const signalAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get
const signalReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get
function nativeSignal(value){
 if(value===undefined)return
 need(value&&typeof value==='object'&&!types.isProxy(value),'options','Native AbortSignal required')
 try{signalAborted.call(value)}catch{need(false,'options','Native AbortSignal required')}
}
const throwIfAborted=signal=>{if(signalAborted.call(signal))throw signalReason.call(signal)}
const typed=Object.getPrototypeOf(Uint8Array.prototype)
const lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength').get
const offsetOf=Object.getOwnPropertyDescriptor(typed,'byteOffset').get
const bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer').get
const typedSet=typed.set
function entityLength(value){
 need(value&&!types.isProxy(value)&&types.isUint8Array(value),'body','Original Uint8Array entity required')
 need(!types.isSharedArrayBuffer(bufferOf.call(value)),'body','Shared mutable entity is unsupported')
 return lengthOf.call(value)
}
function entityCopy(value,maximum){
 const size=Math.min(entityLength(value),maximum),result=new Uint8Array(size)
 typedSet.call(result,new Uint8Array(bufferOf.call(value),offsetOf.call(value),size),0)
 return Buffer.from(result.buffer)
}
const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
function wait(operation,signal,disposeLate){
 return new Promise((resolve,reject)=>{
  let settled=false
  const finish=(fn,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);fn(value)}
  const abort=()=>finish(reject,signal.reason)
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
  Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{
   if(settled){if(disposeLate)ignore(()=>disposeLate(value));return}finish(resolve,value)
  },error=>finish(reject,error))
 })
}
const errorField=(value,key)=>value&&typeof value==='object'&&!types.isProxy(value)?Object.getOwnPropertyDescriptor(value,key)?.value:undefined
function errorFacts(value){
 let name=errorField(value,'name'),message=errorField(value,'message')
 if(value&&typeof value==='object'&&!types.isProxy(value)){
  try{if(value instanceof DOMException){name=Object.getOwnPropertyDescriptor(DOMException.prototype,'name').get.call(value);message=Object.getOwnPropertyDescriptor(DOMException.prototype,'message').get.call(value)}}catch{}
 }
 return{name:typeof name==='string'?name:'Error',message:typeof message==='string'?message.slice(0,65536):typeof value==='string'?value.slice(0,65536):'Native source operation held',
  ...(typeof errorField(value,'reason')==='string'?{reason:errorField(value,'reason')}:{}),...(typeof errorField(value,'code')==='string'?{code:errorField(value,'code')}:{}),
  ...(typeof errorField(value,'failureKind')==='string'?{failureKind:errorField(value,'failureKind')}:{})}
}
function nativeError(caught){
 if(caught&&typeof caught==='object'&&!types.isProxy(caught)&&Object.isExtensible(caught)&&(types.isNativeError(caught)||caught instanceof DOMException))return caught
 const facts=errorFacts(caught),result=Error(facts.message,{cause:caught});Object.assign(result,facts);return result
}
const held=(reason,message)=>{try{need(false,reason,message)}catch(error){return error}}
const responseFailures=new WeakMap(),responseProgress=new WeakMap()

/** Complete fixed Jasper server-data transaction. The raw reader must supply
 * its genuine flat receipt; controller clocks never replace original clocks. */
export async function readCurrentJasperProgramme(options={}){
 const input=optionsModel(options,['readPage']),parent=input.signal;nativeSignal(parent);if(parent)throwIfAborted(parent)
 const bound={requests:limit(input.maxRequests,26,26,'request'),entity:limit(input.maxResponseBytes,4194304,4194304,'entity byte'),
  aggregate:limit(input.maxAggregateBytes,25165824,25165824,'aggregate byte'),source:limit(input.sourceTimeoutMs,90000,120000,'source deadline'),
  request:limit(input.requestTimeoutMs,20000,20000,'complete request deadline')}
 need(bound.requests>=8,'bounds','Minimum complete native protocol needs eight requests')
 need(typeof input.readPage==='function'&&(input.onAudit===undefined||typeof input.onAudit==='function'),'options','Raw reader and optional observer must be callable')
 const started=performance.now(),controller=new AbortController(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal
 const expire=()=>controller.abort(new DOMException('Jasper source deadline exceeded','TimeoutError'))
 const timer=setTimeout(expire,bound.source)
 const check=()=>{if(performance.now()-started>=bound.source&&!controller.signal.aborted)expire();signal.throwIfAborted()}
 const audit={source:SOURCE,archiveNativeCollectionEvidence:true,controllerStartedAt:new Date().toISOString(),requests:0,nativeProgrammeRequests:0,rawPages:[],nativePayload:null,nativeRecords:null,
  recordKind:'vacancy-rows',observedRecordCount:null,observedVacancyCount:null,reportedTotal:null,nativeIndiaCount:null,
  sourceScopeComplete:false,companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  sourceBodiesQualified:false,rendererConsumptionQualified:false,fullRenderedCriteriaQualified:false,browserExecutionQualified:false,
  applicationVisited:false,screeningCriteriaAcquired:false,privacyPolicyVisited:false,legalSemanticsQualified:false,applicantEligibilityQualified:false,legalEmployerQualified:false,
  publisherScriptsExecuted:false,sourceTimeSemanticsQualified:false,currentTransactionQualified:false,currentDeclaredSourceProgramComplete:false,
  countryQualificationScope:'finite-server-published-work-country',sourceScope:'Only the exact Jasper corporate handoff, named unfiltered native board/API and every corresponding own server record. No global/company/UI/application inventory claim.',
  totalPublicRequests:null,legacyPublicRequestCount:null,requestCountScope:'Attempted declared native raw reads only; prior primary retries remain unmeasured.',
  protocol:'C,B,A,O1..ON,ON..O1,A,B,C',bounds:bound,openingClosingEquality:[]}
 let aggregate=0,retained=0,closingBytes=0,openingCount=4
 const opened=new Map(),allowed=new Set([CORPORATE,BOARD,API])
 const parse=(record,kind)=>kind==='C'?readJasperCorporate(record):kind==='B'?readJasperBoard(record):kind==='A'?readJasperApi(record):readJasperOwn(record)
 const snapshotAudit=()=>freezeData(copyData({...audit,aggregateBytes:aggregate,retainedBytes:retained,controllerElapsedMs:performance.now()-started}))
 async function read(url,kind,isOpening){
  check();need(allowed.has(url),'route','Undeclared native route')
  const remainingOpen=isOpening?openingCount-opened.size:0,remainingClose=opened.size
  need(audit.requests+(isOpening?remainingOpen*2+remainingClose:remainingClose)<=bound.requests,'bounds','All remaining opening/closing request slots must be reserved')
  let maximum
  if(isOpening)maximum=Math.min(bound.entity,Math.floor((bound.aggregate-aggregate-closingBytes-2*(remainingOpen-1))/2))
  else{
   const previous=opened.get(url);need(previous,'phase','Cannot close an unopened source')
   need(bound.aggregate-aggregate>=closingBytes,'bounds','Exact known closing byte reserve unavailable')
   maximum=Math.min(bound.entity,bound.aggregate-aggregate-(closingBytes-previous.body.length))
  }
  need(maximum>0,'bounds','Complete entity and closing byte reserve unavailable')
  const receipt={phase:(isOpening?'opening-':'closing-')+kind,requestedURL:url,controllerRequestedAt:new Date().toISOString(),bodyComplete:false}
  audit.rawPages.push(receipt);audit.requests=audit.nativeProgrammeRequests=audit.rawPages.length
  const request=new AbortController(),requestSignal=AbortSignal.any([signal,request.signal]),requestStarted=performance.now()
  const expireRequest=()=>request.abort(new DOMException('Jasper request deadline exceeded','TimeoutError'))
  const requestTimer=setTimeout(expireRequest,bound.request)
  const checkRequest=()=>{check();if(performance.now()-requestStarted>=bound.request&&!request.signal.aborted)expireRequest();requestSignal.throwIfAborted()}
  let accounted=false
  try{
   const page=await wait(()=>input.readPage(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',headers:{Accept:kind==='A'?'application/json':'text/html','Cache-Control':'no-store',Pragma:'no-cache'},
    signal:requestSignal,maxBodyBytes:maximum,checkDeadline:checkRequest}),requestSignal)
   need(plain(page),'response','Original flat raw response record required')
   const supplied=own(page,'body',true),consumed=entityLength(supplied),body=entityCopy(supplied,maximum)
   aggregate+=consumed;retained+=body.length;accounted=true
   Object.assign(receipt,{bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),bodyComplete:false,consumedBodyBytes:consumed,discardedOverflowBytes:consumed-body.length})
   const metadata={}
   for(const key of Reflect.ownKeys(page)){
    if(key==='body')continue
    need(typeof key==='string','response','Unsupported response metadata key')
    Object.defineProperty(metadata,key,{value:copyData(own(page,key,true)),enumerable:true,writable:true,configurable:true})
   }
   receipt.originalResponse=metadata
   for(const key of ['source','requestedURL','finalURL','status','method','cache','credentials','redirect','requestHeaders','headers','headerEntries','requestedAt','responseAt','completedAt'])if(Object.hasOwn(metadata,key))receipt[key]=metadata[key]
   receipt.bodyComplete=metadata.bodyComplete===true&&consumed<=maximum
   receipt.controllerResponseReceivedAt=new Date().toISOString()
   checkRequest()
   need(consumed>0&&consumed<=maximum&&receipt.bodyComplete,'body','Empty/incomplete/oversized native entity')
   const model=parse({...metadata,body},kind);checkRequest()
   receipt.securityPolicy=model.securityFacts.original
   if(isOpening){opened.set(url,{body,security:model.securityFacts.original,model,receipt});closingBytes+=body.length}
   else{
    const previous=opened.get(url)
    need(body.equals(previous.body)&&isDeepStrictEqual(model.securityFacts.original,previous.security),'closing','Whole original closing entity or security changed')
    audit.openingClosingEquality.push({url,openingSHA256:previous.receipt.bodySHA256,closingSHA256:receipt.bodySHA256,wholeRawEntityEqual:true,securityPolicyEqual:true})
    closingBytes-=previous.body.length;opened.delete(url)
   }
   receipt.controllerCompletedAt=new Date().toISOString();checkRequest();return model
  }catch(caught){
   const error=nativeError(caught),progress=!accounted&&(responseFailures.get(error)??responseProgress.get(requestSignal)?.())
   if(progress){Object.assign(receipt,progress);aggregate+=progress.consumedBodyBytes??progress.bodyBytes??0;retained+=progress.bodyBytes??0;accounted=true}
   receipt.failure=errorFacts(error);receipt.controllerCompletedAt=new Date().toISOString();throw error
  }finally{responseProgress.delete(requestSignal);clearTimeout(requestTimer);request.abort()}
 }
 try{
  check();const corporate=await read(CORPORATE,'C',true),board=await read(BOARD,'B',true)
  const N=board.originalAppData.jobBoard.jobPostings.length;openingCount=3+N
  need(openingCount*2<=bound.requests,'bounds','Complete current native inventory and closings exceed request capacity');check()
  const api=await read(API,'A',true);audit.nativePayload=api.nativePayload
  const records=api.nativePayload.jobs,ids=new Set(board.originalAppData.jobBoard.jobPostings.map(p=>p.id))
  need(records.length===N&&records.every(p=>ids.has(p.id)),'membership','Whole independent native/API inventories differ')
  for(const record of records)allowed.add(record.jobUrl)
  const roles=[];for(const record of records)roles.push(await read(record.jobUrl,'O',true))
  check();const opening=reconcileJasperServerProgramme({corporate,board,api,roles});check()
  audit.nativePayload=opening.nativePayload;audit.nativeRecords=opening.nativeRecords;audit.pureOpeningResult=opening
  audit.observedRecordCount=audit.observedVacancyCount=N;audit.allOpeningReadsBeforeClosing=true
  const closed=new Map();for(const record of [...records].reverse())closed.set(record.jobUrl,await read(record.jobUrl,'O',false))
  const closingApi=await read(API,'A',false),closingBoard=await read(BOARD,'B',false),closingCorporate=await read(CORPORATE,'C',false)
  check();const closing=reconcileJasperServerProgramme({corporate:closingCorporate,board:closingBoard,api:closingApi,roles:records.map(p=>closed.get(p.jobUrl))});check()
  need(isDeepStrictEqual(opening.nativePayload,closing.nativePayload)&&opened.size===0&&closingBytes===0&&audit.requests===6+2*N,'closing','Complete closing models, native envelope or request interval differ')
  Object.assign(audit,{allNativeModelsRechecked:true,currentTransactionQualified:true,currentDeclaredSourceProgramComplete:true,nativeIndiaCount:0,
   aggregateBytes:aggregate,retainedBytes:retained,completedAt:new Date().toISOString()})
  if(input.onAudit){
   audit.observerStartedAt=new Date().toISOString();check();const copy=copyData(audit);check()
   await wait(()=>input.onAudit(copy),signal);check();audit.observerCompletedAt=new Date().toISOString()
  }
  check();const finalAudit=snapshotAudit();check();const jobs=[]
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:N,observedVacancyCount:N,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});check()
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:finalAudit,configurable:true});check()
  const result=attachInventoryEvidence(jobs,{status:'complete-inventory',surface:CORPORATE,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,
   reportedTotal:null,indiaFacetCount:0,verifiedAt:audit.completedAt,reason:'Complete finite Jasper corporate/named native board/API and every own server-published work-country record; whole raw opening/closing interval and all native primary/plain/LD/head/teams/supplements reconcile. Source/global/UI/application/legal eligibility and cleanup remain unqualified.'})
  check();return result
 }catch(caught){
  const error=nativeError(caught);audit.currentTransactionQualified=false;audit.currentDeclaredSourceProgramComplete=false;audit.heldAt=new Date().toISOString();audit.failure=errorFacts(error)
  const evidence=snapshotAudit()
  try{Object.defineProperty(error,'nativeCollectionEvidence',{value:evidence,configurable:true})}catch{const wrapped=held('held','Finite server programme evidence held');wrapped.cause=error;Object.defineProperty(wrapped,'nativeCollectionEvidence',{value:evidence});throw wrapped}
  throw error
 }finally{clearTimeout(timer);controller.abort()}
}

/** Real raw Fetch adapter. No retries, redirect following, alternate routes,
 * child requests, publisher execution or reconstructed response metadata. */
export async function runCurrentJasperProgramme(options={}){
 const input=optionsModel(options,['fetchImpl','requestIntervalMs']),parent=input.signal;nativeSignal(parent);if(parent)throwIfAborted(parent)
 const fetchImpl=input.fetchImpl??globalThis.fetch,interval=input.requestIntervalMs??500
 need(typeof fetchImpl==='function'&&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'options','Raw Fetch transport and bounded pacing required')
 const forwarded={};for(const key of supported)if(Object.hasOwn(input,key))forwarded[key]=input[key]
 let next=0
 return readCurrentJasperProgramme({...forwarded,readPage:async(url,init)=>{
  if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal})
  init.checkDeadline();next=performance.now()+interval
  const requestedAt=new Date().toISOString(),chunks=[]
  let response,reader,canceled=false,released=false,complete=false,size=0,discardedOverflowBytes=0,base=null
  const acquired=()=>{
   const body=Buffer.concat(chunks,size)
   return{...base,bodyComplete:false,streamDone:false,decodedPrefixOnly:true,bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),
    consumedBodyBytes:size+discardedOverflowBytes,discardedOverflowBytes,completedAt:new Date().toISOString(),bodyRepresentation:'Genuinely acquired bounded Fetch-decoded prefix; incomplete and not raw-wire bytes.'}
  }
  const release=()=>{if(released||!reader)return;released=true;try{reader.releaseLock()}catch{}}
  const cancel=reason=>{if(canceled)return;canceled=true;ignore(()=>reader?reader.cancel(reason):response?.body?.cancel(reason));release()}
  const aborted=()=>cancel(init.signal.reason)
  try{
   response=await wait(()=>fetchImpl(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',headers:init.headers,signal:init.signal}),init.signal,late=>late?.body?.cancel())
   need(response&&typeof response.url==='string','response','Original Fetch final URL unavailable')
   const headerEntries=[...response.headers],headers=Object.fromEntries(headerEntries)
   base={source:SOURCE,requestedURL:url,finalURL:response.url,status:response.status,method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',requestHeaders:init.headers,
    requestedAt,responseAt:new Date().toISOString(),headers,headerEntries}
   responseProgress.set(init.signal,acquired)
   const advertised=response.headers.get('content-length')
   need(advertised===null||/^\d+$/.test(advertised),'body','Malformed advertised body length')
   need(advertised===null||Number(advertised)<=init.maxBodyBytes,'body','Advertised body exceeds entity/closing reserve')
   init.signal.addEventListener('abort',aborted,{once:true});init.checkDeadline()
   reader=response.body?.getReader();need(reader,'body','Readable original entity stream required')
   while(true){
    init.checkDeadline();const part=await wait(()=>reader.read(),init.signal)
    need(plain(part),'body','Plain original stream result required')
    const done=own(part,'done',true);need(typeof done==='boolean','body','Explicit stream completion flag required')
    if(done){init.checkDeadline();complete=true;break}
    const chunk=own(part,'value',true),length=entityLength(chunk),remaining=init.maxBodyBytes-size
    if(length>remaining){if(remaining>0){chunks.push(entityCopy(chunk,remaining));size+=remaining}discardedOverflowBytes+=length-Math.max(remaining,0);throw held('body','Streamed entity exceeds closing/entity reserve')}
    const copied=entityCopy(chunk,remaining);chunks.push(copied);size+=copied.length;init.checkDeadline()
   }
   const body=Buffer.concat(chunks,size);init.checkDeadline()
   return{...base,body,bodyBytes:body.length,bodySHA256:sha(body),bodyComplete:true,streamDone:true,decodedPrefixOnly:false,error:null,
    consumedBodyBytes:body.length,discardedOverflowBytes:0,completedAt:new Date().toISOString(),bodyRepresentation:'Complete original Fetch-decoded entity bytes; not raw-wire bytes.'}
  }catch(caught){
   const error=nativeError(caught);if(base)responseFailures.set(error,{...acquired(),failure:errorFacts(error)});throw error
  }finally{init.signal.removeEventListener('abort',aborted);if(!complete)cancel(init.signal.reason);release()}
 }})
}
