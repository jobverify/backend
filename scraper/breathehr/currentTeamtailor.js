import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CORPORATE,CORPORATE_CANONICAL,HOME,LIST,failure,corporateProgram,nativeHome,nativeListing,nativeRole,nativeRoleURL} from './currentTeamtailorData.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(value,message)=>{if(!value)throw failure(message)}
const limits=options=>{
 const values={maxRequests:options.maxRequests??48,maxDetails:options.maxDetails??20,maxPages:options.maxPages??8}
 for(const [key,ceiling]of [['maxRequests',48],['maxDetails',20],['maxPages',24]])
  if(!Number.isSafeInteger(values[key])||values[key]<1||values[key]>ceiling)throw RangeError('Invalid BreatheHR '+key+' bound')
 return values
}
const header=(page,key)=>page.headers?.get?.(key)??page.headers?.[key]??null
const redirect=page=>{
 need(page.status===301&&header(page,'location')===CORPORATE_CANONICAL,'Current corporate redirect changed')
 return {status:301,target:CORPORATE_CANONICAL}
}

// The only release path is zero for the complete current declared programme.
// An India/unknown role needs a separately qualified positive reader.
export async function readCurrentBreatheTeamtailor(options={}){
 const {maxRequests,maxDetails,maxPages}=limits(options),now=(options.now??(()=>new Date().toISOString()))()
 if(typeof options.readPage!=='function')throw TypeError('A bounded original HTML reader is required')
 need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid native observation date')
 need(maxPages>=2,'Native listing/home discovery page budget unavailable')
 const allowed=new Set([CORPORATE,CORPORATE_CANONICAL,HOME,LIST]),receipts=[],roles=[]
 const audit={source:'breathehr',checkedAt:now,receipts,roles,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  companyGlobalTotal:null,companyIndiaTotal:null,applicationVisited:false,screeningCriteriaAcquired:false,
  currentDeclaredSourceProgramComplete:false,companyGlobalScopeQualified:false}
 let bytes=0
 const read=async url=>{
  options.signal?.throwIfAborted()
  need(allowed.has(url)&&receipts.length<maxRequests,'Native public URL/request budget reached')
  const receipt={requestedURL:url,method:'GET',requestedAt:new Date().toISOString()};receipts.push(receipt)
  const page=await options.readPage(url,{cache:'no-store'})
  options.signal?.throwIfAborted()
  need(page?.url===url,'Current native response URL identity changed')
  Object.assign(receipt,{status:page.status,completedAt:new Date().toISOString()})
  if(page.status!==200&&!(url===CORPORATE&&page.status===301)){
   const error=failure('Native public HTTP '+page.status)
   error.status=page.status
   if([401,403,429,451].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})
   else if(page.status>=500)Object.assign(error,{failureKind:'network_or_timeout',upstreamOutage:true})
   throw error
  }
  const html=page.html
  if(url===CORPORATE){
   need(html===null||typeof html==='string','Original corporate redirect body unavailable')
   receipt.bodyBytes=typeof html==='string'?Buffer.byteLength(html):null
   receipt.bodySHA256=typeof html==='string'?sha(html):null
   return {page,snapshot:redirect(page)}
  }
  need(typeof html==='string'&&Buffer.byteLength(html)<=4e6,'Missing or oversized original native HTML')
  need(/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(header(page,'content-type')||''),'Unexpected native HTML MIME')
  bytes+=Buffer.byteLength(html);need(bytes<=24e6,'Native aggregate HTML byte budget reached')
  Object.assign(receipt,{bodyBytes:Buffer.byteLength(html),bodySHA256:sha(html)})
  return {html,hash:receipt.bodySHA256}
 }
 try{
  const originalRedirect=await read(CORPORATE)
  const corporate=await read(CORPORATE_CANONICAL);audit.publisher=corporateProgram(corporate.html)
  const home=await read(HOME),homeModel=nativeHome(home.html)
  const listing=await read(LIST),inventory=nativeListing(listing.html)
  Object.assign(audit,{nativeReportedTotal:inventory.reportedTotal,observedRecordCount:inventory.rows.length,
   observedVacancyCount:inventory.rows.length,nativeListingRows:inventory.rows,nativeHomeCards:homeModel.cards})
  const byId=new Map(inventory.rows.map(row=>[row.id,row]))
  need(homeModel.cards.length===inventory.rows.length&&homeModel.cards.every(row=>JSON.stringify(row)===JSON.stringify(byId.get(row.id))),
   'Native home/listing card inventory identity changed')
  need(inventory.rows.length<=maxDetails,'Whole native role detail budget unavailable')
  need(maxRequests-receipts.length>=2*inventory.rows.length+4,'Complete native opening/closing request budget unavailable')
  for(const row of inventory.rows){
   need(nativeRoleURL(row.url),'Unreviewed native role identity')
   allowed.add(row.url)
   const page=await read(row.url),fact=nativeRole(page.html,row,now)
   roles.push({...fact,openingOwnRoleHTMLSHA256:page.hash})
  }
  audit.allOpeningRolesBeforeClosingRoles=true
  for(const role of roles){
   const closing=await read(role.url)
   need(closing.hash===role.openingOwnRoleHTMLSHA256,'Closing whole own-role HTML changed')
   role.closingOwnRoleHTMLSHA256=closing.hash;role.closingWholeOwnRoleUnchanged=true
  }
  need((await read(LIST)).hash===listing.hash,'Closing whole native listing changed')
  need((await read(HOME)).hash===home.hash,'Closing whole native home changed')
  need((await read(CORPORATE_CANONICAL)).hash===corporate.hash,'Closing corporate publisher/handoff changed')
  need(JSON.stringify((await read(CORPORATE)).snapshot)===JSON.stringify(originalRedirect.snapshot),'Closing current corporate redirect changed')
  options.signal?.throwIfAborted()
  Object.assign(audit,{currentDeclaredSourceProgramComplete:true,allOwnRolesRechecked:true,
   currentCorporateHandoffRechecked:true,wholeListingAndHomeRechecked:true,nativeIndiaCount:0,requests:receipts.length,
   sourceScope:'current-corporate-declared-BreatheHR-Teamtailor-programme-only',
   completenessLimit:'Published SSR roles/JDs/countries only; lazy application forms and screening criteria were not acquired.'})
  const jobs=[]
  attachSourceObservationEvidence(jobs,{source:'breathehr',recordKind:'vacancy-rows',observedRecordCount:inventory.rows.length,
   observedVacancyCount:inventory.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if(options.onAudit)await options.onAudit(structuredClone(audit))
  return attachInventoryEvidence(jobs,{status:'complete-inventory',surface:LIST,firstParty:true,listingComplete:true,
   lifecycleCleanupAllowed:false,pagesFetched:receipts.length,reportedTotal:inventory.reportedTotal,indiaFacetCount:0,verifiedAt:now,
   reason:'Complete current declared BreatheHR SSR programme: unfiltered count/cards and every full explicit foreign role/JD reconcile with current corporate/native authority and all closing reads. Native employer names remain published; no group-global inventory, application screening completeness or cleanup is asserted.'})
 }catch(error){
  Object.assign(audit,{requests:receipts.length,currentDeclaredSourceProgramComplete:false})
  try{Object.defineProperty(error,'nativeCollectionEvidence',{value:audit,configurable:true})}catch{}
  throw error
 }
}

export async function runCurrentBreatheTeamtailor(options={}){
 limits(options)
 const sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000,interval=options.requestIntervalMs??500
 if(!Number.isSafeInteger(sourceTimeoutMs)||sourceTimeoutMs<1||sourceTimeoutMs>180000
  ||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000
  ||!Number.isSafeInteger(interval)||interval<0||interval>5000)throw RangeError('Invalid BreatheHR native request deadline/pacing')
 options.signal?.throwIfAborted()
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const timer=setTimeout(()=>controller.abort(new DOMException('BreatheHR source deadline exceeded','TimeoutError')),sourceTimeoutMs)
 let next=0
 const fetcher=async(url,init)=>{
  if(options.fetchImpl)return options.fetchImpl(url,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,Accept:'text/html'}})
  if(options.fetchPage){
   const page=await options.fetchPage(url,{...init,cache:'no-store',credentials:'omit'})
   const text=page?.html??page?.body
   if(typeof text!=='string'&&text!==null)throw failure('Injected original native HTML missing')
   const originalURLs=['url','finalURL','finalUrl'].filter(key=>Object.hasOwn(page,key))
   need(originalURLs.length>0&&originalURLs.every(key=>page[key]===url),'Injected original native response URL missing or changed')
   const response=new Response(text,{status:page.status,headers:page.headers})
   Object.defineProperty(response,'url',{value:page[originalURLs[0]]});return response
  }
  return fetch(url,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,Accept:'text/html'}})
 }
 try{
  return await readCurrentBreatheTeamtailor({...options,signal,readPage:async url=>{
   if(next>performance.now())await delay(next-performance.now(),undefined,{signal})
   signal.throwIfAborted();next=performance.now()+interval
   const page=await boundedDeclaredPublicGet(url,{fetchImpl:fetcher,signal,timeoutMs:requestTimeoutMs,
    overflowError:failure('Original native response byte budget exceeded')})
   const bytes=Buffer.from(page.bodyBase64,'base64')
   return {url:page.url,status:page.status,headers:page.headers,html:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}
  }})
 }finally{clearTimeout(timer);controller.abort()}
}
