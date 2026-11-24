import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SOURCE,CAREERS,HOME,KEYWORD,PROFILE,need,sha,readIkeaAuthority,readIkeaHome,readIkeaRole,sameNative} from './nativeContract.js'
import {declaredSearchClients,deriveIkeaSearchProfile,requestFor,readIkeaSelectedPage} from './searchContract.js'
import {createIkeaTransport} from './nativeTransport20261121.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'

const race=(promise,signal)=>new Promise((resolve,reject)=>{
 let settled=false
 const abort=()=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(signal.reason)}
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
 Promise.resolve(promise).then(value=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);resolve(value)},error=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(error)})
})
const safeURL=value=>{const u=new URL(value);return u.origin+u.pathname}
const boundedStatus=value=>Number.isInteger(value)&&value>=100&&value<=599
const batch=async(values,fn)=>{const results=[];for(let i=0;i<values.length;i+=3)results.push(...await Promise.all(values.slice(i,i+3).map(fn)));return results}
const roleProof=role=>Object.fromEntries(Object.entries(role).filter(([key])=>!['rawHTML','bodySHA256'].includes(key)))

export async function runIkeaNative({fetchPage,signal:caller,now=()=>new Date().toISOString(),timeoutMs=180000,requestTimeoutMs=20000,maxPages=16,maxDetails=200,onAudit,fetchImpl=globalThis.fetch}={}){
 caller?.throwIfAborted()
 need(typeof fetchImpl==='function'&&(fetchPage===undefined||typeof fetchPage==='function'),'invalid metadata-aware fetch contract')
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=20000&&Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=16&&Number.isSafeInteger(maxDetails)&&maxDetails>0&&maxDetails<=200,'invalid bounded source budget')
 const stop=new AbortController(),aggregate=AbortSignal.timeout(timeoutMs),signal=AbortSignal.any([...(caller?[caller]:[]),aggregate,stop.signal]),allowed=new Set([CAREERS,HOME,KEYWORD]),receipts=[],inflight=new Set()
 const transport=createIkeaTransport({fetchImpl,callerSignal:caller})
 let requestsClosed=false,totalBodyBytes=0,stage='employer-authority',activeURL=CAREERS
 const audit={source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,selectedScope:'keywordIndia+typedcountryIndia-only',receipts,failures:[],opening:null,closing:null,openingDetails:[],closingDetails:[],heldIndiaRoles:[],returnedIndiaJobs:0,applicationInteractions:0,publisherProgramsExecuted:false,nativeLegalEmployer:null}
 const priority=()=>{caller?.throwIfAborted();signal.throwIfAborted()}
 const get=async(url,{headers={Accept:'text/html,application/xhtml+xml'}}={})=>{
  priority();need(!requestsClosed&&allowed.has(url)&&receipts.length<450,'unreviewed request or bounded read cap');activeURL=url
  const receipt={sequence:receipts.length+1,requestedURL:url,method:'GET',requestHeaders:headers},attempt=AbortSignal.any([signal,AbortSignal.timeout(requestTimeoutMs)])
  const pending=(async()=>{
   priority()
   const page=fetchPage?await race(Promise.resolve().then(()=>{priority();return fetchPage(url,{signal:attempt,headers,method:'GET'})}),attempt):await transport.readPage(url,{signal:attempt,headers,receipt})
   if(page&&typeof page==='object')Object.assign(receipt,{status:page.status??null,finalURL:page.url??null,contentType:page.contentType??null})
   await requireNativeHttpResponse({status:page?.status,url:page?.url,headers:new Headers({'content-type':typeof page?.contentType==='string'?page.contentType:''}),body:null},url,{context:'IKEA native HTTP',signal:attempt,callerSignal:caller})
   priority();need(typeof page?.html==='string','HTTP body unavailable')
   totalBodyBytes+=Buffer.byteLength(page.html);need(Buffer.byteLength(page.html)<=4000000&&totalBodyBytes<=64*1024*1024,'bounded source response byte budget exceeded')
   Object.assign(receipt,{bodyBytes:Buffer.byteLength(page.html),bodySHA256:sha(page.html),rawHTML:page.html})
   return page
  })();receipts.push(receipt);inflight.add(pending)
  try{return await pending}catch(error){requestsClosed=true;caller?.throwIfAborted();if(stop.signal.aborted)throw error;if(error&&typeof error==='object'&&Object.isExtensible(error)){if(!Object.hasOwn(error,'requestUrl'))error.requestUrl=safeURL(url);if(boundedStatus(receipt.status)&&!Object.hasOwn(error,'status')){error.status=receipt.status;error.cause={status:receipt.status,requestUrl:safeURL(url)}}if(boundedStatus(receipt.status)&&!Object.hasOwn(error,'cause'))error.cause={status:receipt.status,requestUrl:safeURL(url)};if(error.responseUrl!==undefined&&error.responseUrl!==url){error.softFailure=false;error.upstreamOutage=false;error.failureKind='parser_or_contract_error'}}throw error}finally{inflight.delete(pending)}
 }
 const parseAt=async(url,parse,options)=>{const page=await get(url,options);try{return parse(page)}catch(error){if(error&&typeof error==='object'&&Object.isExtensible(error)&&!Object.hasOwn(error,'requestUrl'))error.requestUrl=safeURL(url);throw error}}
 const program=async url=>{allowed.add(url);const page=await get(url,{headers:{Accept:'application/javascript,text/javascript'}});need(/^application\/x-javascript(?:;|$)/i.test(page.contentType||'')&&sha(page.html)===PROFILE.clientHashes[url],'current declared native program MIME/hash changed');return page.html}
 try{
  audit.employerOpening=await parseAt(CAREERS,readIkeaAuthority);stage='native-home';audit.homeOpening=await parseAt(HOME,readIkeaHome)
  stage='native-search-profile';const initial=await get(KEYWORD),clientURLs=declaredSearchClients(initial),clients={};for(const url of clientURLs)clients[url]=await program(url)
  const profile=deriveIkeaSearchProfile(initial,clients);need(profile.pages<=maxPages&&profile.total<=maxDetails,'native pagination/detail budget insufficient');audit.searchOpening=profile
  const requests=Array.from({length:profile.pages},(_,i)=>requestFor(profile,i+1));for(const r of requests)allowed.add(r.url)
  const collect=()=>batch(requests,async r=>parseAt(r.url,p=>readIkeaSelectedPage(p,profile,requests.indexOf(r)+1),{headers:r.headers}))
  stage='native-selected-listing';const pages=await collect(),rows=pages.flatMap(p=>p.rows);need(rows.length===profile.total&&new Set(rows.map(r=>r.id)).size===rows.length,'incomplete/duplicate selected native inventory');audit.opening={pages,rows,total:profile.total}
  for(const row of rows)allowed.add(row.url)
  stage='native-full-role';audit.openingDetails=await batch(rows,row=>parseAt(row.url,page=>readIkeaRole(page,row)))
  stage='native-role-client';const roleClient='https://tbcdn.talentbrew.com/js/client/job-details.js';clients[roleClient]=await program(roleClient)
  stage='native-full-role-closing';audit.closingDetails=await batch(rows,row=>parseAt(row.url,page=>readIkeaRole(page,row)));need(audit.openingDetails.every((role,i)=>sameNative(roleProof(role),roleProof(audit.closingDetails[i]))),'changed entire native role/criteria/schema/worksite/held proof at closing')
  stage='native-listing-closing';const closingPages=await collect();need(pages.every((p,i)=>sameNative(p.rows,closingPages[i].rows)&&sameNative(p.model,closingPages[i].model)&&p.filters===closingPages[i].filters),'changed selected native listing/model/country facet at closing');audit.closing={pages:closingPages,rows:closingPages.flatMap(p=>p.rows),total:profile.total}
  stage='employer-authority-closing';audit.employerClosing=await parseAt(CAREERS,readIkeaAuthority);audit.homeClosing=await parseAt(HOME,readIkeaHome)
  stage='native-publisher-closing';const closingInitial=await get(KEYWORD),closingURLs=declaredSearchClients(closingInitial);need(sameNative(clientURLs,closingURLs),'publisher declaration changed at closing');const closingClients={};for(const url of Object.keys(clients))closingClients[url]=await program(url)
  audit.searchClosing=deriveIkeaSearchProfile(closingInitial,closingClients);need(sameNative(profile.model,audit.searchClosing.model)&&sameNative(profile.initialModel,audit.searchClosing.initialModel)&&profile.total===audit.searchClosing.total,'current native search authority/model changed at closing')
  audit.heldIndiaRoles=audit.openingDetails.filter(r=>!r.complete).map(role=>({id:role.id,reasons:role.issues,nativeRole:role,closingNativeRole:audit.closingDetails.find(r=>r.id===role.id)}))
  const full=audit.openingDetails.filter(r=>r.complete);need(full.length>0,'all selected native roles lack complete corroborated mandatory proof')
  const observed={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  Object.assign(audit,observed,{observedAt:now(),requestCount:receipts.length,nativeSelectedCountryCount:profile.total,listingOpeningClosingStable:true,roleOpeningClosingStable:true,returnedIndiaJobs:full.length})
  for(const held of audit.heldIndiaRoles)audit.failures.push({stage:'native-role-hold',id:held.id,reasons:held.reasons})
  priority();if(onAudit)await race(Promise.resolve().then(()=>{priority();return onAudit(structuredClone(audit))}),signal);priority()
  const jobs=full.map(role=>({source:SOURCE,company:'IKEA',companyCareerPage:CAREERS,companyDomain:'ikea.com',atsPlatform:'talentbrew',jobId:role.reference,requisitionId:role.reference,nativePublishedId:role.id,title:role.title,link:role.applyUrl,sourceUrl:role.url,applyUrl:role.applyUrl,country:'India',city:role.worksites[0].city,state:role.worksites[0].state,location:role.worksites.map(l=>[l.city,l.state,l.country].filter(Boolean).join(', ')).join('; '),workplaceLocations:role.worksites,nativeEmployerBrand:role.publicationBrand,nativePublicationChannel:role.publicationChannel,nativeLegalEmployer:null,nativeHiringOrganization:role.schemaInfo.model.hiringOrganization,postingDate:role.postedDate,closingDate:null,employmentType:role.nativeModel.Job.JobType,jobDescription:role.criteriaText,sourceDescription:role.criteriaHTML,sourceNativeRecord:role,sourceNativeClosingRecord:audit.closingDetails.find(r=>r.id===role.id),sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,scrapedAt:audit.observedAt}))
  attachSourceObservationEvidence(jobs,observed);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true});Object.defineProperty(jobs,'sourceAudit',{value:audit});priority()
  const result=attachInventoryEvidence(jobs,{status:'coverage-gap',surface:KEYWORD,firstParty:true,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:audit.observedAt,reason:'Current declared keyword India + typed India country selection only; unresolved role evidence and company-wide/empty-keyword country coverage; cleanup not authorized'})
  priority();return result
 }catch(error){
  requestsClosed=true;caller?.throwIfAborted();if(!stop.signal.aborted)stop.abort(error);await Promise.allSettled([...inflight]);caller?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){Object.assign(error,{abortRetries:true,lifecycleCleanupAllowed:false});if(!Object.hasOwn(error,'softFailure'))error.softFailure=true;error.failureKind||='coverage_gap';audit.failures.push({stage,requestUrl:error.requestUrl||safeURL(activeURL),status:boundedStatus(error.status)?error.status:null,message:error.message});audit.requestCount=receipts.length;audit.nativeRecords=audit.opening?.rows.length??0;error.recruitmentObservations=audit}
  caller?.throwIfAborted();throw error
 }finally{
  requestsClosed=true
  if(!stop.signal.aborted)stop.abort()
  try{await transport.close()}finally{caller?.throwIfAborted()}
 }
}
