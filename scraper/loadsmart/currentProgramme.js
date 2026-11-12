import {setTimeout as delay} from 'node:timers/promises'
import {types,isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE,BOARD,CLIENT,API,LOADSMART_SERVER_PUBLICATION_PROFILE,sha,failure,need,readLoadsmartCorporate,readLoadsmartBoard,readLoadsmartClient,readLoadsmartNative,reconcileLoadsmartBoard,readLoadsmartSecurity} from './currentProgrammeData.js'

const cap=(n,fallback,max,label)=>{n??=fallback;need(Number.isSafeInteger(n)&&n>0&&n<=max,'Invalid '+label+' bound');return n}
const limits=o=>({requests:cap(o.maxRequests,8,8,'request'),entity:cap(o.maxResponseBytes,4194304,4194304,'entity byte'),aggregate:cap(o.maxAggregateBytes,16777216,16777216,'aggregate byte'),source:cap(o.sourceTimeoutMs,90000,120000,'source deadline'),request:cap(o.requestTimeoutMs,20000,20000,'request deadline')})
const typed=Object.getPrototypeOf(Uint8Array.prototype),length=Object.getOwnPropertyDescriptor(typed,'byteLength').get,offset=Object.getOwnPropertyDescriptor(typed,'byteOffset').get,buffer=Object.getOwnPropertyDescriptor(typed,'buffer').get,set=typed.set
const bytes=(value,maximum)=>{need(types.isUint8Array(value)&&!types.isProxy(value),'Original complete entity must be bytes');const n=length.call(value);need(n<=maximum,'Original entity/aggregate byte bound exceeded');const result=new Uint8Array(n);set.call(result,value,0);return Buffer.from(result.buffer)}
const prefix=(value,maximum)=>{need(types.isUint8Array(value)&&!types.isProxy(value),'Original stream must be bytes');const n=Math.min(length.call(value),maximum),result=new Uint8Array(n);set.call(result,new Uint8Array(buffer.call(value),offset.call(value),n),0);return Buffer.from(result.buffer)}
const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{}}
const wait=(operation,signal,disposeLate)=>new Promise((resolve,reject)=>{
 let settled=false
 const finish=(fn,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{if(settled){if(disposeLate)ignore(()=>disposeLate(value));return}finish(resolve,value)},error=>finish(reject,error))
})
const headerViews=page=>{
 const source=page.headers;need(source&&typeof source==='object'&&!types.isProxy(source)&&[Object.prototype,null].includes(Object.getPrototypeOf(source)),'Original plain HTTP header view unavailable')
 const headers=Object.create(null)
 for(const key of Reflect.ownKeys(source)){const d=Object.getOwnPropertyDescriptor(source,key);need(typeof key==='string'&&key===key.toLowerCase()&&Object.hasOwn(d,'value')&&typeof d.value==='string','Original header view must be own string data');headers[key]=d.value}
 let headerEntries=null
 if(page.headerEntries!==undefined){need(Array.isArray(page.headerEntries)&&!types.isProxy(page.headerEntries),'Original HTTP header entries invalid');headerEntries=page.headerEntries.map(pair=>{need(Array.isArray(pair)&&pair.length===2&&pair.every(v=>typeof v==='string'),'Original header entry invalid');return[...pair]});const seen=new Set();for(const[k,v]of headerEntries){need(!seen.has(k)&&Object.hasOwn(headers,k)&&headers[k]===v,'Duplicate/incoherent original HTTP header entry');seen.add(k)}need(seen.size===Object.keys(headers).length,'Original HTTP header views disagree')}
 return{headers:{...headers},headerEntries,parsed:new Headers(headers)}
}

export async function readCurrentLoadsmartProgramme(options={}){
 options.signal?.throwIfAborted();const bound=limits(options);need(bound.requests===8,'Complete eight-request native programme budget unavailable');need(typeof options.readPage==='function','Original bounded raw readPage transport required')
 const checkedAt=(options.now??(()=>new Date().toISOString()))();need(typeof checkedAt==='string'&&Number.isFinite(Date.parse(checkedAt)),'Invalid observation clock')
 const started=performance.now(),controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const expire=()=>controller.abort(new DOMException('Loadsmart source deadline exceeded','TimeoutError')),timer=setTimeout(expire,bound.source)
 const check=()=>{if(performance.now()-started>=bound.source&&!controller.signal.aborted)expire();signal.throwIfAborted()}
 const audit={source:'loadsmart',archiveNativeCollectionEvidence:true,checkedAt,rawPages:[],nativePayload:null,nativeProgrammeRequests:0,currentDeclaredSourceProgramComplete:false,
  sourceScopeComplete:false,companyGlobalScopeQualified:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,publisherBrand:null,
  nativePerRoleEmployerFieldQualified:false,legalEmployerQualified:false,ownVacancyUIQualified:false,applicationVisited:false,screeningQualified:false,browserCORSExecutionQualified:false,
  otherHiringChannelsQualified:false,publisherScriptsExecuted:false,unacquiredChildrenQualified:false,publicationDate:null,firstEverPostedAt:null,closingDate:null,
  requestMetadataComparisonProfile:LOADSMART_SERVER_PUBLICATION_PROFILE,tDateBound:false,sourceTimeSemanticsQualified:false,
  requestMetadataComparisonScope:'Only finite Loadsmart server SSR/API publications: two source-ray literals bind original cf-ray; one canonical numeric params.t is opaque comparison data, with no time/freshness semantics or Date relation. No child/browser/runtime authority is established.',
  nativeCreatedAtSemantics:'Every original native createdAt retained; no original publication/age or legal inference.',
  sourceScope:'Only current corporate-declared unfiltered native Loadsmart SSR/API-published programme; own role UI/schema/application/screening, other company programmes and global totals are unqualified.',
  countSemantics:'Native array length and reconciled SSR rows are observed finite publications, never an independently reported server or company counter.'}
 let aggregate=0
 const read=async(url,phase,mime)=>{
  check();need([CORPORATE,BOARD,CLIENT,API].includes(url)&&audit.rawPages.length<bound.requests,'Unreviewed route or request reserve exceeded')
  const receipt={phase,requestedURL:url,method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',requestedAt:new Date().toISOString(),bodyComplete:false};audit.rawPages.push(receipt);audit.nativeProgrammeRequests=audit.rawPages.length
  const request=new AbortController(),requestSignal=AbortSignal.any([signal,request.signal]),requestStarted=performance.now(),deadline=setTimeout(()=>request.abort(new DOMException('Loadsmart request deadline exceeded','TimeoutError')),bound.request)
  const checkRequest=()=>{check();if(performance.now()-requestStarted>=bound.request&&!request.signal.aborted)request.abort(new DOMException('Loadsmart request deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
  try{
   const page=await wait(()=>options.readPage(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'manual',headers:{Accept:mime,'Cache-Control':'no-store',Pragma:'no-cache'},signal:requestSignal,maxBodyBytes:Math.min(bound.entity,bound.aggregate-aggregate)}),requestSignal)
   checkRequest();need(page&&page.url===url,'Original HTTP final URL/provenance changed')
   const views=headerViews(page);Object.assign(receipt,{finalURL:page.url,status:page.status,headers:views.headers,headerEntries:views.headerEntries,responseAt:new Date().toISOString()})
   const body=bytes(page.body,Math.min(bound.entity,bound.aggregate-aggregate));aggregate+=body.length;Object.assign(receipt,{bodyBase64:body.toString('base64'),bodyBytes:body.length,bodySHA256:sha(body),bodyComplete:page.bodyComplete!==false,completedAt:new Date().toISOString(),bodyRepresentation:'Original Fetch-decoded complete HTTP entity bytes; raw original header views retained separately, never raw-wire or parsed-only claims.'})
   need(receipt.bodyComplete&&body.length>0,'Original entity incomplete or empty')
   if(page.status!==200){const error=failure('Native public HTTP '+page.status);error.status=page.status;if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true});else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true});throw error}
   const[media,...parameters]=(views.parsed.get('content-type')??'').split(';')
   need(media.trim().toLowerCase()===mime,'Original response MIME changed')
   need((url===CORPORATE&&parameters.length===0)||(parameters.length===1&&/^\s*charset\s*=\s*(?:utf-8|"utf-8")\s*$/i.test(parameters[0])),'Unreviewed nonUTF8/ambiguous/absent native charset')
   receipt.securityPolicy=readLoadsmartSecurity(views.parsed,url)
   const opening=audit.rawPages.find(p=>p!==receipt&&p.requestedURL===url);if(opening)need(isDeepStrictEqual(receipt.securityPolicy,opening.securityPolicy),'Closing same-channel security policy changed')
   let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body)}catch{throw failure('Original UTF8 entity invalid')}
   checkRequest();return{text,receipt}
  }catch(error){if(error.nativeResponseEvidence){Object.assign(receipt,error.nativeResponseEvidence);aggregate+=error.nativeResponseEvidence.bodyBytes??0}receipt.failure={name:error.name??'Error',message:String(error.message??error)};throw error}
  finally{clearTimeout(deadline);request.abort()}
 }
 try{
  const corporate=await read(CORPORATE,'opening-corporate','text/html');audit.corporate=readLoadsmartCorporate(corporate.text);audit.publisherBrand=audit.corporate.publisherBrand;check()
  const board=await read(BOARD,'opening-board','text/html');audit.board=readLoadsmartBoard(board.text,board.receipt);board.receipt.requestMetadataCertificate=audit.board.requestMetadataCertificate;check()
  const client=await read(CLIENT,'opening-listing-script','application/javascript');audit.listingScript=readLoadsmartClient(client.text);check()
  const api=await read(API,'opening-native-api','application/json');audit.nativePayload=readLoadsmartNative(api.text);reconcileLoadsmartBoard(audit.board,audit.nativePayload);check()
  audit.observedVacancyCount=audit.nativePayload.length;audit.observedRecordCount=audit.nativePayload.length;audit.nativeCountries=audit.nativePayload.map(r=>({id:r.id,country:r.country,location:r.categories.location,allLocations:structuredClone(r.categories.allLocations)}));audit.allOpeningReadsBeforeClosing=true
  const closeAPI=await read(API,'closing-native-api','application/json');readLoadsmartNative(closeAPI.text);need(closeAPI.receipt.bodySHA256===api.receipt.bodySHA256,'Closing complete API criteria/native models/order/membership changed');check()
  const closeClient=await read(CLIENT,'closing-listing-script','application/javascript');readLoadsmartClient(closeClient.text);need(closeClient.receipt.bodySHA256===client.receipt.bodySHA256,'Closing complete listing source changed');check()
  const closeBoard=await read(BOARD,'closing-board','text/html');audit.boardClosing=readLoadsmartBoard(closeBoard.text,closeBoard.receipt);closeBoard.receipt.requestMetadataCertificate=audit.boardClosing.requestMetadataCertificate;reconcileLoadsmartBoard(audit.boardClosing,audit.nativePayload)
  need(audit.boardClosing.comparisonFingerprint===audit.board.comparisonFingerprint,'Closing complete native board changed outside two header-bound ray literals and one opaque numeric t');check()
  const closeCorporate=await read(CORPORATE,'closing-corporate','text/html');readLoadsmartCorporate(closeCorporate.text);need(closeCorporate.receipt.bodySHA256===corporate.receipt.bodySHA256,'Closing whole corporate authority/consumer changed');check()
  Object.assign(audit,{currentDeclaredSourceProgramComplete:true,allNativeModelsRechecked:true,nativeIndiaCount:0,aggregateBytes:aggregate,requestCountScope:'Exactly this eight-GET native programme. Earlier primary/discovery reads are separate/unmeasured.',
   openingClosingEquality:audit.rawPages.slice(0,4).map(open=>{const close=audit.rawPages.find(r=>r.requestedURL===open.requestedURL&&r.phase.startsWith('closing'));return{URL:open.requestedURL,openingSHA256:open.bodySHA256,closingSHA256:close.bodySHA256,wholeRawEntityEqual:open.bodySHA256===close.bodySHA256,completeEntityComparisonEqual:true,comparisonScope:open.requestedURL===BOARD?'Exactly two header-bound ray literals plus one opaque canonical numeric params.t span; every other raw byte equal. Opaque t has no Date relation, job/source time or freshness authority.':'Whole original entity bytes, no comparison exception.'}})})
  if(options.onAudit)await wait(()=>options.onAudit(structuredClone(audit)),signal);check()
  const jobs=[];attachSourceObservationEvidence(jobs,{source:'loadsmart',recordKind:'vacancy-rows',observedRecordCount:audit.nativePayload.length,observedVacancyCount:audit.nativePayload.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:CORPORATE,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,pagesFetched:audit.rawPages.length,reportedTotal:null,indiaFacetCount:0,verifiedAt:checkedAt,reason:'Complete current corporate-declared unfiltered Loadsmart native SSR/API publication programme; every raw card/account/criteria/work-country reconciled, exact reviewed listing consumer and full reversed closings. Observed publications only, no server/company counter. Global scope, legal identity, browser execution/ancillary children, own role UI/schema/application/screening and lifecycle cleanup remain unqualified.'})
 }catch(error){audit.currentDeclaredSourceProgramComplete=false;audit.aggregateBytes=aggregate;try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}throw error}
 finally{clearTimeout(timer);controller.abort()}
}

export async function runCurrentLoadsmartProgramme(options={}){
 options.signal?.throwIfAborted();const bound=limits(options),interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'Invalid request pacing')
 if(!options.fetchImpl&&(typeof options.fetchPage==='function'||typeof options.fetchJson==='function'))throw failure('Original raw fetchImpl required, not parsed-only transport')
 const fetchImpl=options.fetchImpl??globalThis.fetch;need(typeof fetchImpl==='function','Original raw HTTP transport unavailable');let next=0
 return readCurrentLoadsmartProgramme({...options,readPage:async(url,init)=>{
  if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal});init.signal.throwIfAborted();next=performance.now()+interval
  let response,reader,canceled=false,size=0,discardedOverflowBytes=0,base={},complete=false;const chunks=[]
  const release=()=>{try{reader?.releaseLock()}catch{}}
  const cancel=reason=>{if(canceled)return;canceled=true;ignore(()=>reader?reader.cancel(reason):response?.body?.cancel(reason));release()}
  const aborted=()=>cancel(init.signal.reason)
  try{
   response=await wait(()=>fetchImpl(url,init),init.signal,late=>late?.body?.cancel())
   need(response?.url===url,'Original HTTP final URL/provenance changed')
   const headers=Object.fromEntries(response.headers),headerEntries=[...response.headers]
   base={url:response.url,status:response.status,headers,headerEntries,bodyComplete:false}
   const advertised=response.headers.get('content-length');need(advertised===null||/^\d+$/.test(advertised),'Invalid advertised entity length')
   need(advertised===null||Number(advertised)<=init.maxBodyBytes,'Original entity/aggregate advertised byte bound exceeded')
   init.signal.addEventListener('abort',aborted,{once:true});init.signal.throwIfAborted()
   reader=response.body?.getReader();need(reader,'Original response stream unavailable')
   while(true){const part=await wait(()=>reader.read(),init.signal);init.signal.throwIfAborted();if(part.done){complete=true;break}
    need(types.isUint8Array(part.value),'Original stream chunk must be bytes');const partLength=length.call(part.value),remaining=init.maxBodyBytes-size
    if(partLength>remaining){if(remaining>0){chunks.push(prefix(part.value,remaining));size+=remaining}discardedOverflowBytes+=partLength-Math.max(remaining,0);throw failure('Original entity/aggregate streamed byte bound exceeded')}
    const chunk=bytes(part.value,remaining);chunks.push(chunk);size+=chunk.length
   }
   return{...base,body:Buffer.concat(chunks,size),bodyComplete:true}
  }catch(error){if(response){const body=Buffer.concat(chunks,size);error.nativeResponseEvidence={...base,finalURL:base.url??url,bodyComplete:false,bodyBytes:body.length,bodyBase64:body.toString('base64'),bodySHA256:sha(body),discardedOverflowBytes,consumedBodyBytes:body.length+discardedOverflowBytes,completedAt:new Date().toISOString()}}throw error}
  finally{init.signal.removeEventListener('abort',aborted);if(!complete)cancel();release()}
 }})
}
