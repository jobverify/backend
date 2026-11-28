import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {isDeepStrictEqual} from 'node:util'
import {createValuticoReader} from './nativeTransport20261121.js'
import {readProtocol} from './nativeProtocol20261121.js'
import {SOURCE,HOME,ROOT,CAREERS,API_ACCOUNT,modernCode,jobAPI,readCorporate,readModernShell,readAccount,readJob,need} from './nativeData20261121.js'
const now=()=>new Date().toISOString()
const incomplete=card=>({legacyNativeId:card.legacyNativeId,corporateCard:structuredClone(card),nativeJob:null,nativeCountry:null,nativePublicationDate:null,currentCounterpartObserved:false,sourceRoleQualified:false,sourceCountryQualifiedForIndia:false,activeApplyVerified:false,qualificationIssues:['current-native-counterpart-unobserved']})
function projection(phase){
 return{corporate:phase.corporate,programmes:phase.programmes,account:phase.account,roles:phase.roles.map(r=>({card:r.card,shell:r.shell,nativeJob:r.nativeJob}))}
}
function copyAuditValue(target,key,value){try{if(target&&(typeof target==='object'||typeof target==='function'))Object.defineProperty(target,key,{value,configurable:true})}catch{}}
export async function runCurrentValutico(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 const reader=createValuticoReader(options),startedAt=now(),rawPublisherResponses=[],observations=[],phases={opening:null,closing:null}
 let closingReconciled=false,finishedAt=null,errorReason=null,returnedJobs=null
 const audit=()=>({
  source:SOURCE,employer:'Valutico',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,startedAt,finishedAt:finishedAt??now(),nativeRoleObservations:structuredClone(observations),
  opening:phases.opening,closing:phases.closing,rawPublisherResponses:structuredClone(rawPublisherResponses),
  wholeNativeRoleModelsClosingReconciled:closingReconciled,
  configuredNativeCohortObserved:observations.length,configuredNativeCohortComplete:closingReconciled,
  companyIndiaTotal:null,companyGlobalTotal:null,sourceScopeComplete:false,companyScopeComplete:false,lifecycleCleanupAllowed:false,
  activeApplyVerified:false,applicationInteractions:0,applicationSubmissions:0,nativeWithCredentials:true,acquisitionCredentials:'omit',cookieJarUsed:false,browserExecution:false,browserEquivalenceClaimed:false,
  sourceCountryQualification:'Only complete role-published country fields and matching own corporate card countries; no city/remote/office inference.',
  applicationQualification:'Own Apply Now declaration and same-account current role canonical retained; form execution, intake fields and submission are unverified.',
  observationsQualification:'Raw native publication dates are preserved. A public approved native record is not relabelled as newly posted; held/foreign/unobserved records are never emitted as India.',
  closingQualification:'Complete raw native account and role DTOs, all retained card/shell bindings and consumed public protocol projections are compared. Corporate recruitment models are semantic; complete publisher HTML and HTTP metadata are separately retained without claiming whole-document byte equality.',
  inventoryQualification:'Only the currently authored own corporate card cohort. No source/company-wide completeness, totals, closure or lifecycle cleanup permission.',
  transport:reader.stats(),failure:errorReason?{name:errorReason?.name??null,message:errorReason?.message??String(errorReason),code:errorReason?.code??null,httpStatus:errorReason?.httpStatus??null}:null,
 })
 const read=async(url,admission)=>{
  try{
   const row=await reader.read(url,admission);rawPublisherResponses.push({...row,observedAt:now()});reader.check();return row
  }catch(error){caller?.throwIfAborted();throw error}
 }
 async function corporate(url){
  reader.allow(url,'html')
  const row=await read(url,url===HOME?{allowFinal:u=>u===ROOT,allowRedirect:l=>l===ROOT}:{})
  if(row.location){reader.allow(ROOT,'html');const target=await read(ROOT);return readCorporate(target.body,target.finalURL)}
  return readCorporate(row.body,row.finalURL)
 }
 async function shell(card){
  reader.allow(card.legacyURL,'html')
  const numericURL='https://apply.workable.com/valutico-2/jobs/'+card.legacyNativeId
  const modernTarget=literal=>{
   if(modernCode(literal)!==null)return literal
   if(/^\/valutico-2\/j\/[A-F0-9]{10}\/?$/.test(literal))return new URL(literal,numericURL).href
   return null
  }
  let row=await read(card.legacyURL,{allowFinal:u=>modernCode(u)!==null,allowRedirect:l=>l===numericURL||modernCode(l)!==null})
  if(row.location){
   const target=row.location;reader.allow(target,'html')
   row=await read(target,target===numericURL?{allowFinal:u=>modernCode(u)!==null,allowRedirect:l=>modernTarget(l)!==null}:{})
   if(row.location){const modern=modernTarget(row.location);reader.allow(modern,'html');row=await read(modern)}
  }
  return readModernShell(row.body,row.finalURL,card)
 }
 async function collect(phaseName){
  const phase={phase:phaseName,startedAt:now(),corporate:null,programmes:[],account:null,roles:[],completedAt:null}
  phases[phaseName]=phase
  const root=await corporate(HOME),careers=await corporate(root.careersURL)
  phase.corporate={root,careers}
  if(phaseName==='opening')for(const card of careers.cards)observations.push(incomplete(card))
  // The complete closing card cohort must match before any role can qualify.
  if(phaseName==='closing')need(isDeepStrictEqual(phase.corporate,phases.opening.corporate),'Own corporate hiring/card model changed at closing')
  const clients=new Map
  for(const card of careers.cards){
   const record={card:structuredClone(card),shell:null,nativeJob:null};phase.roles.push(record)
   const boundShell=await shell(card);record.shell=boundShell
   if(!clients.has(boundShell.clientURL)){
    reader.allow(boundShell.clientURL,'javascript');const programme=await read(boundShell.clientURL),protocol=readProtocol(programme.body)
    clients.set(boundShell.clientURL,protocol);phase.programmes.push({url:boundShell.clientURL,protocol})
   }
   if(!phase.account){
    reader.allow(API_ACCOUNT,'json');const entity=await read(API_ACCOUNT)
    // Retain even a failed full native account model before identity parsing.
    phase.rawAccount=entity.body;phase.account=readAccount(entity.body)
   }
   const apiURL=jobAPI(boundShell.shortcode);reader.allow(apiURL,'json')
   const entity=await read(apiURL)
   record.rawJob=entity.body
   const observed=readJob(entity.body,phase.account,card,boundShell);record.nativeJob=structuredClone(observed.nativeJob)
   if(root.unboundEligibility.length||careers.unboundEligibility.length){observed.roleFactsQualified=false;observed.sourceCountryQualifiedForIndia=false;observed.qualificationIssues.push('unbound-corporate-eligibility');observed.unboundCorporateEligibility=[...root.unboundEligibility,...careers.unboundEligibility]}
   if(phaseName==='opening'){
    const index=observations.findIndex(o=>o.legacyNativeId===card.legacyNativeId)
    observations[index]=observed
   }
   reader.check()
  }
  phase.completedAt=now();reader.check();return phase
 }
 try{
  const opening=await collect('opening'),closing=await collect('closing')
  need(isDeepStrictEqual(projection(opening),projection(closing)),'Whole current native account/role/criteria/application models changed at closing')
  // Reconciliation is granted only after the complete comparison succeeds.
  closingReconciled=true
  for(const observation of observations){
   observation.wholeNativeModelClosingReconciled=true
   observation.sourceRoleQualified=observation.roleFactsQualified&&observation.sourceCountryQualifiedForIndia
  }
  const jobs=observations.filter(o=>o.sourceRoleQualified).map(o=>({
   title:o.nativeJob.title,jobId:String(o.legacyNativeId),source:SOURCE,company:'Valutico',
   location:o.nativeCountries.map(v=>[v.city,v.country].filter(Boolean).join(', ')).join('; '),
   country:'India',url:o.currentApplicationRoleURL,sourceUrl:o.currentApplicationRoleURL,applyUrl:o.applicationDeclaration.literalHref,link:o.applicationDeclaration.literalHref,
   jobDescription:o.sourceDescription,sourceDescription:o.sourceDescription,postingDate:o.nativePublicationDate,postingDatePublished:true,
   closingDate:null,closingDatePublished:false,requisitionId:o.nativeJob.code||null,scrapedAt:now(),
   sourceNativeJob:structuredClone(o.nativeJob),sourceNativeAccount:structuredClone(opening.account),
   sourceNativeApplicationDeclaration:structuredClone(o.applicationDeclaration),sourceNativePublicationDate:o.nativePublicationDate,
   sourceNativeCountry:o.nativeCountry,sourceCountryQualifiedForIndia:true,sourceRoleQualified:true,sourceDetailComplete:true,
   activeApplyVerified:false,sourceScopeComplete:false,companyScopeComplete:false,lifecycleCleanupAllowed:false,
  }))
  finishedAt=now();attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null});reader.check();const evidence=audit()
  need(Buffer.byteLength(JSON.stringify(evidence))<=96*1024*1024,'Native evidence byte ceiling exceeded')
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:reader.stats().requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'whole-current-own-card-cohort-reconciled;company-scope-unknown;cleanup-forbidden'})
  reader.check();caller?.throwIfAborted();returnedJobs=jobs;return jobs
 }catch(error){
  caller?.throwIfAborted();errorReason=error;finishedAt=now()
  const evidence=audit();copyAuditValue(error,'nativeCollectionEvidence',evidence)
  if(!Number.isInteger(error?.httpStatus))try{reader.check()}catch(deadlineError){caller?.throwIfAborted();errorReason=deadlineError;copyAuditValue(deadlineError,'nativeCollectionEvidence',evidence);caller?.throwIfAborted();throw deadlineError}
  caller?.throwIfAborted();throw error
 }finally{
  // Closing an owned source may synchronously trigger a caller cancellation.
  // The caller's exact reason still owns both success and failure boundaries.
  const closeFailure=await reader.close();caller?.throwIfAborted()
  if(closeFailure)errorReason=closeFailure
  // Audit only the settled owned transport. A late known HTTP denial takes
  // priority over our local timer; an exact caller reason still wins.
  if(errorReason||returnedJobs){
   finishedAt=now();const finalEvidence=audit()
   copyAuditValue(errorReason??returnedJobs,'nativeCollectionEvidence',finalEvidence)
   caller?.throwIfAborted()
   if(!Number.isInteger(errorReason?.httpStatus))try{reader.checkFinal()}catch(finalError){
  // eslint-disable-next-line no-unsafe-finally -- After owned close, reviewed late HTTP/final deadline priority intentionally replaces provisional failures; exact caller checks precede this throw.
    caller?.throwIfAborted();errorReason=finalError;copyAuditValue(finalError,'nativeCollectionEvidence',audit());caller?.throwIfAborted();throw finalError
   }
  }
  // eslint-disable-next-line no-unsafe-finally -- After owned close, reviewed late HTTP/final deadline priority intentionally replaces provisional failures; exact caller checks precede this throw.
  if(closeFailure)throw closeFailure
  caller?.throwIfAborted()
 }
}
