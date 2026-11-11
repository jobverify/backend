import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {HOME,LIST,failure,roleURL,readHome,readListing,readRole} from './currentProgrammeData.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(value,message)=>{if(!value)throw failure(message)}
const limits=options=>{
 const values={maxRequests:options.maxRequests??48,maxDetails:options.maxDetails??20,maxPages:options.maxPages??8}
 for(const [key,ceiling]of [['maxRequests',48],['maxDetails',20],['maxPages',24]])
  if(!Number.isSafeInteger(values[key])||values[key]<1||values[key]>ceiling)throw RangeError('Invalid Decimal '+key+' bound')
 return values
}
const header=(page,name)=>page.headers?.get?.(name)??page.headers?.[name]??null

// Zero only for the entire current declared SSR programme. An India or
// unresolved role requires a separately qualified positive reader.
export async function readCurrentDecimalProgramme(options={}){
 const {maxRequests,maxDetails,maxPages}=limits(options),now=(options.now??(()=>new Date().toISOString()))()
 if(typeof options.readPage!=='function')throw TypeError('A bounded original HTML reader is required')
 need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid native observation date')
 need(maxPages>=2,'Corporate/listing discovery page budget unavailable')
 const allowed=new Set([HOME,LIST]),receipts=[],roles=[]
 const audit={source:'decimalai',checkedAt:now,receipts,roles,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyGlobalScopeQualified:false,companyGlobalTotal:null,companyIndiaTotal:null,
  publisherLegalNameRegistryVerified:false,applicationVisited:false,screeningCriteriaAcquired:false,currentDeclaredSourceProgramComplete:false}
 let bytes=0
 const read=async url=>{
  options.signal?.throwIfAborted()
  need(allowed.has(url)&&receipts.length<maxRequests,'Native public URL/request budget reached')
  const receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString()};receipts.push(receipt)
  const page=await options.readPage(url,{cache:'no-store'})
  options.signal?.throwIfAborted()
  need(page?.url===url,'Original native response URL identity changed')
  Object.assign(receipt,{status:page.status,completedAt:new Date().toISOString()})
  if(page.status!==200){
   const error=failure('Native public HTTP '+page.status);error.status=page.status
   if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})
   else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true})
   throw error
  }
  need(typeof page.html==='string'&&Buffer.byteLength(page.html)<=4e6,'Missing or oversized original native HTML')
  need(/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(header(page,'content-type')||''),'Unexpected original HTML MIME')
  bytes+=Buffer.byteLength(page.html);need(bytes<=24e6,'Native aggregate HTML byte budget reached')
  Object.assign(receipt,{bodyBytes:Buffer.byteLength(page.html),bodySHA256:sha(page.html)})
  return {html:page.html,hash:receipt.bodySHA256}
 }
 try{
  const home=await read(HOME),publisher=readHome(home.html)
  Object.assign(audit,{publisherOrganization:publisher.organization,openingCorporateHTMLSHA256:home.hash})
  const listing=await read(LIST),inventory=readListing(listing.html,publisher.organization)
  Object.assign(audit,{nativeReportedTotal:inventory.reportedTotal,observedRecordCount:inventory.rows.length,
   observedVacancyCount:inventory.rows.length,nativeListingRows:inventory.rows,openingListingHTMLSHA256:listing.hash})
  need(inventory.rows.length<=maxDetails,'Every declared native detail must fit the detail bound')
  need(maxRequests-receipts.length>=2*inventory.rows.length+2,'Complete native opening/closing request budget unavailable')
  for(const row of inventory.rows){
   need(roleURL(row.url),'Unreviewed native role URL identity');allowed.add(row.url)
   const page=await read(row.url),fact=readRole(page.html,row,publisher.organization,now)
   roles.push({...fact,openingOwnRoleHTMLSHA256:page.hash})
  }
  audit.allOpeningRolesBeforeClosingRoles=true
  for(const role of roles){
   const closing=await read(role.url)
   need(closing.hash===role.openingOwnRoleHTMLSHA256,'Closing whole own-role HTML/criteria changed')
   Object.assign(role,{closingOwnRoleHTMLSHA256:closing.hash,closingWholeOwnRoleUnchanged:true})
  }
  need((await read(LIST)).hash===listing.hash,'Closing whole current listing changed')
  need((await read(HOME)).hash===home.hash,'Closing whole corporate publisher/handoff changed')
  options.signal?.throwIfAborted()
  Object.assign(audit,{currentDeclaredSourceProgramComplete:true,allOwnRolesRechecked:true,currentCorporateHandoffRechecked:true,
   wholeListingRechecked:true,nativeIndiaCount:0,requests:receipts.length,
   sourceScope:'current-corporate-declared-Decimal-SSR-programme-only',
   completenessLimit:'Full published own-role HTML/criteria and explicit work countries; native schema is introductory only. Email/application screening unacquired; publisher legalName is self-declared.'})
  const jobs=[]
  attachSourceObservationEvidence(jobs,{source:'decimalai',recordKind:'vacancy-rows',observedRecordCount:inventory.rows.length,
   observedVacancyCount:inventory.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit)await options.onAudit(structuredClone(audit))
  options.signal?.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:LIST,firstParty:true,listingComplete:true,lifecycleCleanupAllowed:false,
   pagesFetched:receipts.length,reportedTotal:inventory.reportedTotal,indiaFacetCount:0,verifiedAt:now,
   reason:'Complete current declared Decimal SSR programme: unfiltered finite count/cards, every own-role full published criteria and explicit US country, all role/listing/corporate closing reads. Native introductory schema descriptions remain separate; no company-global inventory, registry legal-name verification, application screening completeness or cleanup is asserted.'})
 }catch(error){
  Object.assign(audit,{requests:receipts.length,currentDeclaredSourceProgramComplete:false})
  try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}
  throw error
 }
}

export async function runCurrentDecimalProgramme(options={}){
 limits(options)
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>180000
  ||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000
  ||!Number.isSafeInteger(interval)||interval<0||interval>5000)throw RangeError('Invalid Decimal source/request deadline or pacing')
 options.signal?.throwIfAborted()
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const timer=setTimeout(()=>controller.abort(new DOMException('Decimal source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 let next=0
 const fetcher=async(url,init)=>{
  const request={...init,cache:'no-store',credentials:'omit',headers:{...init.headers,Accept:'text/html'}}
  if(options.fetchImpl)return options.fetchImpl(url,request)
  if(options.fetchPage){
   const page=await options.fetchPage(url,request),html=page?.html??page?.body
   need(typeof html==='string','Injected original native HTML unavailable')
   const urls=['url','finalURL','finalUrl'].filter(key=>Object.hasOwn(page,key))
   need(urls.length>0&&urls.every(key=>page[key]===url),'Injected original response URL provenance missing or changed')
   const response=new Response(html,{status:page.status,headers:page.headers})
   Object.defineProperty(response,'url',{value:page[urls[0]]});return response
  }
  return fetch(url,request)
 }
 try{
  return await readCurrentDecimalProgramme({...options,signal,readPage:async url=>{
   if(next>performance.now())await delay(next-performance.now(),undefined,{signal})
   signal.throwIfAborted();next=performance.now()+interval
   const page=await boundedDeclaredPublicGet(url,{fetchImpl:fetcher,signal,timeoutMs:requestTimeoutMs,
    overflowError:failure('Original native response byte budget exceeded')})
   return {url:page.url,status:page.status,headers:page.headers,
    html:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(page.bodyBase64,'base64'))}
  }})
 }finally{clearTimeout(timer);controller.abort()}
}
