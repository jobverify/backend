import {setTimeout as delay} from 'node:timers/promises'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {HOME,HOME_FINAL,CAREERS,JOBS,sha,need,failure,same,readCorporate,readCareers,readCountryForm,readIndiaListing,readFerreroRole} from './nativeModels.js'
const ignore=fn=>{try{void Promise.resolve(fn()).catch(()=>{})}catch{}}
const race=(operation,signal)=>new Promise((resolve,reject)=>{
 let settled=false
 const fail=()=>{if(!settled){settled=true;signal.removeEventListener('abort',fail);reject(signal.reason)}}
 signal.addEventListener('abort',fail,{once:true})
 if(signal.aborted){fail();return}
 Promise.resolve().then(()=>{signal.throwIfAborted();return operation()}).then(value=>{if(settled)return;signal.removeEventListener('abort',fail);if(signal.aborted){fail();return}settled=true;resolve(value)},error=>{if(settled)return;signal.removeEventListener('abort',fail);settled=true;reject(signal.aborted?signal.reason:error)})
})
export function createFerreroReader(options={}){
 const caller=options.signal,sourceTimeoutMs=options.sourceTimeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??15000,maxRequests=options.maxRequests??48
 const maxPages=options.maxPages??8,requestIntervalMs=options.requestIntervalMs??0
 for(const[name,value,max]of[['sourceTimeoutMs',sourceTimeoutMs,180000],['requestTimeoutMs',requestTimeoutMs,15000],['maxRequests',maxRequests,48],['maxPages',maxPages,8]])need(Number.isSafeInteger(value)&&value>0&&value<=max,'Invalid '+name+' budget')
 need(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0&&requestIntervalMs<=2000,'Invalid request pacing')
 caller?.throwIfAborted()
 const sourceDeadline=performance.now()+sourceTimeoutMs,stop=new AbortController(),timer=setTimeout(()=>stop.abort(new DOMException('Ferrero source deadline exceeded','TimeoutError')),sourceTimeoutMs),signal=caller?AbortSignal.any([caller,stop.signal]):stop.signal
 const allowed=new Set([HOME,CAREERS,JOBS]),receipts=[];let pages=0,details=0,bytes=0,lastStart=0,closed=false
 const check=()=>{caller?.throwIfAborted();if(performance.now()>=sourceDeadline&&!stop.signal.aborted)stop.abort(new DOMException('Ferrero source deadline exceeded','TimeoutError'));signal.throwIfAborted()}
 return {receipts,signal,check,allow(url){need(typeof url==='string'&&new URL(url).origin===new URL(CAREERS).origin,'Unbound native URL admission');allowed.add(url)},
  async read(url,role=false){
   check();need(!closed&&allowed.has(url)&&receipts.length<maxRequests,'Native request admission/budget');need(role?++details<=20:++pages<=maxPages,'Native page/detail read budget')
   if(performance.now()-lastStart<requestIntervalMs)await delay(requestIntervalMs-(performance.now()-lastStart),undefined,{signal});check();lastStart=performance.now()
   const requestDeadline=performance.now()+requestTimeoutMs,deadline=new AbortController(),requestTimer=setTimeout(()=>deadline.abort(new DOMException('Ferrero request deadline exceeded','TimeoutError')),requestTimeoutMs),requestSignal=AbortSignal.any([signal,deadline.signal])
   const requestCheck=()=>{check();if(performance.now()>=requestDeadline&&!deadline.signal.aborted)deadline.abort(new DOMException('Ferrero request deadline exceeded','TimeoutError'));requestSignal.throwIfAborted()}
   const receipt={sequence:receipts.length+1,requestedURL:url,method:'GET',bodyComplete:false};receipts.push(receipt)
   try{
    const page=await boundedDeclaredPublicGet(url,{signal:requestSignal,overflowError:failure('Native entity exceeds shared byte limit'),fetchImpl:async(value,init)=>{
     requestCheck()
     const actual={...init,redirect:'follow',credentials:'omit',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify careers inventory check)'}}
     Object.assign(receipt,{requestHeaders:Object.fromEntries(new Headers(actual.headers)),redirect:actual.redirect,credentials:actual.credentials})
     const response=await(options.fetchImpl??globalThis.fetch)(value,actual)
     try{requestCheck()}catch(error){ignore(()=>response?.body?.cancel(error));throw error}
     Object.assign(receipt,{status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')})
     const length=response.headers.get('content-length');need(length===null||/^\d+$/.test(length)&&Number(length)<=4*1024*1024,'Native declared entity byte limit')
     return response
    }})
    requestCheck()
    const body=Buffer.from(page.bodyBase64,'base64');bytes+=body.length
    Object.assign(receipt,{status:page.status,finalURL:page.url,contentType:page.headers['content-type']??'',bodyComplete:true,bodyBytes:body.length,bodySHA256:sha(body),bodyBase64:page.bodyBase64})
    need(body.length<=4*1024*1024&&bytes<=32*1024*1024,'Native body/source byte budget')
    if(page.status!==200)throw failure('Native HTTP '+page.status,{status:page.status,requestUrl:url,upstreamOutage:[401,403,406,429,451].includes(page.status),failureKind:[401,403,406,429,451].includes(page.status)?'blocked_or_access_denied':'network_or_timeout'})
    need(page.url===(url===HOME?HOME_FINAL:url),'Native final URL identity changed')
    need(/^text\/html(?:;|$)/i.test(receipt.contentType),'Native response MIME changed')
    const html=new TextDecoder('utf-8',{fatal:true}).decode(body);requestCheck()
    return{status:page.status,url:page.url,contentType:receipt.contentType,html}
   }catch(error){
    closed=true;caller?.throwIfAborted()
    if([401,403,406,429,451].includes(receipt.status))throw error?.status===receipt.status?error:failure('Native HTTP '+receipt.status+'; original body unavailable',{status:receipt.status,requestUrl:url,failureKind:'blocked_or_access_denied',upstreamOutage:true,cause:error})
    requestCheck();throw error
   }finally{clearTimeout(requestTimer)}
  },
  stats:()=>({requests:receipts.length,pages,detailReads:details,totalDecodedBytes:bytes,sourceTimeoutMs,requestTimeoutMs,maxRequests,maxPages,detailReadCap:20}),
  close(){closed=true;clearTimeout(timer);stop.abort()}
 }
}
const roleComparable=role=>{
 const{originalRawHTML,originalBodySHA256,...model}=role
 return model
}
export async function runFerreroNative(options={}){
 const maxDetails=options.maxDetails??20
 need(Number.isSafeInteger(maxDetails)&&maxDetails>0&&maxDetails<=20,'Invalid unique detail budget')
 const now=options.now?options.now():new Date().toISOString();need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid collection clock')
 const reader=createFerreroReader(options),audit={source:'ferrero',observedAt:now,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,serverPublishedModelsOnly:true,externalClientRuntimeReviewed:false,publisherProgramsExecuted:false,applicationInteractions:0,receipts:reader.receipts,openingRoles:[],closingRoles:[],heldRoles:[],failures:[]}
 const parse=async(url,fn)=>{const p=await reader.read(url);reader.check();const result=fn(p);reader.check();return result}
 const readRole=async row=>{
  const p=await reader.read(row.url,true)
  try{const model=readFerreroRole(p,row,now);reader.check();return model}
  catch(error){reader.check();return{id:row.id,url:row.url,modelComplete:false,reason:error.message,originalRawHTML:p.html,originalBodySHA256:sha(p.html),originalListingRow:row}}
 }
 try{
  audit.corporateOpening=await parse(HOME,readCorporate);audit.careersOpening=await parse(CAREERS,readCareers);audit.formOpening=await parse(JOBS,readCountryForm)
  reader.allow(audit.formOpening.indiaURL);audit.opening=await parse(audit.formOpening.indiaURL,p=>readIndiaListing(p,audit.formOpening))
  const selected=audit.opening.rows.slice(0,Math.min(maxDetails,10));selected.forEach(row=>reader.allow(row.url))
  for(const row of selected)audit.openingRoles.push(await readRole(row))
  audit.closing=await parse(audit.formOpening.indiaURL,p=>readIndiaListing(p,audit.formOpening))
  need(same(audit.opening.rows,audit.closing.rows),'Native India listing changed at closing')
  for(const row of selected)audit.closingRoles.push(await readRole(row))
  audit.formClosing=await parse(JOBS,readCountryForm);need(audit.formOpening.indiaURL===audit.formClosing.indiaURL&&audit.formOpening.publishedIndiaCandidateCount===audit.formClosing.publishedIndiaCandidateCount,'Native GET country form changed at closing')
  audit.careersClosing=await parse(CAREERS,readCareers);audit.corporateClosing=await parse(HOME,readCorporate)
  need(audit.careersOpening.jobsURL===audit.careersClosing.jobsURL&&audit.corporateOpening.nativeCareers===audit.corporateClosing.nativeCareers,'Native corporate delegation changed at closing')
  const qualified=[]
  for(const row of audit.opening.rows){
   const opening=audit.openingRoles.find(r=>r.id===row.id),closing=audit.closingRoles.find(r=>r.id===row.id)
   let reason
   if(!opening||!closing)reason='native-detail-unread-budget'
   else if(!opening.modelComplete||!closing.modelComplete)reason=opening.reason??closing.reason
   else if(!same(roleComparable(opening),roleComparable(closing)))reason='closing-full-native-model-changed'
   else if(opening.issues.length)reason=opening.issues.join(';')
   if(reason)audit.heldRoles.push({id:row.id,reason,listingRow:row,opening:opening??null,closing:closing??null})
   else qualified.push(opening)
  }
  Object.assign(audit,{observedNativeRecords:audit.opening.rows.length,completeServerPublishedModels:audit.openingRoles.filter(r=>r.modelComplete).length,returnedIndiaJobs:qualified.length,transport:reader.stats(),currentSelectedListingStable:true,allSelectedDetailsRead:selected.length===audit.opening.rows.length})
  reader.check();if(options.onAudit)await race(()=>options.onAudit(structuredClone(audit)),reader.signal);reader.check()
  const jobs=qualified.map(m=>({source:'ferrero',company:'Ferrero',companyDomain:'ferrero.com',companyCareerPage:CAREERS,atsPlatform:'first-party-drupal',jobId:m.id,title:m.title,sourceUrl:m.url,link:m.url,applyUrl:m.applyUrl,country:'India',city:m.city,state:null,location:m.city+', India',postingDate:m.schema.datePosted.slice(0,10),closingDate:m.schema.validThrough.slice(0,10),employmentType:m.employmentType,workplaceType:m.workplaceType,jobDescription:m.criteriaText,sourceDescription:m.fullCriteriaHTML,sourceNativeRecord:m,sourceNativeClosingRecord:audit.closingRoles.find(r=>r.id===m.id),activeApplyVerified:false,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:now}))
  attachSourceObservationEvidence(jobs,{source:'ferrero',recordKind:'vacancy-rows',observedRecordCount:audit.opening.rows.length,observedVacancyCount:audit.opening.rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'sourceAudit',{value:audit});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:audit.formOpening.indiaURL,firstParty:true,listingComplete:false,pagesFetched:reader.receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'Current declared India country-form candidates only; full native lifecycle conflicts/unknown models remain raw holds. Whole-company inventory and application acceptance are unverified; cleanup forbidden.'});reader.check();return result
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){audit.transport=reader.stats();audit.failures.push({message:error.message,status:error.status??null});Object.assign(error,{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false,recruitmentObservations:audit})}
  throw error
 }finally{reader.close()}
}
