import {setTimeout as delay} from 'node:timers/promises'
import {PRIMARY,parsePage,validatePage,facts,closingModelsMatch} from './data20261108.js'
import {settingsFor,runtime,bounded,failure,annotateFailure,errorValue} from './runtime20261108.js'
import {nativeTransport} from './transport20261108.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const failures=new WeakMap()
const need=(ok,message,code='BASE64AI_NATIVE_PROOF')=>{if(!ok)throw failure('Base64.ai native: '+message,code)}
const diagnostic=error=>Object.fromEntries(['name','code','message'].map(key=>{const value=errorValue(error,key);return[key,typeof value==='string'?value.slice(0,key==='message'?2048:128):null]}))
export const readBase64AIFailureEvidence=signal=>{const value=failures.get(signal);return value?structuredClone(value):null}

export const createBase64AINativeScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options);need(!settings.fetchPage||settings.fetchImpl,'Supply original streaming fetchImpl','BASE64AI_INVALID_OPTIONS')
 const filter=settings.countryFilter??'India';need(['India','Global'].includes(filter),'Unsupported country selection','BASE64AI_INVALID_OPTIONS')
 const control=runtime(settings),models={},rawResponses=[],auditSinkFailures=[]
 let observedAt=null,qualifiedAt=null,phase='current-primary',nextStart=-Infinity,closingVerified=false,openingBound=false,closingBound=false,firstCause=null,failureObserved=false
 const rows=()=>(models['current-primary']?.nativeRoles??[]).map((role,index)=>{
  const value=facts(role),bound=Boolean(value.identity&&openingBound&&(!models['closing-primary']||closingBound)),published=Boolean(closingVerified&&bound&&value.publication),qualified=Boolean(published&&value.criteria&&value.country)
  return{source:'base64ai',publisher:'Base64.ai',company:bound?'Base64.ai':null,sourceNativeEmployerName:bound?'Base64.ai':null,jobId:value.adapterKey,jobIdIsSynthetic:true,sourceNativePostingId:null,requisitionId:null,title:value.title,sourceUrl:PRIMARY,applyUrl:role.nativeApplications.length===1?role.nativeApplications[0].attrs.href:null,
   country:value.country,city:null,state:null,location:role.nativeLocation,employmentType:role.nativeEmploymentType,postingDate:null,closingDate:null,nativeObservationOrdinal:index,sourceNativeRecord:role,sourceNativeOwnDescriptionHTML:role.nativeContentHTML,sourceDescription:role.nativeContentHTML,jobDescription:role.nativeContentText,
   sourceNativeIdentityBound:bound,sourceNativeCurrentPublicationQualified:published,sourceNativeCriteriaComplete:Boolean(bound&&value.criteria),sourceCurrentNativeRoleQualified:qualified,sourceCountryScopeUnresolved:value.country===null,sourceNativeApplicationSubject:value.subject,sourceNativeDisclosureOpen:Object.hasOwn(role.nativeAttributes,'open'),sourceNativeCriteriaVisibilityQualified:false,sourceDetailComplete:Boolean(bound&&value.criteria),sourceScopeComplete:false,lifecycleCleanupAllowed:false,activeApplyVerified:false,applicationVisited:false,scrapedAt:observedAt}
 })
 const snapshot=()=>({source:'base64ai',recordKind:'vacancy-rows',observedRecordCount:models['current-primary']?.nativeRoles.length??0,observedVacancyCount:models['current-primary']?.nativeRoles.length??0,observedAt,qualifiedAt,phase,models,observations:rows(),rawResponses,auditSinkFailures,requestCount:control.requests,closingVerified,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,authoritativeIndiaZero:false,renderedCriteriaVisibilityQualified:false,activeHiringVerified:false,applicationActions:0,publisherProgramsExecuted:false})
 const readModel=async label=>{
  phase=label;control.check();const at=Math.max(performance.now(),nextStart);nextStart=at+(settings.rateLimitMs??500)
  if(at>performance.now()){try{await delay(at-performance.now(),undefined,{signal:control.signal})}catch(error){control.check();throw error}}
  control.check();control.admit();let receipt=null
  const packet=await nativeTransport({timeoutMs:settings.readTimeoutMs,fetchImpl:settings.fetchImpl??globalThis.fetch,callerSignal:settings.signal,onReceipt:response=>{if(!receipt){receipt={requestedURL:PRIMARY,phase:label,response};rawResponses.push(receipt)}}})(PRIMARY,{signal:control.signal,expectedMime:'html',headers:{Accept:'text/html'}})
  let model;try{model=parsePage(packet.body,PRIMARY)}catch(error){throw annotateFailure(error,{code:'BASE64AI_NATIVE_PROOF'})}
  models[label]=model;control.check();
  if(model.nativeSections.length===0&&/\/_Incapsula_Resource(?:\?|[\"'])/i.test(packet.body)&&/Request unsuccessful\.?\s*Incapsula incident ID:/i.test(packet.body))throw Object.assign(failure('Base64.ai explicit HTTP200 denial document','BASE64AI_ACCESS_DENIED'),{status:packet.status,failureKind:'blocked_or_access_denied',softFailure:true,upstreamOutage:true,abortRetries:true})
  return model
 }
 try{
  const date=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(+date),'Invalid observation time','BASE64AI_INVALID_OPTIONS');observedAt=date.toISOString()
  const opening=await readModel('current-primary');validatePage(opening);openingBound=true
  const closing=await readModel('closing-primary');validatePage(closing);closingBound=true
  need(closingModelsMatch(opening,closing),'Closing full native roles or publisher routing changed','BASE64AI_NATIVE_CLOSING_CONFLICT')
  const complete=new Date((settings.now??(()=>new Date()))());need(Number.isFinite(+complete),'Invalid closing observation time','BASE64AI_INVALID_OPTIONS');qualifiedAt=complete.toISOString();closingVerified=true
 }catch(error){firstCause=error;failureObserved=true}
 try{
  for(const[name,sink]of[['audit',settings.onAudit],['records',settings.onRecords]])if(sink){
   try{control.check()}catch(error){if(!failureObserved){firstCause=error;failureObserved=true}break}
   try{await bounded(async(signal,check)=>{const guard=()=>{control.check();check()};guard();const value=structuredClone(name==='audit'?snapshot():rows());guard();await sink(value,{signal},guard);guard()},{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'BASE64AI_AUDIT_TIMEOUT'})}
   catch(error){settings.signal?.throwIfAborted();if(failureObserved)auditSinkFailures.push({sink:name,...diagnostic(error)});else{firstCause=error;failureObserved=true}}
  }
  settings.signal?.throwIfAborted()
  if(failureObserved)throw annotateFailure(firstCause,{source:'base64ai',nativeEvidence:structuredClone(snapshot()),sourceScopeComplete:false,lifecycleCleanupAllowed:false,abortRetries:true,failureKind:errorValue(firstCause,'failureKind')??'incomplete_listing',...(['BASE64AI_NATIVE_PROOF','BASE64AI_NATIVE_CLOSING_CONFLICT'].includes(errorValue(firstCause,'code'))?{softFailure:true,upstreamOutage:false,failureKind:'coverage_gap'}:{})})
  control.check()
  const selected=rows().filter(row=>row.sourceCurrentNativeRoleQualified&&(filter==='Global'||row.country==='India')),jobs=structuredClone(settings.maxJobs===null?selected:selected.slice(0,settings.maxJobs)),audit=structuredClone(snapshot())
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit});Object.defineProperty(jobs,'sourceAudit',{value:audit});attachSourceObservationEvidence(jobs,audit)
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:PRIMARY,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:control.requests,verifiedAt:qualifiedAt,reason:'Complete observed native roles and full authored criteria retained;whole-company inventory,India-zero,rendered criteria,current hiring/application and cleanup remain unqualified'})
 }catch(error){if(settings.signal?.aborted){failures.set(settings.signal,structuredClone(snapshot()));throw settings.signal.reason}throw error}finally{control.close()}
}})
