import {setTimeout as delay} from 'node:timers/promises'
import {types} from 'node:util'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE,JOBS,API,sha,failure,readCloudinaryHTML,readCloudinaryNative,readCloudinarySecurity} from './currentProgrammeData.js'
const need=(value,message)=>{if(!value)throw failure(message)}
const cap=(value,fallback,max,name)=>{const n=value??fallback;if(!Number.isSafeInteger(n)||n<1||n>max)throw RangeError('Invalid Cloudinary '+name+' bound');return n}
const limits=o=>({maxRequests:cap(o.maxRequests,10,10,'request'),maxResponseBytes:cap(o.maxResponseBytes,4*1024*1024,4*1024*1024,'response byte'),maxAggregateBytes:cap(o.maxAggregateBytes,16*1024*1024,16*1024*1024,'aggregate byte'),sourceTimeoutMs:cap(o.sourceTimeoutMs,90000,120000,'source deadline')})
const headersOf=page=>{try{return new Headers(page.headers)}catch{throw failure('Original response headers missing/invalid')}}
const abortable=(operation,signal)=>new Promise((resolve,reject)=>{let settled=false;const done=()=>signal.removeEventListener('abort',abort),abort=()=>{if(!settled){settled=true;done();reject(signal.reason)}};signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}Promise.resolve().then(operation).then(value=>{if(!settled){settled=true;done();resolve(value)}},error=>{if(!settled){settled=true;done();reject(error)}})})

export async function readCurrentCloudinaryProgramme(options={}){
 options.signal?.throwIfAborted();const bounds=limits(options);need(bounds.maxRequests>=6,'Complete six-request programme budget unavailable');need(typeof options.readPage==='function','Original raw HTTP reader required')
 const now=(options.now??(()=>new Date().toISOString()))();need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid observation date')
 const started=performance.now(),controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const expire=()=>controller.abort(new DOMException('Cloudinary programme source deadline exceeded','TimeoutError')),timer=setTimeout(expire,bounds.sourceTimeoutMs)
 const check=()=>{if(performance.now()-started>=bounds.sourceTimeoutMs&&!controller.signal.aborted)expire();signal.throwIfAborted()}
 const audit={source:'cloudinary',checkedAt:now,rawPages:[],nativePayload:null,currentDeclaredSourceProgramComplete:false,sourceScopeComplete:false,companyGlobalScopeQualified:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,publisherBrand:null,nativePerRoleEmployerFieldQualified:false,legalEmployerQualified:false,ownRoleUIQualified:false,schemaQualified:false,applicationVisited:false,screeningQualified:false,browserCORSExecutionQualified:false,browserCORSObservation:'Actual no-Origin API responses have no CORS fields; browser fetch execution unqualified.',publicationDate:null,firstEverPostedAt:null,closingDate:null,remoteStatus:null,nativeCreatedAtSemantics:'Raw source creation timestamp; no publication-age projection.',sourceScope:'Current corporate-declared Cloudinary flat API-published programme only.'}
 let totalBytes=0
 const read=async(url,phase,mime)=>{
  check();need([CORPORATE,JOBS,API].includes(url)&&audit.rawPages.length<bounds.maxRequests,'Native URL/request budget unavailable')
  const receipt={phase,requestedURL:url,method:'GET',requestedAt:new Date().toISOString()};audit.rawPages.push(receipt)
  const page=await abortable(()=>options.readPage(url,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:mime,'Cache-Control':'no-store',Pragma:'no-cache'},signal}),signal);check()
  need(page&&page.url===url,'Original final URL identity/provenance changed');const headers=headersOf(page);Object.assign(receipt,{status:page.status,finalURL:page.url,headers:Object.fromEntries(headers),completedAt:new Date().toISOString()})
  let body;if(types.isUint8Array(page.body)){body=Buffer.from(page.body);need(body.length<=bounds.maxResponseBytes,'Original response byte bound exceeded');totalBytes+=body.length;need(totalBytes<=bounds.maxAggregateBytes,'Native aggregate byte bound exceeded');Object.assign(receipt,{bodyBytes:body.length,bodySHA256:sha(body),bodyBase64:body.toString('base64'),bodyRepresentation:'Complete original decoded HTTP entity bytes; no parsed-only transport.'})}
  if(page.status!==200){const error=failure('Native public HTTP '+page.status);error.status=page.status;if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true});else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true});throw error}
  const [mediaType,...parameters]=(headers.get('content-type')??'').split(';')
  need(mediaType.trim().toLowerCase()===mime,'Original response MIME changed')
  need(parameters.length===1&&/^\s*charset\s*=\s*(?:utf-8|"utf-8")\s*$/i.test(parameters[0]),'Original response charset/encoding declaration is nonUTF8, missing or ambiguous')
  for(const name of['location','refresh','content-location','www-authenticate','proxy-authenticate','content-disposition'])need(!headers.has(name),'Security/redirect response header unreviewed: '+name)
  need(headers.get('cf-mitigated')!=='challenge','Security challenge response header')
  need(body,'Original raw body bytes unavailable');receipt.securityPolicy=readCloudinarySecurity(headers,url)
  const opening=audit.rawPages.find(row=>row!==receipt&&row.requestedURL===url);if(opening)need(JSON.stringify(receipt.securityPolicy)===JSON.stringify(opening.securityPolicy),'Closing same-channel response security policy changed')
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body)}catch{throw failure('Original native UTF-8 bytes invalid')}
  return{text,body,receipt}
 }
 try{
  const corporate=await read(CORPORATE,'opening-corporate','text/html'),publisher=readCloudinaryHTML(corporate.text,'corporate');Object.assign(audit,{publisherBrand:publisher.publisherBrand,publisherWebSite:publisher.publisherWebSite,openingCorporateProof:publisher})
  const jobsPage=await read(JOBS,'opening-jobs','text/html'),consumer=readCloudinaryHTML(jobsPage.text,'jobs');audit.openingConsumerProof=consumer
  const opening=await read(API,'opening-native','application/json');audit.nativePayload=readCloudinaryNative(opening.text);Object.assign(audit,{nativeOpeningRawText:opening.text,nativeOpeningRawBodyBase64:opening.receipt.bodyBase64,nativeOpeningBodySHA256:opening.receipt.bodySHA256,nativeCountries:audit.nativePayload.map(r=>({id:r.id,country:r.country,location:r.categories.location,allLocations:structuredClone(r.categories.allLocations)})),observedRecordCount:audit.nativePayload.length,observedVacancyCount:audit.nativePayload.length})
  const closing=await read(API,'closing-native','application/json');readCloudinaryNative(closing.text);need(closing.receipt.bodySHA256===opening.receipt.bodySHA256,'Closing complete native models/criteria/membership changed');audit.nativeClosingRawText=closing.text;audit.nativeClosingBodySHA256=closing.receipt.bodySHA256
  const closingJobs=await read(JOBS,'closing-jobs','text/html'),closingConsumer=readCloudinaryHTML(closingJobs.text,'jobs');need(closingConsumer.outsideSHA256===consumer.outsideSHA256,'Closing current consumer changed');audit.closingConsumerProof=closingConsumer
  const closingCorporate=await read(CORPORATE,'closing-corporate','text/html'),closingPublisher=readCloudinaryHTML(closingCorporate.text,'corporate');need(closingPublisher.outsideSHA256===publisher.outsideSHA256,'Closing corporate publisher/handoff changed');audit.closingCorporateProof=closingPublisher
  check();Object.assign(audit,{currentDeclaredSourceProgramComplete:true,allOpeningReadsBeforeClosing:true,allNativeModelsRechecked:true,wholeCorporateAndJobsOutsideExactCFCarrierRechecked:true,originalCriteriaAndAllLocationModelsRetained:true,nativeIndiaCount:0,nativeProgrammeRequests:audit.rawPages.length,aggregateBytes:totalBytes,CFScriptExecuted:false,ownRoleCompletenessClaim:false,screeningCompletenessClaim:false})
  if(options.onAudit)await abortable(()=>options.onAudit(structuredClone(audit)),signal);check()
  const result=[];attachSourceObservationEvidence(result,{source:'cloudinary',recordKind:'vacancy-rows',observedRecordCount:audit.nativePayload.length,observedVacancyCount:audit.nativePayload.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});Object.defineProperty(result,'nativeCollectionEvidence',{value:audit,configurable:true})
  return attachInventoryEvidence(result,{status:audit.nativePayload.length?'complete-inventory':'verified-empty',surface:JOBS,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,pagesFetched:audit.rawPages.length,reportedTotal:audit.nativePayload.length,indiaFacetCount:0,verifiedAt:now,reason:'Complete current corporate-declared Cloudinary unfiltered flat API-published programme and all native foreign work-country/location/content models; exact current consumer and all opening/closing authority/models. Publisher/account brand only; per-role employer field/legal entity, own UI/schema/application/screening/company-global scope and cleanup remain unqualified.'})
 }catch(error){audit.currentDeclaredSourceProgramComplete=false;try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}throw error}
 finally{clearTimeout(timer);controller.abort()}
}

export async function runCurrentCloudinaryProgramme(options={}){
 options.signal?.throwIfAborted();const bounds=limits(options),timeoutMs=cap(options.requestTimeoutMs,30000,30000,'request deadline'),interval=options.requestIntervalMs??500
 need(Number.isSafeInteger(interval)&&interval>=0&&interval<=5000,'Invalid request pacing bound')
 if(!options.fetchImpl&&(typeof options.fetchJson==='function'||typeof options.fetchPage==='function'))throw TypeError('Cloudinary requires original raw HTTP fetchImpl transport, not parsed-only injected readers')
 const fetchImpl=options.fetchImpl??globalThis.fetch;need(typeof fetchImpl==='function','Original raw fetch transport required');let next=0,aggregate=0
 return readCurrentCloudinaryProgramme({...options,readPage:async(url,init)=>{
  if(next>performance.now())await delay(next-performance.now(),undefined,{signal:init.signal});init.signal.throwIfAborted();next=performance.now()+interval
  const fetcher=async(target,request)=>{
   const response=await fetchImpl(target,{...request,credentials:'omit',cache:'no-store',headers:{...request.headers,'Cache-Control':'no-store',Pragma:'no-cache'}})
   need(response?.url===target,'Original raw HTTP response URL provenance changed');const available=Math.min(bounds.maxResponseBytes,bounds.maxAggregateBytes-aggregate);need(available>0,'Aggregate byte bound exceeded')
   const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
   if(Number(response.headers?.get?.('content-length'))>available){ignore(()=>response.body?.cancel());throw failure('Original response/aggregate byte bound exceeded')}
   let reader,size=0,canceled=false
   const release=()=>{try{reader?.releaseLock()}catch{}}
   const cancel=reason=>{if(canceled)return;canceled=true;ignore(()=>reader?reader.cancel(reason):response.body?.cancel(reason));release()}
   const stream=response.body===null?null:new ReadableStream({async pull(controller){try{reader??=response.body.getReader();const part=await reader.read();if(canceled)return;if(part.done){release();controller.close();return}need(types.isUint8Array(part.value),'Original body chunk must be bytes');size+=part.value.byteLength;if(size>available)throw failure('Original response/aggregate byte bound exceeded');controller.enqueue(part.value)}catch(error){cancel(error);controller.error(error)}},cancel})
   const limited=new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});Object.defineProperty(limited,'url',{value:response.url});return limited
  }
  const page=await boundedDeclaredPublicGet(url,{fetchImpl:fetcher,signal:init.signal,timeoutMs,overflowError:failure('Original response byte bound exceeded')});const body=Buffer.from(page.bodyBase64,'base64');aggregate+=body.length;need(aggregate<=bounds.maxAggregateBytes,'Aggregate byte bound exceeded');return{url:page.url,status:page.status,headers:page.headers,body}
 }})
}
