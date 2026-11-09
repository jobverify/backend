import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SOURCE,CAREERS,HOME,KEYWORD,PROFILE,need,sha,readIkeaAuthority,readIkeaHome,readIkeaRole,sameNative} from './nativeContract.js'
import {declaredSearchClients,deriveIkeaSearchProfile,requestFor,readIkeaSelectedPage} from './searchContract.js'

const dispose=operation=>{try{void Promise.resolve(operation()).catch(()=>{})}catch{}}
const race=(promise,signal,late)=>new Promise((resolve,reject)=>{
 let settled=false
 const abort=()=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(signal.reason)}
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
 Promise.resolve(promise).then(value=>{if(settled){if(late)dispose(()=>late(value));return}settled=true;signal.removeEventListener('abort',abort);resolve(value)},error=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);reject(error)})
})
const safeURL=value=>{const u=new URL(value);return u.origin+u.pathname}
const boundedStatus=value=>Number.isInteger(value)&&value>=100&&value<=599
const batch=async(values,fn)=>{const results=[];for(let i=0;i<values.length;i+=3)results.push(...await Promise.all(values.slice(i,i+3).map(fn)));return results}
const roleProof=role=>Object.fromEntries(Object.entries(role).filter(([key])=>!['rawHTML','bodySHA256'].includes(key)))

async function defaultFetchPage(url,{signal,headers,receipt}){
 signal.throwIfAborted()
 const response=await race(fetch(url,{method:'GET',headers,credentials:'omit',redirect:'manual',signal}),signal,late=>late?.body?.cancel())
 if(signal.aborted){dispose(()=>response.body?.cancel());signal.throwIfAborted()}
 Object.assign(receipt,{status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')||''})
 if(Number(response.headers.get('content-length'))>4000000){dispose(()=>response.body?.cancel());need(false,'declared HTTP body exceeds byte cap')}
 let reader;const chunks=[];let bytes=0
 try{reader=response.body.getReader();for(;;){signal.throwIfAborted();const part=await race(reader.read(),signal);if(part.done)break;bytes+=part.value.byteLength;need(bytes<=4000000,'HTTP body exceeds byte cap');chunks.push(Buffer.from(part.value))}}
 finally{if(reader)dispose(()=>reader.cancel());else dispose(()=>response.body?.cancel())}
 signal.throwIfAborted();return{status:response.status,url:response.url,contentType:receipt.contentType,html:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks))}
}

export async function runIkeaNative({fetchPage,signal:caller,now=()=>new Date().toISOString(),timeoutMs=180000,requestTimeoutMs=20000,maxPages=16,maxDetails=200,onAudit}={}){
 caller?.throwIfAborted()
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000&&Number.isSafeInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=20000&&Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=16&&Number.isSafeInteger(maxDetails)&&maxDetails>0&&maxDetails<=200,'invalid bounded source budget')
 const stop=new AbortController(),aggregate=AbortSignal.timeout(timeoutMs),signal=AbortSignal.any([...(caller?[caller]:[]),aggregate,stop.signal]),allowed=new Set([CAREERS,HOME,KEYWORD]),receipts=[],inflight=new Set()
 let requestsClosed=false,totalBodyBytes=0,stage='employer-authority',activeURL=CAREERS
 const audit={source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,selectedScope:'keywordIndia+typedcountryIndia-only',receipts,failures:[],opening:null,closing:null,openingDetails:[],closingDetails:[],heldIndiaRoles:[],returnedIndiaJobs:0,applicationInteractions:0,publisherProgramsExecuted:false,nativeLegalEmployer:null}
 const priority=()=>{caller?.throwIfAborted();signal.throwIfAborted()}
 const get=async(url,{headers={Accept:'text/html,application/xhtml+xml'}}={})=>{
  priority();need(!requestsClosed&&allowed.has(url)&&receipts.length<450,'unreviewed request or bounded read cap');activeURL=url
  const receipt={sequence:receipts.length+1,requestedURL:url,method:'GET',requestHeaders:headers},attempt=AbortSignal.any([signal,AbortSignal.timeout(requestTimeoutMs)])
  const pending=(async()=>{
   priority();const page=await race(fetchPage?Promise.resolve().then(()=>{priority();return fetchPage(url,{signal:attempt,headers,method:'GET'})}):defaultFetchPage(url,{signal:attempt,headers,receipt}),attempt);priority()
   if(page&&typeof page==='object')Object.assign(receipt,{status:page.status??null,finalURL:page.url??null,contentType:page.contentType??null,...(typeof page.html==='string'?{bodyBytes:Buffer.byteLength(page.html),bodySHA256:sha(page.html),rawHTML:page.html}:{})})
   need(typeof page?.html==='string','HTTP body unavailable');totalBodyBytes+=Buffer.byteLength(page.html);need(Buffer.byteLength(page.html)<=4000000&&totalBodyBytes<=64*1024*1024,'bounded source response byte budget exceeded')
   if(page.status!==200){const error=Object.assign(Error('[ikea] public HTTP '+(boundedStatus(page.status)?page.status:'status unavailable')),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false});if(boundedStatus(page.status)){error.status=page.status;error.cause={status:page.status,requestUrl:safeURL(url)};if([401,403,406,429].includes(page.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})}throw error}
   need(page.url===url,'unreviewed redirect/final URL');return page
  })();receipts.push(receipt);inflight.add(pending)
  try{return await pending}catch(error){requestsClosed=true;caller?.throwIfAborted();if(stop.signal.aborted)throw error;if(error&&typeof error==='object'&&Object.isExtensible(error)){if(!Object.hasOwn(error,'requestUrl'))error.requestUrl=safeURL(url);if(boundedStatus(receipt.status)&&!Object.hasOwn(error,'status')){error.status=receipt.status;error.cause={status:receipt.status,requestUrl:safeURL(url)}}if([401,403,406,429].includes(receipt.status))Object.assign(error,{failureKind:'blocked_or_access_denied',upstreamOutage:true})}throw error}finally{inflight.delete(pending)}
 }
 const parseAt=async(url,parse,options)=>{const page=await get(url,options);try{return parse(page)}catch(error){if(error&&typeof error==='object'&&Object.isExtensible(error)&&!Object.hasOwn(error,'requestUrl'))error.requestUrl=safeURL(url);throw error}}
 const program=async url=>{allowed.add(url);const page=await get(url,{headers:{Accept:'application/javascript,text/javascript'}});need(/^application\/x-javascript(?:;|$)/i.test(page.contentType||'')&&sha(page.html)===PROFILE.clientHashes[url],'current declared native program MIME/hash changed');return page.html}
 try{
  audit.employerOpening=await parseAt(CAREERS,readIkeaAuthority);stage='native-home';audit.homeOpening=await parseAt(HOME,readIkeaHome)
  stage='native-search-profile';const initial=await get(KEYWORD),clientURLs=declaredSearchClients(initial),clients={};for(const url of clientURLs)clients[url]=await program(url)
  const profile=deriveIkeaSearchProfile(initial,clients);need(profile.pages<=maxPages&&profile.total<=maxDetails,'native pagination/detail budget insufficient');audit.searchOpening=profile
  const requests=Array.from({length:profile.pages},(_,i)=>requestFor(profile,i+1));for(const r of requests)allowed.add(r.url)
  const collect=()=>batch(requests,async(r,i)=>parseAt(r.url,p=>readIkeaSelectedPage(p,profile,requests.indexOf(r)+1),{headers:r.headers}))
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
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:KEYWORD,firstParty:true,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:audit.observedAt,reason:'Current declared keyword India + typed India country selection only; unresolved role evidence and company-wide/empty-keyword country coverage; cleanup not authorized'})
 }catch(error){
  requestsClosed=true;caller?.throwIfAborted();if(!stop.signal.aborted)stop.abort(error);await Promise.allSettled([...inflight]);caller?.throwIfAborted()
  if(error&&typeof error==='object'&&Object.isExtensible(error)){Object.assign(error,{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false});error.failureKind||='coverage_gap';audit.failures.push({stage,requestUrl:error.requestUrl||safeURL(activeURL),status:boundedStatus(error.status)?error.status:null,message:error.message});audit.requestCount=receipts.length;audit.nativeRecords=audit.opening?.rows.length??0;error.recruitmentObservations=audit}
  throw error
 }
}
