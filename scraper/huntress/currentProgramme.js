import {setTimeout as delay} from 'node:timers/promises'
import {types} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE,BOARD,API,sha,failure,need,corporateProgramme,nativeBoard,nativeAPI} from './currentProgrammeData.js'
import {parseEightfoldJson as parseNativeJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'

const ENTITY_BYTES=4*1024*1024,TOTAL_BYTES=12*1024*1024
const typedArray=Object.getPrototypeOf(Uint8Array.prototype)
const byteLength=Object.getOwnPropertyDescriptor(typedArray,'byteLength').get
const byteOffset=Object.getOwnPropertyDescriptor(typedArray,'byteOffset').get
const arrayBuffer=Object.getOwnPropertyDescriptor(typedArray,'buffer').get
const SECURITY=['content-security-policy','content-security-policy-report-only','x-content-type-options',
 'cross-origin-embedder-policy','cross-origin-opener-policy','cross-origin-resource-policy']
const SECURITY_PROFILE={
 [CORPORATE]:['6e0ab9265ebc40ec8f2d29247d7d4396b7e3a352fab7f6b29c3e3ce5581ebb05',null,'f495210addd4c5882999afa5e924569823b6f504f3c95c760b36a0e1ba9e633e',null,null,null],
 [BOARD]:['57755a728c840458183872d6bc8af36915c881cef4266d2ba1932fe4056b9b54',null,'f495210addd4c5882999afa5e924569823b6f504f3c95c760b36a0e1ba9e633e',null,null,null],
 [API]:[null,null,null,null,null,null],
}
const header=(page,name)=>page.headers?.get?.(name)??page.headers?.[name]??null
const qualifyMediaType=(value,expected)=>{
 need(typeof value==='string','Original native MIME unavailable')
 const [media,...parameters]=value.split(';').map(part=>part.trim())
 need(media.toLowerCase()===expected,'Unexpected original native MIME')
 need(parameters.length<=1&&(!parameters.length||/^charset\s*=\s*(?:"utf-8"|utf-8)$/i.test(parameters[0])),
  'Unreviewed/ambiguous native MIME charset or decoding parameter')
}
const unreviewedResponseHeader=name=>['refresh','location','content-location','content-disposition','x-amzn-waf-action','x-sucuri-block'].includes(name)
 ||/(?:^|-)(?:authenticate|authentication-info|captcha|challenge|mitigated)(?:-|$)/i.test(name)||/^cf-chl(?:-|$)/i.test(name)
const limits=options=>{
 const source=options.sourceTimeoutMs??120000,request=options.requestTimeoutMs??20000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(source)&&source>0&&source<=120000&&Number.isSafeInteger(request)&&request>0&&request<=20000
  &&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'Invalid native deadline/pacing bound')
 need(options.maxRequests===undefined||Number.isSafeInteger(options.maxRequests)&&options.maxRequests>=6,'Six native opening/closing reads unavailable')
 need(options.maxPages===undefined||Number.isSafeInteger(options.maxPages)&&options.maxPages>=2,'Corporate/native page reserve unavailable')
 need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'A caller job limit cannot qualify native zero')
 return {source,request,interval}
}
const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{/* Disposal must not replace the original failure. */}}
const wait=(fn,signal,disposeLate)=>new Promise((resolve,reject)=>{
 let settled=false
 const detach=()=>signal.removeEventListener('abort',aborted)
 const aborted=()=>{if(!settled){settled=true;detach();reject(signal.reason)}}
 signal.addEventListener('abort',aborted,{once:true})
 if(signal.aborted){aborted();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return fn()}).then(value=>{
  if(settled||signal.aborted){if(disposeLate)ignore(()=>disposeLate(value));aborted();return}
  settled=true;detach();resolve(value)
 },error=>{if(!settled){settled=true;detach();reject(signal.aborted?signal.reason:error)}})
})

// Only API-published-programme zero is qualified here. India/unknown scope
// needs the separately preserved positive reader, never an empty promotion.
export async function readCurrentHuntressProgramme(options={}){
 options.signal?.throwIfAborted()
 const bound=limits(options),now=(options.now??(()=>new Date().toISOString()))()
 need(typeof options.readPage==='function','Original bounded native reader unavailable')
 need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid native observation clock')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const started=performance.now(),expired=()=>new DOMException('Huntress source deadline exceeded','TimeoutError')
 const timer=setTimeout(()=>controller.abort(expired()),bound.source)
 const check=()=>{
  options.signal?.throwIfAborted()
  if(performance.now()-started>=bound.source&&!controller.signal.aborted)controller.abort(expired())
  signal.throwIfAborted()
 }
 const rawResponses=[],audit={source:'huntress',checkedAt:now,rawResponses,requests:0,nativeProgrammeRequests:0,
  sourceScopeComplete:false,companyGlobalScopeQualified:false,lifecycleCleanupAllowed:false,
  companyGlobalTotal:null,companyIndiaTotal:null,currentPublishedProgrammeComplete:false,
  ownRolePagesAcquired:false,ownRoleSchemaAcquired:false,applicationScreeningAcquired:false,applicationVisited:false,
  legalRegistryIdentityVerified:false,programmeQualification:{status:'held'},
  scope:'current-corporate-declared-Huntress-Greenhouse-API-published-programme-only',
  completenessLimit:'Complete published API fields and reconciled finite SSR posting identities/countries only. Own-role UI/schema, application availability and screening, registry legal identity and all other hiring programmes remain unqualified.'}
 let total=0,stage='opening-corporate'
 const read=async url=>{
  check()
  need([CORPORATE,BOARD,API].includes(url)&&rawResponses.length<6,'Unreviewed public URL or native request reserve exceeded')
  const receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString(),stage};rawResponses.push(receipt)
  const requestStarted=performance.now(),request=new AbortController(),requestSignal=AbortSignal.any([signal,request.signal])
  const checkRequest=()=>{
   check()
   if(performance.now()-requestStarted>=bound.request&&!request.signal.aborted)request.abort(new DOMException('Huntress request deadline exceeded','TimeoutError'))
   requestSignal.throwIfAborted()
  }
  const deadline=setTimeout(()=>request.abort(new DOMException('Huntress request deadline exceeded','TimeoutError')),bound.request)
  try{
   const page=await wait(()=>options.readPage(url,{method:'GET',cache:'no-store',redirect:'manual',credentials:'omit',
    signal:requestSignal,maxBodyBytes:Math.min(ENTITY_BYTES,TOTAL_BYTES-total)}),requestSignal)
   checkRequest()
   need(page&&typeof page==='object','Original native response unavailable')
   Object.assign(receipt,{url:page.url,status:page.status,headers:page.headers&&Object.fromEntries(new Headers(page.headers)),completedAt:new Date().toISOString()})
   need(typeof page.bodyBase64==='string','Missing original raw native response body')
   need(page.bodyBase64.length<=Math.ceil(ENTITY_BYTES/3)*4,'Original native body byte bound exceeded')
   const bytes=Buffer.from(page.bodyBase64,'base64');total+=bytes.length
   need(bytes.toString('base64')===page.bodyBase64,'Invalid original raw native body encoding')
   need(bytes.length>0&&bytes.length<=ENTITY_BYTES&&total<=TOTAL_BYTES,'Original native entity/aggregate byte bound exceeded')
   Object.assign(receipt,{bodyBase64:page.bodyBase64,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
   need(!Object.keys(receipt.headers||{}).some(unreviewedResponseHeader),'Unreviewed response redirect/download/authentication/challenge header')
   need(page.url===url,'Original native response URL identity changed')
   if(page.status!==200){
    const error=failure('Native public HTTP '+page.status);error.status=page.status
    if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})
    else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true})
    throw error
   }
   const securityHashes=SECURITY.map(name=>header(receipt,name)===null?null:sha(header(receipt,name)))
   need(securityHashes.every((value,index)=>value===SECURITY_PROFILE[url][index]),'Unreviewed native enforced/report-only CSP or security-header profile')
   receipt.securityProfile={enforcedCSPPresent:header(receipt,'content-security-policy')!==null,
    reportOnlyCSPPresent:header(receipt,'content-security-policy-report-only')!==null,
    headerSHA256:Object.fromEntries(SECURITY.map((name,index)=>[name,securityHashes[index]]))}
   qualifyMediaType(header(receipt,'content-type'),url===API?'application/json':'text/html')
   let text
   try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw failure('Original native UTF-8 invalid')}
   checkRequest()
   return {text,receipt}
  }finally{clearTimeout(deadline);request.abort()}
 }
 const closeSecurity=(opening,closing)=>{
  need(SECURITY.every(name=>header(opening.receipt,name)===header(closing.receipt,name)),'Closing native security/CSP authority changed')
 }
 try{
  const corporate=await read(CORPORATE),publisher=corporateProgramme(corporate.text);audit.publisher=publisher
  check()
  stage='opening-native-board'
  const boardPage=await read(BOARD),board=nativeBoard(boardPage.text,now);audit.nativeBoard=board
  check()
  stage='opening-native-api'
  const apiPage=await read(API)
  try{audit.nativePayload=parseNativeJSON(apiPage.text);audit.nativeAPI=audit.nativePayload}
  catch(error){throw failure('Invalid full original native API JSON: '+error.message)}
  Object.assign(audit,{observedRecordCount:audit.nativePayload?.jobs?.length??null,observedVacancyCount:audit.nativePayload?.jobs?.length??null})
  const api=nativeAPI(apiPage.text,board,now)
  check()
  board.revisionDifferences=api.revisionDifferences
  Object.assign(audit,{nativeReportedTotal:api.value.meta.total,nativeEmployer:'Huntress Labs',nativeEmployerRegistryVerified:false,
   fullOriginalAPIPublishedFieldsRetained:true,SSRAndAPIRevisionsInterchangeable:false})
  stage='closing-native-api'
  const closingAPI=await read(API);closeSecurity(apiPage,closingAPI)
  need(closingAPI.receipt.bodySHA256===apiPage.receipt.bodySHA256,'Closing whole native API payload changed')
  stage='closing-native-board'
  const closingBoard=await read(BOARD);closeSecurity(boardPage,closingBoard)
  need(closingBoard.receipt.bodySHA256===boardPage.receipt.bodySHA256,'Closing whole native SSR programme changed')
  stage='closing-corporate'
  const closingCorporate=await read(CORPORATE),closingPublisher=corporateProgramme(closingCorporate.text)
  closeSecurity(corporate,closingCorporate)
  need(closingPublisher.canonicalSHA256===publisher.canonicalSHA256,'Closing corporate recruitment authority/programme changed')
  audit.corporateClosing={rawBodiesEqual:corporate.receipt.bodySHA256===closingCorporate.receipt.bodySHA256,
   reviewedRepresentationEqual:true,openingRawSHA256:corporate.receipt.bodySHA256,closingRawSHA256:closingCorporate.receipt.bodySHA256,
   openingVariant:publisher.variant,closingVariant:closingPublisher.variant,comparisonOnlyCanonicalSHA256:publisher.canonicalSHA256}
  Object.assign(audit,{requests:6,nativeProgrammeRequests:6,currentPublishedProgrammeComplete:true,nativeIndiaCount:0,
   wholeNativeAPIClosingUnchanged:true,wholeNativeBoardClosingUnchanged:true,currentCorporateAuthorityRechecked:true,
   programmeQualification:{status:'qualified-zero',kind:'API-published-finite-programme',reportedTotal:api.value.meta.total,indiaCount:0}})
  check()
  if(options.onAudit)await wait(()=>options.onAudit(structuredClone(audit)),signal)
  check()
  const jobs=[]
  attachSourceObservationEvidence(jobs,{source:'huntress',recordKind:'vacancy-rows',observedRecordCount:api.value.jobs.length,
   observedVacancyCount:api.value.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:BOARD,firstParty:true,listingComplete:true,
   lifecycleCleanupAllowed:false,pagesFetched:6,reportedTotal:api.value.meta.total,indiaFacetCount:0,verifiedAt:now,
   reason:'Complete current Huntress API-published finite programme: every full native API record has explicit foreign country scope and reconciles with unfiltered single-page native SSR identities; API/board and reviewed corporate authority close unchanged. Native employer Huntress Labs and original fields remain intact. Own-role UI, application screening, company-global scope and cleanup remain unqualified.'})
 }catch(error){
  Object.assign(audit,{requests:rawResponses.length,nativeProgrammeRequests:rawResponses.length,currentPublishedProgrammeComplete:false,
   programmeQualification:{status:'held',stage,code:error.code||error.name||'ERROR',message:String(error.message||error).slice(0,500)}})
  if(error&&typeof error==='object'){
   if(!Object.hasOwn(error,'softFailure'))Object.assign(error,{softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
   Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})
  }
  throw error
 }finally{clearTimeout(timer);controller.abort()}
}

export async function runCurrentHuntressProgramme(options={}){
 options.signal?.throwIfAborted();const bound=limits(options)
 need(typeof options.fetchImpl==='function'||typeof options.fetchPage==='function'||!options.fetchJson,'Parsed-only transport cannot prove original native responses')
 let next=0
 const fetcher=options.fetchImpl??globalThis.fetch
 return readCurrentHuntressProgramme({...options,readPage:async(url,init)=>{
  if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal})
  init.signal.throwIfAborted();next=performance.now()+bound.interval
  if(!options.fetchImpl&&options.fetchPage){
   const page=await wait(()=>options.fetchPage(url,init),init.signal)
   need(page&&typeof page.bodyBase64==='string','Injected response must retain original raw bytes')
   return page
  }
  const response=await wait(()=>fetcher(url,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal:init.signal,
   headers:{Accept:url===API?'application/json':'text/html'}}),init.signal,value=>value?.body?.cancel())
  let reader,done=false
  try{
   const chunks=[];let size=0
   if(response.body!==null){
    reader=response.body.getReader()
    for(;;){
     const chunk=await wait(()=>reader.read(),init.signal)
     if(chunk.done){done=true;break}
     need(types.isUint8Array(chunk.value),'Original native response chunk is not a Uint8Array')
     const length=byteLength.call(chunk.value)
     need(length<=init.maxBodyBytes-size,'Streaming native response byte bound exceeded')
     size+=length;chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(chunk.value),byteOffset.call(chunk.value),length)))
    }
   }
   init.signal.throwIfAborted()
   return {url:response.url,status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:Buffer.concat(chunks,size).toString('base64')}
  }finally{
   if(reader&&!done)ignore(()=>reader.cancel(init.signal.reason))
   if(reader)ignore(()=>reader.releaseLock())
  }
 }})
}
