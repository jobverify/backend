import path from 'node:path'
import {fileURLToPath} from 'node:url'
import CATALOG from './catalog.js'
import {readPublishedCampaign} from './campaign20261107.js'
import {settingsFor,runtime,bounded,failure,annotateFailure,errorValue} from './runtime20261107.js'
import {nativeTransport,MAX_BYTES} from './transport20261107.js'
import {SOURCE,HOME,CAREERS_URL,readHomepage,readAnnouncements,attachAnnouncementEvidence} from './native20261107.js'

export {SOURCE,CAREERS_URL,extractJobsFromCareersPage,hasOfficialCareersSignal,hasOfficialHomepageSignal,extractHomepageCareersUrl} from './native20261107.js'
export const OFFICIAL_BRAND_NAME=CATALOG.officialBrandName,VERIFIED_AT=CATALOG.verifiedOn,VERIFIED_SURFACE_SUMMARY=CATALOG.verifiedSurfaceSummary,HOMEPAGE_URL=HOME,HOMEPAGE_LINKED_CAREERS_URL=CAREERS_URL,TRUSTED_OPENING_HOSTS=['careers.bhel.in']
export const PROVIDER_METADATA=CATALOG,COMPANY=CATALOG.companyName
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const diagnostic=error=>{const out={};for(const key of ['name','code','message','status','requestUrl','finalUrl','failureKind']){let value;try{value=errorValue(error,key)}catch{}if(typeof value==='string'||key==='status'&&Number.isInteger(value))out[key]=value}out.message??=typeof error==='string'?error:'Uninspectable native producer failure';return out}
const snapshot=value=>{
 const out={injected:true,originalEntityAvailable:false}
 for(const key of ['url','status','contentType','body','bodyComplete','bodyTruncated','rawBodyBase64','bodyBytes','receivedBodyBytes','bodyUnavailableReason','requestedAt','headersObservedAt','completedAt']){let v;try{v=errorValue(value,key)}catch{}if(v===null||['string','number','boolean'].includes(typeof v))out[key]=v}
 let headers;try{headers=errorValue(value,'headers')}catch{}
 try{out.headers=headers&&typeof headers==='object'?Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(headers)).filter(([,d])=>typeof d.value==='string').map(([k,d])=>[k.toLowerCase(),d.value])):null}catch{out.headers=null}
 return out
}
export const createBharatHeavyElectricalsScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options),rt=runtime(settings),receipts=[],attempts=[]
 let analysis={observedAnnouncements:[],withheldNativeFacts:[],unresolvedRows:[],duplicateRepresentations:[]},primaryQualified=false,observedAt=null,reason='native-announcements-await-original-role-proof',observerFailure=null,lastAudit=null,originalFailure,hadFailure=false,incompleteCollectionFailure=null,phase='company-homepage',currentURL=HOME,listingQualified=false,requestAdmitted=false,currentReceipt=null,nativeDeclaration=null
 const board={handoffs:[],nativeHomepageEvidence:null,nativeDocuments:[],nativeRoleCandidates:[],nativeCampaign:null,nativeCampaignComplete:false}
 const facts=()=>[...analysis.withheldNativeFacts,...board.nativeRoleCandidates]
 const summary=()=>({source:SOURCE,recordKind:'mixed',observedRecordCount:facts().length,observedVacancyCount:board.nativeRoleCandidates.length,unresolvedAnnouncementCount:analysis.observedAnnouncements.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 const collection=()=>({...summary(),...analysis,...board,withheldNativeFacts:facts(),status:'partial',reason,wholeCompanyScope:false,lifecycleCleanupAllowed:false,incompleteCollectionFailure,retainedNativeResponses:receipts,attempts,...(observerFailure?{observerFailure}:{})})
 const inventory=()=>({status:'coverage-gap',surface:CAREERS_URL,firstParty:listingQualified,listingComplete:false,pagesFetched:receipts.filter(r=>r.response.bodyComplete===true).length,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason})
 const retain=(response,url)=>{const prior=receipts.find(r=>r.url===url);if(prior)prior.response=response;else receipts.push({url,response});if(requestAdmitted&&url===currentURL)currentReceipt=response}
 const declare=context=>{phase=context.phase;currentURL=context.requestUrl??null;nativeDeclaration=context.nativeDeclaration;requestAdmitted=false;currentReceipt=null}
 const report=async(error=null)=>{
  const audit={...collection(),nativeCollectionEvidence:collection(),inventoryEvidence:inventory(),partialNativeRecords:facts(),partialNativeJobs:[],error:error===null?null:diagnostic(error)};lastAudit=audit
  if(settings.onAudit)try{await bounded(()=>settings.onAudit(structuredClone(audit)),{signal:rt.signal.aborted?undefined:rt.signal,timeoutMs:settings.auditTimeoutMs,code:'BHEL_AUDIT_TIMEOUT'})}catch(e){observerFailure=diagnostic(e);audit.observerFailure=observerFailure}
  return audit
 }
 const output=()=>{const jobs=attachAnnouncementEvidence([],collection(),inventory());if(hadFailure)Object.defineProperty(jobs,'nativeFailure',{value:originalFailure});return jobs}
 const physical=nativeTransport({timeoutMs:settings.readTimeoutMs,onReceipt:retain})
 async function read(url,kind='html',stage='company-homepage'){
  phase=stage;currentURL=url;requestAdmitted=false;currentReceipt=null;rt.admit();attempts.push({url,method:'GET',redirect:'manual',credentials:'omit',requestedAt:new Date().toISOString()});requestAdmitted=true
  if(!settings.fetchText&&!settings.fetchPage){const packet=await physical(url,{signal:rt.signal,expectedMime:kind});rt.check();return packet}
  return rt.read(async(signal,check)=>{
   let value=await (settings.fetchPage??settings.fetchText)(url,{method:'GET',redirect:'manual',credentials:'omit',signal,requestKind:kind})
   check()
   if(settings.fetchPage&&value&&typeof value==='object'){const html=errorValue(value,'html');if(typeof html==='string')value={...snapshot(value),body:html,bodyComplete:errorValue(value,'bodyComplete')??true}}
   const explicit=value&&typeof value==='object'&&Object.hasOwn(value,'body')
   if(!explicit&&typeof value!=='string'){
    retain({url,status:null,body:null,bodyComplete:false,rawBodyBase64:null,injected:true,originalEntityAvailable:false,bodyUnavailableReason:'Injected native body is neither text nor a typed receipt',unqualifiedBodyType:typeof value},url)
    throw Object.assign(failure('BHEL injected native body type unavailable','BHEL_NATIVE_PROOF'),{cause:value})
   }
   const packet=explicit?snapshot(value):{url,status:200,body:value,bodyComplete:true,injected:true,originalEntityAvailable:false}
   retain(packet,url)
   if(packet.url!==url||!Number.isInteger(packet.status))throw failure('BHEL injected response identity unavailable','BHEL_RESPONSE_IDENTITY')
   if(packet.status!==200)throw Object.assign(failure('BHEL HTTP '+packet.status,'BHEL_HTTP_RESPONSE'),{status:packet.status,requestUrl:url,finalUrl:packet.url,abortRetries:true})
   if(packet.bodyComplete!==true||packet.bodyTruncated===true)throw failure('BHEL incomplete native entity','BHEL_NATIVE_PROOF')
   if(['gzip-script','pdf'].includes(kind)){
    if(typeof packet.rawBodyBase64!=='string'&&typeof packet.body==='string')packet.rawBodyBase64=Buffer.from(packet.body).toString('base64')
    if(typeof packet.rawBodyBase64!=='string'||Buffer.from(packet.rawBodyBase64,'base64').length>MAX_BYTES)throw failure('BHEL original script bytes unavailable or oversized','BHEL_BODY_LIMIT')
   }else if(typeof packet.body!=='string')throw failure('BHEL injected native body unavailable','BHEL_NATIVE_PROOF')
   else if(Buffer.byteLength(packet.body)>MAX_BYTES)throw failure('BHEL injected native body exceeds limit','BHEL_BODY_LIMIT')
   return packet
  })
 }
 try{
  if(settings.maxJobs===0||settings.maxPages===0||settings.maxRequests===0){reason='caller-zero-budget';await report();rt.check();return output()}
  const primary=await read(HOME);board.nativeHomepageEvidence=readHomepage(primary.body);primaryQualified=true;rt.check()
  board.handoffs.push({kind:'company-declared-careers-portal',from:HOME,to:CAREERS_URL,allPublishedTargetsAgree:true})
  const careers=await read(CAREERS_URL,'html','native-careers-announcements')
  const clock=settings.now?settings.now():new Date().toISOString();if(typeof clock!=='string'||!Number.isFinite(Date.parse(clock)))throw failure('BHEL observation clock unavailable','BHEL_NATIVE_PROOF');observedAt=clock
  analysis=readAnnouncements(careers.body,clock);listingQualified=true;rt.check()
  if(analysis.unresolvedRows.length)reason='unclassified-native-announcement-rows'
  else{
   await readPublishedCampaign({read,declare,decode:async(bytes,url,stage)=>{phase=stage;currentURL=url;const parsed=await bounded(async(signal,check)=>{const {readBhelNativePdf}=await import('./pdf20261107.js');check();return readBhelNativePdf(bytes,{signal})},{signal:rt.signal,timeoutMs:settings.pdfTimeoutMs,code:'BHEL_PDF_TIMEOUT'});rt.check();return parsed}},analysis,board)
   reason='native-campaign-inventory-scope-unverified'
  }
  rt.check();await report();rt.check();return output()
 }catch(cause){
  if(!hadFailure){hadFailure=true;originalFailure=cause;incompleteCollectionFailure={...diagnostic(cause),phase,requestUrl:currentURL,status:requestAdmitted?(diagnostic(cause).status??currentReceipt?.status??null):null,requestAdmitted,...(nativeDeclaration?{nativeDeclaration}:{}),abortRetries:true}}
  reason='first-native-surface-failure';const audit=lastAudit??await report(cause)
  if(settings.signal?.aborted)throw settings.signal.reason
  let terminalCause=cause
  try{rt.check()}catch(error){terminalCause=error}
  if(primaryQualified&&!rt.signal.aborted)return output()
  throw annotateFailure(terminalCause,{firstNativeFailure:originalFailure,abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,partialNativeRecords:facts(),partialNativeJobs:[],retainedNativeResponses:receipts,inventoryEvidence:inventory(),nativeEvidence:audit})
 }finally{rt.close()}
}})
export const run=async(options={})=>createBharatHeavyElectricalsScraper(options).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
