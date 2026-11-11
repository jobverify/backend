import {setTimeout as delay} from 'node:timers/promises'
import {types} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {parseEightfoldJson as parseNativeJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {CORPORATE,CLIENT,API,ASSETS,ASSET_HASHES,sha,failure,need,htmlEncoding,
 corporateProgramme,classicClient,nativeBoard,nativeAPI} from './currentProgrammeData.js'

const HTML_BYTES=4*1024*1024,ASSET_BYTES=6*1024*1024,TOTAL_BYTES=24*1024*1024
const typedArray=Object.getPrototypeOf(Uint8Array.prototype)
const byteLength=Object.getOwnPropertyDescriptor(typedArray,'byteLength').get
const byteOffset=Object.getOwnPropertyDescriptor(typedArray,'byteOffset').get
const arrayBuffer=Object.getOwnPropertyDescriptor(typedArray,'buffer').get
const SECURITY=['content-security-policy','content-security-policy-report-only','x-content-type-options',
 'cross-origin-embedder-policy','cross-origin-opener-policy','cross-origin-resource-policy','x-frame-options','permissions-policy','document-policy']
const NONE=[null,null,null,null,null,null,null,null,null]
const BOARD_SECURITY=['57755a728c840458183872d6bc8af36915c881cef4266d2ba1932fe4056b9b54',null,
 'f495210addd4c5882999afa5e924569823b6f504f3c95c760b36a0e1ba9e633e',null,null,null,null,null,null]
const SECURITY_PROFILE={corporate:[null,null,null,null,null,null,'9ab20121fd60b35996b52a26b83f7b6deb287d4ffb1402386011783016ea1bac',null,null],
 client:NONE,page1:BOARD_SECURITY,page2:BOARD_SECURITY,api:NONE,module:NONE,entry:NONE,vendor:NONE}
const header=(page,name)=>page.headers?.get?.(name)??page.headers?.[name]??null
const unreviewedResponseHeader=name=>['refresh','location','content-location','content-disposition','x-amzn-waf-action','x-sucuri-block'].includes(name)
 ||/(?:^|-)(?:authenticate|authentication-info|captcha|challenge|mitigated)(?:-|$)/i.test(name)||/^cf-chl(?:-|$)/i.test(name)
const media=(value,expected)=>{
 need(typeof value==='string','Original native MIME unavailable')
 const [kind,...parameters]=value.split(';').map(part=>part.trim())
 need(kind.toLowerCase()===expected,'Unexpected original native MIME')
 need(parameters.length<=1&&(!parameters.length||/^charset\s*=\s*(?:"utf-8"|utf-8)$/i.test(parameters[0])),
  'Unreviewed/ambiguous native MIME charset/decoding parameter')
}
const limits=options=>{
 const source=options.sourceTimeoutMs??180000,request=options.requestTimeoutMs??20000,interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(source)&&source>0&&source<=180000&&Number.isSafeInteger(request)&&request>0&&request<=20000
  &&Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'Invalid native source/request deadline or pacing')
 need(options.maxRequests===undefined||Number.isSafeInteger(options.maxRequests)&&options.maxRequests>=16,'Sixteen opening/closing native reads unavailable')
 need(options.maxPages===undefined||Number.isSafeInteger(options.maxPages)&&options.maxPages>=2,'Both native listing pages unavailable')
 need(options.maxJobs===undefined||Number.isSafeInteger(options.maxJobs)&&options.maxJobs>0,'A caller job limit cannot qualify zero')
 return {source,request,interval}
}
const ignore=fn=>{try{Promise.resolve(fn()).catch(()=>{})}catch{/* Resource disposal must not replace the original failure. */}}
const wait=(fn,signal,disposeLate)=>new Promise((resolve,reject)=>{
 let settled=false
 const detach=()=>signal.removeEventListener('abort',aborted)
 const aborted=()=>{if(!settled){settled=true;detach();reject(signal.reason)}}
 signal.addEventListener('abort',aborted,{once:true});if(signal.aborted){aborted();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return fn()}).then(value=>{
  if(settled||signal.aborted){if(disposeLate)ignore(()=>disposeLate(value));aborted();return}
  settled=true;detach();resolve(value)
 },error=>{if(!settled){settled=true;detach();reject(signal.aborted?signal.reason:error)}})
})

// Explicit zero-only reader for the reviewed two-page API-published programme.
// Unknown or India scope holds; it never suppresses a separately valid positive.
export async function readCurrentHousecallProgramme(options={}){
 options.signal?.throwIfAborted()
 const bound=limits(options),now=(options.now??(()=>new Date().toISOString()))()
 need(typeof options.readPage==='function','Original bounded native reader unavailable')
 need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid native observation clock')
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const started=performance.now(),expired=()=>new DOMException('Housecall source deadline exceeded','TimeoutError')
 const timer=setTimeout(()=>controller.abort(expired()),bound.source)
 const check=()=>{options.signal?.throwIfAborted();if(performance.now()-started>=bound.source&&!controller.signal.aborted)controller.abort(expired());signal.throwIfAborted()}
 const rawResponses=[],audit={source:'housecallpro',checkedAt:now,rawResponses,requests:0,nativeProgrammeRequests:0,
  sourceScopeComplete:false,companyGlobalScopeQualified:false,lifecycleCleanupAllowed:false,
  companyGlobalTotal:null,companyIndiaTotal:null,currentPublishedProgrammeComplete:false,programmeQualification:{status:'held'},
  ownRolePagesAcquired:false,ownRoleSchemaAcquired:false,applicationScreeningAcquired:false,applicationVisited:false,
  legalRegistryIdentityVerified:false,nativeJavaScriptExecuted:false,stylesheetBytesAcquired:false,
  scope:'current-corporate-declared-Housecall-Greenhouse-API-published-programme-only',
  completenessLimit:'Complete original API-published fields and both unfiltered SSR page identities/countries only. Own-role UI/schema, lazy application/screening, registry legal identity and all other company hiring programmes remain unqualified.'}
 const allowed={corporate:CORPORATE,client:CLIENT,api:API,...ASSETS},opened=[]
 let total=0,stage='opening-corporate'
 const read=async(kind,url)=>{
  check();need(allowed[kind]===url&&rawResponses.length<16,'Unreviewed public URL or request reserve exceeded')
  const cap=Object.hasOwn(ASSETS,kind)?ASSET_BYTES:HTML_BYTES
  const receipt={kind,stage,requestedURL:url,method:'GET',requestedAt:new Date().toISOString()};rawResponses.push(receipt)
  const request=new AbortController(),requestSignal=AbortSignal.any([signal,request.signal]),requestStarted=performance.now()
  const checkRequest=()=>{check();if(performance.now()-requestStarted>=bound.request&&!request.signal.aborted)request.abort(new DOMException('Housecall request deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
  const deadline=setTimeout(()=>request.abort(new DOMException('Housecall request deadline exceeded','TimeoutError')),bound.request)
  try{
   const page=await wait(()=>options.readPage(url,{method:'GET',cache:'no-store',redirect:'manual',credentials:'omit',
    signal:requestSignal,maxBodyBytes:Math.min(cap,TOTAL_BYTES-total)}),requestSignal)
   checkRequest();need(page&&typeof page==='object','Original native response unavailable')
   Object.assign(receipt,{url:page.url,status:page.status,headers:page.headers&&Object.fromEntries(new Headers(page.headers)),completedAt:new Date().toISOString()})
   need(typeof page.bodyBase64==='string','Missing original raw native response body')
   need(page.bodyBase64.length<=Math.ceil(cap/3)*4,'Original native entity byte bound exceeded')
   const bytes=Buffer.from(page.bodyBase64,'base64');total+=bytes.length
   need(bytes.toString('base64')===page.bodyBase64,'Invalid original raw native body encoding')
   Object.assign(receipt,{bodyBase64:page.bodyBase64,bodyBytes:bytes.length,bodySHA256:sha(bytes)})
   need(bytes.length>0&&bytes.length<=cap&&total<=TOTAL_BYTES,'Original native entity/aggregate byte bound exceeded')
   need(!Object.keys(receipt.headers||{}).some(unreviewedResponseHeader),'Unreviewed redirect/download/authentication/challenge response header')
   need(page.url===url,'Original public native URL identity changed')
   if(page.status!==200){
    const error=failure('Native public HTTP '+page.status);error.status=page.status
    if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})
    else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true})
    throw error
   }
   const security=SECURITY.map(name=>header(receipt,name)===null?null:sha(header(receipt,name)))
   need(security.every((value,index)=>value===SECURITY_PROFILE[kind][index]),'Unreviewed native enforced/report-only CSP or embedding security-header profile')
   receipt.securityProfile={headerSHA256:Object.fromEntries(SECURITY.map((name,index)=>[name,security[index]])),
    enforcedCSPPresent:header(receipt,'content-security-policy')!==null,reportOnlyCSPPresent:header(receipt,'content-security-policy-report-only')!==null}
   media(header(receipt,'content-type'),Object.hasOwn(ASSETS,kind)?'application/javascript':kind==='api'?'application/json':'text/html')
   let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw failure('Original native UTF-8 invalid')}
   if(['corporate','page1','page2'].includes(kind))htmlEncoding(text)
   checkRequest();return {kind,url,text,receipt}
  }finally{clearTimeout(deadline);request.abort()}
 }
 const open=async(kind,url)=>{stage='opening-'+kind;const page=await read(kind,url);opened.push(page);return page}
 try{
  const corporate=await open('corporate',CORPORATE);audit.publisher=corporateProgramme(corporate.text);check()
  const client=await open('client',CLIENT);audit.client=classicClient(client.text);check()
  Object.assign(allowed,{page1:audit.client.frameURL,page2:audit.client.secondPageURL})
  const first=await open('page1',allowed.page1),firstBoard=nativeBoard(first.text,allowed.page1,1,now);check()
  const second=await open('page2',allowed.page2),secondBoard=nativeBoard(second.text,allowed.page2,2,now);check()
  audit.nativePages=[firstBoard,secondBoard]
  const apiPage=await open('api',API)
  try{audit.nativePayload=parseNativeJSON(apiPage.text);audit.nativeAPI=audit.nativePayload}
  catch(error){throw failure('Invalid full original native API JSON: '+error.message)}
  Object.assign(audit,{observedRecordCount:audit.nativePayload?.jobs?.length??null,observedVacancyCount:audit.nativePayload?.jobs?.length??null})
  const api=nativeAPI(apiPage.text,audit.nativePages,now);check()
  Object.assign(audit,{nativeReportedTotal:api.value.meta.total,nativeEmployer:'Housecall Pro',nativeEmployerRegistryVerified:false,
   fullOriginalAPIPublishedFieldsRetained:true,SSRAndAPIRevisionsInterchangeable:false,
   originalNativeOfficeHierarchy:api.officeHierarchy,nativeOfficeGroupingSemantics:api.groupingSemantics,
   nativeDepartmentHierarchyBinding:api.departmentHierarchyBinding})
  for(const[kind,url]of Object.entries(ASSETS)){
   const page=await open(kind,url);need(page.receipt.bodySHA256===ASSET_HASHES[kind],'Unreviewed current native '+kind+' renderer/dependency bytes');check()
  }
  audit.allOpeningReadsComplete=true;audit.nativePageClosings=[]
  for(const opening of [...opened].reverse()){
   stage='closing-'+opening.kind
   const closing=await read(opening.kind,opening.url)
   need([...SECURITY,'content-type'].every(name=>header(opening.receipt,name)===header(closing.receipt,name)),'Closing native same-channel security/charset changed')
   const rawEqual=opening.receipt.bodySHA256===closing.receipt.bodySHA256
   if(opening.kind==='corporate'){
    const publisher=corporateProgramme(closing.text)
    need(publisher.canonicalSHA256===audit.publisher.canonicalSHA256,'Closing corporate recruitment authority/programme changed')
    audit.corporateClosing={rawBodiesEqual:rawEqual,reviewedRepresentationEqual:true,openingRawSHA256:opening.receipt.bodySHA256,
     closingRawSHA256:closing.receipt.bodySHA256,comparisonOnlyCanonicalSHA256:publisher.canonicalSHA256,originalClosingFragments:publisher.fragments}
   }else if(['page1','page2'].includes(opening.kind)){
    const page=opening.kind==='page1'?1:2,initial=audit.nativePages[page-1],final=nativeBoard(closing.text,opening.url,page,now)
    need(final.loaderSHA256===initial.loaderSHA256,'Closing whole original native loader/model changed')
    need(final.comparisonCanonicalSHA256===initial.comparisonCanonicalSHA256,'Closing native criteria/identity bytes changed outside two exact presentation labels')
    audit.nativePageClosings.push({page,rawBodiesEqual:rawEqual,criteriaAndIdentityUnchanged:true,
     openingRawSHA256:opening.receipt.bodySHA256,closingRawSHA256:closing.receipt.bodySHA256,
     originalLoaderSHA256:initial.loaderSHA256,comparisonOnlySHA256:initial.comparisonCanonicalSHA256,
     openingHeadTitle:initial.originalHeadTitle,closingHeadTitle:final.originalHeadTitle,
     openingBadges:initial.cards.filter(c=>c.newBadgeLabel).map(c=>({id:c.id,label:c.newBadgeLabel})),
     closingBadges:final.cards.filter(c=>c.newBadgeLabel).map(c=>({id:c.id,label:c.newBadgeLabel}))})
   }else{
    need(rawEqual,'Closing whole original '+opening.kind+' bytes changed')
    if(opening.kind==='api')audit.wholeNativeAPIClosingUnchanged=true
    if(opening.kind==='client')audit.wholeClientAndTokenClosingUnchanged=true
   }
   check()
  }
  need(rawResponses.length===16&&audit.nativePageClosings.length===2,'Complete original closing reserve unavailable')
  Object.assign(audit,{requests:16,nativeProgrammeRequests:16,totalDecodedBytes:total,currentPublishedProgrammeComplete:true,nativeIndiaCount:0,
   currentCorporateAuthorityRechecked:true,currentRendererRechecked:true,allOpeningReadsBeforeAllClosingReads:true,
   programmeQualification:{status:'qualified-zero',kind:'API-published-finite-programme',reportedTotal:api.value.meta.total,indiaCount:0}})
  check();if(options.onAudit)await wait(()=>options.onAudit(structuredClone(audit)),signal);check()
  const jobs=[]
  attachSourceObservationEvidence(jobs,{source:'housecallpro',recordKind:'vacancy-rows',observedRecordCount:api.value.jobs.length,
   observedVacancyCount:api.value.jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:allowed.page1,firstParty:true,listingComplete:true,
   lifecycleCleanupAllowed:false,pagesFetched:16,reportedTotal:api.value.meta.total,indiaFacetCount:0,verifiedAt:now,
   reason:'Complete current corporate-declared Housecall API-published finite programme: both unfiltered native SSR pages reconcile every full original API record and explicit foreign country; client/token, API, renderer and criteria/identity close unchanged under two exact reviewed presentation labels. Native employer Housecall Pro remains intact. Own-role UI/schema, applications/screening, legal registry identity, company-global inventory and cleanup remain unqualified.'})
 }catch(original){
  let error=original
  if(!error?.softFailure&&!['AbortError','TimeoutError'].includes(error?.name))error=failure('Unqualified native response: '+String(error?.message||error))
  Object.assign(audit,{requests:rawResponses.length,nativeProgrammeRequests:rawResponses.length,totalDecodedBytes:total,currentPublishedProgrammeComplete:false,
   programmeQualification:{status:'held',stage,code:error.code||error.name||'ERROR',message:String(error.message||error).slice(0,500)}})
  if(error&&typeof error==='object'){
   if(!Object.hasOwn(error,'softFailure'))Object.assign(error,{softFailure:true,upstreamOutage:false,abortRetries:true,failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
   Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})
  }
  throw error
 }finally{clearTimeout(timer);controller.abort()}
}

export async function runCurrentHousecallProgramme(options={}){
 options.signal?.throwIfAborted();const bound=limits(options)
 need(typeof options.fetchImpl==='function'||typeof options.fetchPage==='function'||!options.fetchJson,'Parsed-only transport cannot prove original native responses')
 let next=0;const fetcher=options.fetchImpl??globalThis.fetch
 return readCurrentHousecallProgramme({...options,readPage:async(url,init)=>{
  if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal})
  init.signal.throwIfAborted();next=performance.now()+bound.interval
  if(!options.fetchImpl&&options.fetchPage){
   const page=await wait(()=>options.fetchPage(url,init),init.signal)
   need(page&&typeof page.bodyBase64==='string','Injected response must retain original raw bytes');return page
  }
  const asset=Object.values(ASSETS).includes(url)
  const response=await wait(()=>fetcher(url,{method:'GET',cache:'no-store',redirect:'manual',credentials:'omit',signal:init.signal,
   headers:{Accept:asset?'application/javascript':url===API?'application/json':'text/html'}}),init.signal,value=>value?.body?.cancel())
  let reader,done=false
  try{
   const chunks=[];let size=0
   if(response.body!==null){
    reader=response.body.getReader()
    for(;;){
     const chunk=await wait(()=>reader.read(),init.signal)
     if(chunk.done){done=true;break}
     need(types.isUint8Array(chunk.value),'Original native chunk is not a Uint8Array')
     const length=byteLength.call(chunk.value);need(length<=init.maxBodyBytes-size,'Streaming native response byte bound exceeded')
     size+=length;chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(chunk.value),byteOffset.call(chunk.value),length)))
    }
   }
   init.signal.throwIfAborted()
   return {url:response.url,status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:Buffer.concat(chunks,size).toString('base64')}
  }finally{
   if(reader&&!done)ignore(()=>reader.cancel(init.signal.reason));if(reader)ignore(()=>reader.releaseLock())
  }
 }})
}
