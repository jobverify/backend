import {isDeepStrictEqual} from 'node:util'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {currentAuthority} from './currentPublisher20261120.js'
import {currentBoard,HOME as CAREERS_URL,BOARD as BOARD_URL,FEED as API_URL} from './currentCollection20261120.js'
import {qualifyV1Consumer} from './currentV1Consumer20261120.js'
import {fullModels} from './nativeInventory.js'
const RECRUITMENT_OBSERVATIONS=Symbol.for('jobverify.verified-recruitment-observations')
const CLIENT=BOARD_URL+'/embed',EMBED=BOARD_URL+'?embed=js',copy=structuredClone
const failure=message=>Object.assign(Error('[langchain] Current native contract: '+message),{source:'langchain',abortRetries:true,softFailure:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw failure(message)}
const comparable=n=>({authority:n.authority,consumer:n.consumer,organization:n.board.model.organization,board:n.board.model.jobBoard,payload:n.payload,models:n.models})
export const createLangchainNativeScraper=()=>({async run(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 need(!options.fetchPage&&!options.fetchText&&!options.fetchJson&&!options.fetchDocument,'Current original HTTP Response transport required')
 need(options.maxJobs===undefined||options.maxJobs===Infinity,'A partial caller job cap cannot certify native cohort reconciliation')
 const sourceStarted=performance.now(),sourceTimeoutMs=options.sourceTimeoutMs??180000
 const reader=createCurrentNativeReader(options,{source:'langchain',admitted:[[CAREERS_URL,'html']],learnedURL:(url,kind)=>url===CLIENT&&kind==='javascript'||url===EMBED&&kind==='html'||url===API_URL&&kind==='json'})
 const audit={source:'langchain',startedAt:new Date().toISOString(),recordKind:'vacancy-rows',observedRecordCount:0,observedVacancyCount:0,companyGlobalTotal:null,companyIndiaTotal:null,companyIndiaZeroProven:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,wholeNativeRoleModelsClosingReconciled:false,wholePublisherRawResponsesClosingEqual:false,nativeOpening:null,nativeClosing:null,rawPublisherResponses:[],observations:[],applicationsVisited:false,applicationInteractions:0,applicationSubmissions:0,downloadedJavaScriptExecuted:false,publicApplicationEligibilityQualified:false}
 try{
  const observedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString();reader.check();need(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'Finite observation timestamp required')
  const observe=async(fn,value)=>{
   reader.check();need(typeof fn==='function','Invalid native observer')
   const c=new AbortController(),signal=caller?AbortSignal.any([caller,c.signal]):c.signal,reason=new DOMException('LangChain source observer deadline exceeded','TimeoutError'),remaining=Math.max(1,sourceTimeoutMs-(performance.now()-sourceStarted)),timer=setTimeout(()=>c.abort(reason),remaining)
   let listener
   try{await Promise.race([Promise.resolve().then(()=>{reader.check();return fn(copy(value))}),new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})]);reader.check()}finally{clearTimeout(timer);if(listener)signal.removeEventListener('abort',listener)}
  }
  const read=async(url,phase)=>{const r=await reader.read(url);audit.rawPublisherResponses.push({phase,...r});reader.check();return r}
  const phase=async name=>{
   const home=await read(CAREERS_URL,name),authority=currentAuthority(home.body,observedAt);reader.check()
   need(authority.client===CLIENT&&authority.board===BOARD_URL,'Current own exact native handoff changed');reader.allow(CLIENT,'javascript')
   const program=await read(CLIENT,name),consumer=qualifyV1Consumer({homeHTML:home.body,program:program.body,homeURL:CAREERS_URL,boardURL:BOARD_URL,clientURL:CLIENT});reader.check()
   need(consumer.baseURL===BOARD_URL&&consumer.consumerURL===EMBED,'Current connected native unfiltered consumer changed');reader.allow(EMBED,'html')
   const html=await read(EMBED,name),board=currentBoard(html.body,EMBED,observedAt);reader.check()
   // This is the existing configured documented public posting feed. Its exact
   // account, complete identity set, employer and every workplace are bound to
   // the current own-declared consumer before any role is projected.
   reader.allow(API_URL,'json');const api=await read(API_URL,name),payload=readLiteralModel(api.body).value;reader.check()
   const native=fullModels(payload,{data:board.model,organization:board.model.organization,board:board.model.jobBoard},reader.check);reader.check()
   for(const model of native.models){
    const closed=findExplicitNativeClosure([model.nativeSourceRecord.descriptionPlain])
    model.nativeAuthoredClosure=closed??null
    if(closed){model.nativeQualification.complete=false;model.sourceDetailComplete=false;model.nativeQualification.unresolved.push('native-authored-role-explicitly-closed')}
    const wider=model.nativeAuthoredLocationRestrictions.filter(clause=>/\bopen to other EMEA locations\b/i.test(clause))
    model.nativeUnqualifiedAuthoredWorkplaceAlternatives=copy(wider)
    if(wider.length){model.nativeQualification.complete=false;model.nativeQualification.countryComplete=false;model.nativeQualification.worksiteComplete=false;model.sourceDetailComplete=false;model.nativeQualification.unresolved.push('native-authored-wider-workplace-alternatives-unresolved')}
   }
   reader.check();return {authority,consumer,board,payload,...native}
  }
  audit.nativeOpening=await phase('opening');audit.observedRecordCount=audit.nativeOpening.models.length;audit.observedVacancyCount=audit.nativeOpening.models.length
  audit.observations=audit.nativeOpening.models.map(model=>({id:model.id,sourceNativeRole:copy(model),qualified:model.nativeQualification.complete,india:model.nativeQualification.complete&&model.nativeCountryRelations.some(p=>p.country==='India')}))
  audit.nativeClosing=await phase('closing');reader.check()
  need(isDeepStrictEqual(comparable(audit.nativeOpening),comparable(audit.nativeClosing)),'Complete current employer/criteria/workplace/application/availability models changed at closing')
  audit.wholeNativeRoleModelsClosingReconciled=true
  audit.wholePublisherRawResponsesClosingEqual=audit.rawPublisherResponses.slice(0,4).every((r,i)=>r.body===audit.rawPublisherResponses[i+4].body)
  const jobs=[]
  for(const model of audit.nativeOpening.models){
   if(!model.nativeQualification.complete||!model.nativeCountryRelations.some(p=>p.country==='India'))continue
   const row=model.nativeSourceRecord,india=model.nativeCountryRelations.filter(p=>p.country==='India')
   jobs.push({source:'langchain',company:'LangChain',id:row.id,jobId:row.id,requisitionId:null,title:model.title,department:row.department,team:row.team,sourceUrl:row.jobUrl,applyUrl:row.applyUrl,link:row.applyUrl,country:'India',city:india.length===1?india[0].nativeAddress.addressLocality??null:null,state:india.length===1?india[0].nativeAddress.addressRegion??null:null,location:[...new Set(india.map(p=>p.location))].join(' / '),jobDescription:row.descriptionHtml,sourceDescription:row.descriptionHtml,nativeDescriptionHTML:row.descriptionHtml,nativeDescriptionPlain:row.descriptionPlain,nativeSourceRecord:copy(row),nativeFacts:copy(model),employmentType:row.employmentType,workplaceType:row.workplaceType,isRemote:row.isRemote,postingDate:row.publishedAt,nativePublication:copy(model.nativePublication),closingDate:null,firstEverPublication:null,legalEmployer:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,activeApplyVerified:false,officialAtsBinding:copy(audit.nativeOpening.authority),scrapedAt:observedAt})
  }
  audit.returnedIndiaJobs=jobs.length;audit.completedAt=new Date().toISOString();audit.nativeReads=reader.stats()
  if(options.onRecords)await observe(options.onRecords,audit.observations)
  if(options.onAudit)await observe(options.onAudit,audit)
  reader.check()
  attachSourceObservationEvidence(jobs,audit)
  Object.defineProperties(jobs,{nativeCollectionEvidence:{value:audit},sourceAudit:{value:audit},[RECRUITMENT_OBSERVATIONS]:{value:{source:'langchain',nativeRecords:audit.observedVacancyCount,returnedIndiaJobs:jobs.length,nativeInventoryAudit:audit}}})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:API_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:8,verifiedAt:observedAt,reason:'Complete paired configured native cohort retained; individual unknown workplaces held; company-wide inventory and cleanup remain unqualified.'})
  reader.check();caller?.throwIfAborted();return jobs
 }catch(error){
  caller?.throwIfAborted();audit.completedAt=new Date().toISOString();audit.nativeReads=reader.stats()
  if(error&&typeof error==='object')try{for(const key of ['nativeCollectionEvidence','recruitmentObservations'])Object.defineProperty(error,key,{value:audit,configurable:true})}catch{}
  caller?.throwIfAborted();throw error
 }finally{reader.close();caller?.throwIfAborted()}
}})
export const run=options=>createLangchainNativeScraper().run(options)
