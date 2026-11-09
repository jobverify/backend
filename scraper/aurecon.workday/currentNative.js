import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {runWorkdayScraper,validateWorkdayAdditionalWorksiteProof,WORKDAY_ADDITIONAL_WORKSITE_PROOF} from '../../scraper-support/myworkday/engine.js'
import {WORKDAY_COUNTRY_INVENTORY_PROOF} from '../../scraper-support/myworkday/countryInventoryProof.js'
import {AURECON_CAREERS,AURECON_CONTACT,AURECON_BOARD,AURECON_API,AURECON_MAIN,AURECON_CONTACT_MODULE,AURECON_CONTACT_TARGET,nextAureconClientRequest} from '../../scraper-support/myworkday/nativeAureconWorksites.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const scraperDir=path.dirname(fileURLToPath(import.meta.url))
const allowed=new Set([AURECON_CAREERS,AURECON_CONTACT,AURECON_MAIN,AURECON_CONTACT_MODULE,AURECON_CONTACT_TARGET])
const hash=value=>createHash('sha256').update(value).digest('hex')
const intrinsicByteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get
const failure=(message,kind='parser_or_contract_error',extra={})=>Object.assign(Error('Aurecon '+message),{abortRetries:true,failureKind:kind,...extra})
const deadline=message=>failure(message,'network_or_timeout',{upstreamOutage:true,softFailure:true})
const accessDenied=new Set([401,403,406,429])
const context={source:'aurecon',baseUrl:AURECON_BOARD,jobsApiUrl:AURECON_API,officialCareersUrl:AURECON_CAREERS,countryProof:true}

export function createCurrentAureconScraper(defaults={}){
 const collect=async(options={})=>{
  const o={...defaults,...options},timeoutMs=o.timeoutMs??180000,requestTimeoutMs=o.requestTimeoutMs??15000
  // Retain the three-minute default; an explicit caller budget may use the
  // same ten-minute ceiling already enforced by the current worksite proof.
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>600000||!Number.isFinite(requestTimeoutMs)||requestTimeoutMs<=0||requestTimeoutMs>20000)throw failure('invalid public attempt budget')
  if(o.fetchText||o.fetchPage)throw failure('requires original public response status, URL and MIME')
  const started=Date.now(),clock=new AbortController(),timer=setTimeout(()=>clock.abort(deadline('public source deadline')),timeoutMs)
  const signal=o.signal?AbortSignal.any([o.signal,clock.signal]):clock.signal,fetchImpl=o.fetchImpl??globalThis.fetch,responses=[],heldHosts=new Set()
  let bytes=0
  const wait=(operation,boundary=signal)=>new Promise((resolve,reject)=>{
   const abort=()=>{boundary.removeEventListener('abort',abort);reject(o.signal?.aborted?o.signal.reason:boundary.reason)}
   if(boundary.aborted){abort();return}boundary.addEventListener('abort',abort,{once:true})
   Promise.resolve().then(()=>{boundary.throwIfAborted();return operation()}).then(value=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():resolve(value)},error=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():reject(error)})
  })
  const read=async url=>{
   signal.throwIfAborted()
   if(!allowed.has(url)||responses.length>=12||heldHosts.has(new URL(url).host))throw failure('unreviewed, exhausted or denied public URL')
   const requestClock=new AbortController(),requestTimer=setTimeout(()=>requestClock.abort(deadline('public request deadline: '+url)),requestTimeoutMs)
   const boundary=AbortSignal.any([signal,requestClock.signal]),row={url,status:null,contentType:null,body:null,sha256:null,sourceRequestedAt:new Date().toISOString(),bodyUnavailable:true}
   responses.push(row);let response,reader,denial
   const publicDenial=cause=>failure('public HTTP '+row.status,'blocked_or_access_denied',{
    source:'aurecon',status:row.status,statusCode:row.status,requestURL:url,requestUrl:url,finalURL:row.responseUrl,
    contentType:row.contentType,responseBody:row.body,responseBodyBytes:row.bytes??null,responseBodySHA256:row.sha256,
    upstreamOutage:true,softFailure:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,...(cause===undefined?{}:{cause}),
   })
   try{
    try{response=await wait(()=>fetchImpl(url,{method:'GET',redirect:'manual',signal:boundary,headers:{Accept:'text/html,application/javascript','User-Agent':'JobverifyScraper/1.0'}}),boundary)}catch(error){boundary.throwIfAborted();throw failure('public transport unavailable: '+url,'network_or_timeout',{cause:error,upstreamOutage:true,softFailure:true})}
    Object.assign(row,{status:response.status,responseUrl:response.url,contentType:response.headers?.get?.('content-type')||'',location:response.headers?.get?.('location')||null,sourceHttpDate:response.headers?.get?.('date')||null})
    if(accessDenied.has(response.status))heldHosts.add(new URL(url).host)
    if(response.url!==url)throw failure('public response URL identity changed')
    if(url===AURECON_CONTACT_MODULE){
     if(response.status!==301||row.location!==AURECON_CONTACT_TARGET)throw failure('declared contact-module redirect changed')
     row.bodyUnavailableReason='Original redirect receipt retained; exact target is a separate anonymous request'
     row.fetchedAt=new Date().toISOString();return row
    }
    if(response.status!==200&&!accessDenied.has(response.status))throw failure('public HTTP '+response.status,response.status>=500?'network_or_timeout':'parser_or_contract_error',{status:response.status,upstreamOutage:response.status>=500,softFailure:response.status>=500})
    if(Number(response.headers?.get?.('content-length')||0)>4*1024*1024||!response.body?.getReader)throw failure('public body unavailable or over byte bound')
    reader=response.body.getReader();const chunks=[];let size=0
    while(true){const part=await wait(()=>reader.read(),boundary);boundary.throwIfAborted();if(part.done)break
     if(!ArrayBuffer.isView(part.value)||!(part.value instanceof Uint8Array))throw failure('public response stream is not native bytes')
     const length=intrinsicByteLength.call(part.value)
     if(length>4*1024*1024-size||length>32*1024*1024-bytes)throw failure('public body or aggregate byte bound exceeded')
     const chunk=Buffer.from(part.value);size+=length;bytes+=length
     chunks.push(chunk)
    }
    const body=Buffer.concat(chunks);row.bytes=body.length;row.sha256=hash(body);row.bodyUnavailable=false
    try{row.body=new TextDecoder('utf-8',{fatal:true}).decode(body)}catch(error){row.originalBodyBase64=body.toString('base64');throw error}
    row.fetchedAt=new Date().toISOString();if(accessDenied.has(row.status)){denial=publicDenial();throw denial}return row
   }catch(error){
    if(o.signal?.aborted)throw o.signal.reason
    if(accessDenied.has(row.status)){
     row.error={name:'Error',message:'Aurecon public HTTP '+row.status+(error===denial?'':'; original body collection failed')}
     throw error===denial?error:publicDenial(error)
    }
    row.error={name:error?.name||null,message:error?.message||String(error)}
    throw error
   }
   finally{
    clearTimeout(requestTimer)
    if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{})}catch{};try{reader.releaseLock()}catch{}}
    else if(response?.body){try{Promise.resolve(response.body.cancel()).catch(()=>{})}catch{}}
   }
  }
  const makeProof=(corporateResponse,clientResponses,contactSnapshots)=>({version:'aurecon-native-worksites-v2',source:'aurecon',boardUrl:AURECON_BOARD,jobsApiUrl:AURECON_API,officialCareersUrl:AURECON_CAREERS,directoryUrl:AURECON_CONTACT,
   attemptStartedAt:new Date(started).toISOString(),attemptDeadlineAt:new Date(started+timeoutMs).toISOString(),verifiedAt:new Date().toISOString(),corporateResponse,clientResponses,contactSnapshots})
  try{
   const corporate=await read(AURECON_CAREERS),clientResponses=[]
   for(let url=nextAureconClientRequest(corporate,clientResponses);url;url=nextAureconClientRequest(corporate,clientResponses))clientResponses.push(await read(url))
   const first=await read(AURECON_CONTACT),second=await read(AURECON_CONTACT),input=makeProof(corporate,clientResponses,[first,second])
   const openingWorksites=validateWorkdayAdditionalWorksiteProof(input,context)
   const jobs=await wait(()=>runWorkdayScraper({company:'Aurecon',source:'aurecon',baseUrl:AURECON_BOARD,scraperDir,signal,requestTimeoutMs,retryBaseDelayMs:0,
    sourceWorksiteCountryProof:input,...(o.requestScheduler?{requestScheduler:o.requestScheduler}:{}),...(o.nativeDetailRecovery===undefined?{}:{nativeDetailRecovery:o.nativeDetailRecovery})}))
   const closingCorporate=await read(AURECON_CAREERS),third=await read(AURECON_CONTACT)
   const closingWorksites=validateWorkdayAdditionalWorksiteProof(makeProof(closingCorporate,clientResponses,[second,third]),context)
   const closingStable=openingWorksites.snapshots[0].nativeModelSHA256===openingWorksites.snapshots[1].nativeModelSHA256
    &&openingWorksites.snapshots[1].nativeModelSHA256===closingWorksites.snapshots[1].nativeModelSHA256
    &&JSON.stringify(openingWorksites.corporateReceipt.nativeLink)===JSON.stringify(closingWorksites.corporateReceipt.nativeLink)
   if(!closingStable)throw failure('closing corporate handoff or native office model changed','coverage_gap',{softFailure:true,partial:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
   const nativeProof=jobs[WORKDAY_COUNTRY_INVENTORY_PROOF],worksiteProof=jobs[WORKDAY_ADDITIONAL_WORKSITE_PROOF],engineEvidence=readInventoryEvidence(jobs)
   if(!nativeProof||!worksiteProof)throw failure('current native inventory and worksite proofs missing')
   const complete=engineEvidence?.listingComplete===true
   for(const job of jobs)Object.assign(job,{sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null})
   const inventoryEvidence={...engineEvidence,verifiedAt:new Date().toISOString(),pagesFetched:(engineEvidence?.pagesFetched||0)+responses.length,
    reason:complete?'aurecon-current-configured-board-country-proof-with-native-office-relations;company-scope-and-cleanup-unverified':'aurecon-current-configured-board-unresolved-native-geography;company-scope-and-cleanup-unverified'}
   attachInventoryEvidence(jobs,inventoryEvidence);attachSourceObservationEvidence(jobs,{source:'aurecon',recordKind:'vacancy-rows',observedRecordCount:nativeProof.initial.count,observedVacancyCount:nativeProof.initial.count,sourceScopeComplete:false})
   const result={jobs,nativeRoles:nativeProof.listingRoles,nativeCountryProof:nativeProof,worksiteCountryProof:worksiteProof,
    directorySnapshots:[openingWorksites.snapshots[0],openingWorksites.snapshots[1],closingWorksites.snapshots[1]],corporateReceipts:[openingWorksites.corporateReceipt,closingWorksites.corporateReceipt],
    closingStable,responses,inventoryEvidence,configuredBoardScopeComplete:complete,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
   Object.defineProperty(jobs,'sourceAudit',{value:result});if(o.onAudit)await wait(()=>o.onAudit(result));return result
  }catch(error){if(o.signal?.aborted)throw o.signal.reason;if(!accessDenied.has(error?.status))signal.throwIfAborted();if(error&&typeof error==='object'&&Object.isExtensible(error))error.nativeEvidence={source:'aurecon',completedCompanyCollectorRecheck:false,responses};throw error}
  finally{clearTimeout(timer)}
 }
 return{collect,run:async options=>(await collect(options)).jobs}
}
export const run=async options=>createCurrentAureconScraper().run(options)
