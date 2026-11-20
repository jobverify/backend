import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {plain} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader} from './currentTransport20261120.js'
import {readCurrentDocument} from './currentNativeData20261120.js'
import {countryMentions,readAuthoredRoleStatements} from './currentAuthoredStatements20261120.js'

export const SOURCE='merckkgaa',COMPANY='Merck KGaA',ORIGIN='https://careers.merckgroup.com',CAREERS=ORIGIN+'/global/en',SEARCH=CAREERS+'/search-results',API=ORIGIN+'/widgets',REF='MQAMKDGLOBAL'
export const NATIVE_EMPLOYERS=['Sigma-Aldrich Chemicals Private Limited','Merck Life Science Private Limited','Merck Specialities Pvt. Ltd.']
const fail=message=>Object.assign(Error('Merck current publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
export function nativeDate(raw,label,observedAt,deadline=false){
 need(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(raw)&&Number.isFinite(Date.parse(raw))&&new Date(raw.slice(0,10)).toISOString().slice(0,10)===raw.slice(0,10),'Malformed original '+label)
 const milliseconds=Date.parse(raw);need(deadline?milliseconds+(raw.length===10?86399999:0)>=Date.parse(observedAt):milliseconds<=Date.parse(observedAt),'Expired or future original '+label)
 return {raw,milliseconds,precision:raw.length===10?'calendar-day':'timestamp'}
}
const checkContext=(document,pageName)=>{
 const c=document.context;need(c.refNum===REF&&c.widgetApiEndpoint===API&&c.baseDomain===ORIGIN&&c.rootDomain===ORIGIN&&c.baseUrl===CAREERS+'/'&&c.locale==='en_global'&&c.country==='global'&&c.siteType==='external'&&c.pageName===pageName,'Wrong current native publisher/account/context')
 return c
}
export function currentQuery(document){
 const c=checkContext(document,'search-results'),facets=document.model.eagerLoadRefineSearch?.data?.aggregations
 need(Array.isArray(facets)&&facets.filter(row=>row.field==='country'&&Number.isSafeInteger(row.value?.India)&&row.value.India>=0).length===1,'Current native explicit India facet unavailable')
 need(c.pageId==='page21','Current native search layout changed')
 // This finite read-only descriptor is the exact request emitted by the current
 // ordinary India checkbox and Most recent control, retained in browser evidence.
 return {lang:c.locale,deviceType:'desktop',country:c.country,pageName:c.pageName,ddoKey:'refineSearch',sortBy:'Most recent',subsearch:'',from:0,irs:false,jobs:true,counts:true,
  all_fields:['country','state','city','category','jobLevelId','type'],size:10,clearAll:false,jdsource:'facets',isSliderEnable:false,pageId:c.pageId+'-ds',siteType:c.siteType,keywords:'',global:true,selected_fields:{country:['India']},sort:{order:'desc',field:'postedDate'},locationData:{}}
}
export function parseCurrentListing(body,{closing=false}={}){
 const model=readLiteralModel(body).value,row=model.refineSearch
 need(row?.status===200&&Number.isSafeInteger(row.hits)&&Number.isSafeInteger(row.totalHits)&&row.totalHits>=row.hits&&row.hits>=0&&row.hits<=10&&Array.isArray(row.data?.jobs)&&row.data.jobs.length===row.hits,'Current native query publication shape changed')
 need(new Set(row.data.jobs.map(r=>r.jobId)).size===row.hits,'Duplicated native vacancy identity')
 for(const job of row.data.jobs){
  need(/^\d+$/.test(job.jobId)&&job.reqId===job.jobId&&job.title&&job.jobSeqNo===REF+job.jobId+'EXTERNALENGLOBAL','Current native query identity shape changed')
  if(!closing)need(job.country==='India'&&job.locale==='en_GLOBAL'&&job.siteType==='external'&&job.visibilityType==='External'&&job.jobVisibility?.includes('external')&&job.externalApply===false,'Current native published query identity/country/visibility disagrees')
 }
 return {original:model,publication:{status:row.status,hits:row.hits,totalHits:row.totalHits,data:row.data},jobs:row.data.jobs}
}
function reconcileCurrentQuery(opening,closing,observedAt){
 const withoutJobs=model=>({...model.publication,data:{...model.publication.data,jobs:null}})
 need(same(withoutJobs(opening),withoutJobs(closing)),'Closing native query metadata changed')
 const original=new Map(opening.jobs.map(r=>[r.jobId,r])),final=new Map(closing.jobs.map(r=>[r.jobId,r]))
 const removed=opening.jobs.filter(r=>!final.has(r.jobId)),added=closing.jobs.filter(r=>!original.has(r.jobId)),queryMatch=same(opening.publication,closing.publication)
 let boundary=null
 if(removed.length||added.length){
  need(opening.jobs.length===10&&closing.jobs.length===10&&removed.length===added.length,'Closing native query page membership changed outside bounded date tie')
  boundary=nativeDate(opening.jobs.at(-1).postedDate,'index boundary publication',observedAt)
  need(nativeDate(closing.jobs.at(-1).postedDate,'closing index boundary publication',observedAt).milliseconds===boundary.milliseconds
   &&[...removed,...added].every(row=>nativeDate(row.postedDate,'index tie publication',observedAt).milliseconds===boundary.milliseconds),'Closing native query membership changed outside same-date boundary')
 }
 return {queryMatch,closingById:final,evidence:{kind:queryMatch?'exact-query-business-model':'bounded-query-change-with-independent-current-role-and-application-closing',
  boundaryPublication:boundary,closingNewUnenrichedRows:added,independentlyClosedOpeningRowsOutsideClosingPage:removed,
  changedCommonRows:opening.jobs.filter(row=>final.has(row.jobId)&&!same(row,final.get(row.jobId))).map(row=>({original:row,closing:final.get(row.jobId)})),
  newClosingRowsQualified:false,companyCoverageVerified:false}}
}
export const currentRoleURL=row=>CAREERS+'/job/'+row.jobId+'/'+encodeURIComponent(row.title)
export const currentApplicationURL=row=>CAREERS+'/apply?jobSeqNo='+row.jobSeqNo
function tuple(value,country,city,state){
 const parts=String(value??'').split(',').map(r=>r.trim());need(parts.length>=2&&parts.length<=3&&parts.every(Boolean)&&!/[;|/\\]/.test(value)&&countryName(parts.at(-1))===country&&parts[0]===city&&parts.slice(0,-1).every(r=>!countryName(r))&&(parts.length!==3||!state||parts[1]===state),'Contradictory whole native workplace tuple')
}
function place(value){
 const country=countryName(value?.country??value?.standardisedCountry),city=value?.city??value?.standardisedCity,state=value?.state??value?.standardisedState
 need(country&&typeof city==='string'&&city&&typeof state==='string','Unqualified native typed workplace')
 if(value.location)tuple(value.location,country,city,state)
 return {country,city,state,original:value}
}
export function qualifyCurrentRole(document,listing,application,observedAt,closingListing=listing){
 checkContext(document,'job');checkContext(application,'apply')
 const wrapper=document.model.jobDetail,job=wrapper?.data?.job,schemas=document.schemas
 need(wrapper?.status===200&&wrapper.hits===1&&job&&schemas.length===1,'Current exact native role model/schema absent')
 const schema=schemas[0],nativeSchema=job.structureData,employer=schema.hiringOrganization?.name,id=listing.jobId,seq=listing.jobSeqNo
 need(NATIVE_EMPLOYERS.includes(employer)&&schema.identifier?.name===employer&&nativeSchema?.hiringOrganization?.name===employer&&nativeSchema.identifier?.name===employer,'Other or conflicting native legal employer')
 if(closingListing){
  need(closingListing.jobId===id&&closingListing.reqId===id&&closingListing.jobSeqNo===seq&&closingListing.title===job.title&&closingListing.country==='India'
   &&closingListing.locale==='en_GLOBAL'&&closingListing.siteType==='external'&&closingListing.visibilityType==='External'&&closingListing.jobVisibility?.includes('external')&&closingListing.externalApply===false,'Closing native listing identity/country/visibility contradiction')
  for(const key of ['employer','employerName','company','sourceLegalEmployer'])if(closingListing[key]!=null)need([COMPANY,'Merck',employer].includes(closingListing[key]),'Closing native listing employer contradiction')
  if(closingListing.hiringOrganization!=null)need(closingListing.hiringOrganization.name===employer,'Closing native hiring organization contradiction')
 }
 for(const key of ['jobId','reqId','jobReqId','cmsJobId'])need(job[key]===id,'Native requisition identity disagrees: '+key)
 need(job.title===listing.title&&schema.title===job.title&&nativeSchema.title===job.title&&String(schema.identifier.value)===id&&String(nativeSchema.identifier.value)===id&&job.jobSeqNo===seq&&job.refNum===REF&&job.parentRefNum===REF,'Native title/schema/account identity disagrees')
 // Updated is an authored synchronization state of current Open/Approved rows,
 // independently published by this live query and same-role application context.
 need(job.jobStatus==='Approved'&&job.successFactorsStatus==='Open'&&['Success','Updated'].includes(job.atsStatus)&&['Success','Updated'].includes(job.postingStatus)&&job.displayCareerSite===true&&job.OpenAndNotPosted==='false'&&job.skipJob===false&&job.isConfidential===false&&job.confidential?.isConfidential===false,'Native role is closed, private or unpublished')
 need(job.siteType==='external'&&job.visibilityType==='External'&&job.careerSiteType==='External'&&job.jobVisibility?.includes('external')&&job.visibilitySiteType?.includes('external')&&job.locale==='en_GLOBAL'&&job.externalApply===false&&job.imExternalApply===false,'Native public publication/application mode changed')
 const city=job.city,state=job.state;need(city===listing.city&&state===listing.state&&typeof city==='string'&&city&&typeof state==='string','Native primary city/state disagrees')
 for(const key of ['country','standardisedCountry','ml_country'])need(countryName(job[key])==='India','Native primary country disagrees: '+key)
 tuple(job.location,'India',city,state);tuple(listing.location,'India',city,state)
 if(closingListing){need(closingListing.city===city&&closingListing.state===state,'Closing native primary city/state contradiction');tuple(closingListing.location,'India',city,state)}
 const places=[...(job.multi_location??[]).map(place),...(job.standardised_multi_location??[]).map(place)]
 need(places.length>0&&places.some(p=>p.country==='India'&&p.city===city&&p.state===state),'Native primary typed workplace missing')
 for(const carrier of [schema,nativeSchema]){
  const entries=Array.isArray(carrier.jobLocation)?carrier.jobLocation:[carrier.jobLocation]
  need(entries.length>0&&entries.every(p=>countryName(p?.address?.addressCountry)==='India'&&p.address.addressLocality===city&&p.address.addressRegion===state),'Native original schema workplace disagrees')
 }
 const geography={countries:[...new Set(['India',...places.map(p=>p.country)])],originalPlaces:[{country:'India',city,state,originalLocation:job.location},...places.map(p=>({country:p.country,city:p.city,state:p.state,originalPlace:p.original}))]}
 need(countryMentions(job.location,geography).every(c=>c==='India'),'Mixed primary country tuple')
 for(const carrier of [listing,closingListing].filter(Boolean))for(const raw of carrier.multi_location??[])need(typeof raw==='string'&&places.some(p=>{try{tuple(raw,p.country,p.city,p.state);return true}catch{return false}}),'Native listing workplace conflicts with typed detail')
 const canonical=schema.hiringOrganization?.url,canonicalURL=typeof canonical==='string'?new URL(canonical):null
 need(canonicalURL&&canonicalURL.origin===ORIGIN&&canonicalURL.href===canonical&&!canonicalURL.username&&!canonicalURL.password&&new RegExp('^/global/en/job/'+id+'/[^/]+$').test(canonicalURL.pathname)&&!canonicalURL.search&&!canonicalURL.hash&&(!document.canonical||document.canonical===canonical),'Native own canonical role identity disagrees')
 const appModel=application.model.response,app=appModel?.response,data=app?.jobData
 need(appModel?.STATUS==='success'&&appModel.token===''&&app?.status==='pageLoaded'&&app.statusCode==='PAGE_LOADED'&&app.jobId===id&&app.jobSeqNo===seq&&app.jobTitle===job.title&&app.refNum===REF&&app.js_env==='PROD'&&app.channelType==='careerSite','Native current application context is wrong-role, closed or nonproduction')
 need(app.jobCountry==='India'&&app.jobLocation===job.location&&data?.jobId===id&&data.cmsJobId===id&&data.jobSeqNo===seq&&data.jobTitle===job.title&&data.country==='India'&&data.jobCountry==='India'&&data.siteType==='external'&&data.visibilitySiteType?.includes('external')&&data.locale==='en_GLOBAL'&&same(data.multi_location,job.multi_location),'Native current application workplace/identity disagrees')
 need(app.atsSpecificData?.applyMaintenance==='false'&&data.applyUrl===job.applyUrl,'Native application unavailable or stored ATS binding changed')
 const stored=new URL(job.applyUrl)
 need(stored.origin==='https://career5.successfactors.eu'&&stored.pathname==='/career'&&!stored.username&&!stored.password&&!stored.hash&&stored.searchParams.size===4&&stored.searchParams.get('company')==='merckgroup'&&stored.searchParams.get('career_ns')==='job_application'&&stored.searchParams.get('career_job_req_id')===id&&stored.searchParams.get('jobPipeline')==='Direct','Stored original ATS binding is foreign or wrong-requisition')
 for(const carrier of [listing,closingListing,job,schema,nativeSchema,data].filter(Boolean)){
  for(const key of ['countryCode','addressCountry','jobCountry'])if(carrier[key]!=null&&carrier[key]!=='')need(countryName(carrier[key])==='India','Additional explicit country contradiction: '+key)
  for(const key of ['closed','isClosed','expired','isExpired','archived','disabled','isTest','isDummy'])if(carrier[key]!=null)need(carrier[key]===false,'Native availability conflict: '+key)
  for(const key of ['isActive','isPublished','allowApplications','canApply','isOpen','posted','published'])if(carrier[key]!=null)need(carrier[key]===true,'Native availability disabled: '+key)
  for(const key of ['status','publicationStatus','availabilityStatus'])if(carrier[key]!=null)need(typeof carrier[key]==='string'&&/^(?:open|approved|active|published)$/i.test(carrier[key]),'Native availability status conflict: '+key)
 }
 if(closingListing?.jobStatus!=null)need(/^(?:open|approved|active|published)$/i.test(closingListing.jobStatus),'Closing native job status conflict')
 const authored=readAuthoredRoleStatements({listing,closingListing,job,schema,application:data},{failure:fail,validateDate:nativeDate,observedAt,geography,employerNames:[COMPANY,employer,'Merck']})
 const publications=[...authored.publications],deadlines=[...authored.deadlines]
 for(const [origin,carrier] of Object.entries({listing,closingListing,job,schema,nativeSchema,application:app,applicationJob:data}).filter(([,value])=>value)){
  for(const key of ['datePosted','postedDate','postingDate','publishedAt'])if(carrier[key]!=null&&carrier[key]!=='')publications.push({field:origin+'.'+key,...nativeDate(carrier[key],'publication',observedAt)})
  for(const key of ['validThrough','applicationDeadline','closingDate','expiryDate','expiresAt','expirationDate','endDate'])if(carrier[key]!=null&&carrier[key]!=='')deadlines.push({field:origin+'.'+key,...nativeDate(carrier[key],'deadline',observedAt,true)})
 }
 if(closingListing){
  const qualifiedFields=new Set(['jobId','reqId','title','jobSeqNo','country','countryCode','jobCountry','addressCountry','city','state','location','multi_location','locale','siteType','visibilityType','jobVisibility','externalApply','employer','employerName','company','sourceLegalEmployer','hiringOrganization','status','jobStatus','publicationStatus','availabilityStatus',
   'closed','isClosed','expired','isExpired','archived','disabled','isTest','isDummy','isActive','isPublished','allowApplications','canApply','isOpen','posted','published','datePosted','postedDate','postingDate','publishedAt','validThrough','applicationDeadline','closingDate','expiryDate','expiresAt','expirationDate','endDate'])
  const unreviewed=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!qualifiedFields.has(key)&&!/description|criteria|qualification|requirement|header|footer|html$/i.test(key)))
  need(same(unreviewed(listing),unreviewed(closingListing)),'Unreviewed closing listing business fields changed')
 }
 need(job.postedDateTrack==null||Array.isArray(job.postedDateTrack),'Malformed original posted-date history')
 for(const [index,raw] of (job.postedDateTrack??[]).entries())publications.push({field:'job.postedDateTrack['+index+']',...nativeDate(raw,'publication',observedAt)})
 const first=publications.toSorted((a,b)=>a.milliseconds-b.milliseconds)[0],description=plain(job.description),calendarDays=[...new Set(publications.map(p=>p.raw.slice(0,10)))]
 return {jobId:SOURCE+'-'+id,requisitionId:id,title:job.title,sourceUrl:canonical,applyUrl:currentApplicationURL(listing),nativeApplicationType:'own-current-native-Phenom-public-GET-same-requisition-application-context',
  sourceLegalEmployer:employer,nativeEmployerDisplayName:employer,sourceNativeHiringOrganization:schema.hiringOrganization,country:'India',city,state,location:job.location,sourceCountryScopeUnresolved:false,sourceNativeGeography:geography,
  postingDate:first?.raw??null,closingDate:deadlines.toSorted((a,b)=>a.milliseconds-b.milliseconds)[0]?.raw??null,sourceNativePublicationDates:publications,sourceNativeExpiryDates:deadlines,
  sourcePublicationDateConflict:calendarDays.length>1,sourcePublicationDatePolicy:'earliest-actually-authored-original-publication;all-original-precision-and-conflicts-retained;created-modified-refresh-and-first-ever-publication-unproven',
  jobDescription:description||null,sourceDescription:description||null,sourceDescriptionHTML:job.description??null,
  sourceDetailComplete:false,sourceDetailFailureKind:'native-renderer-and-application-supplement-scope-unverified',sourceMissingCriteria:[{kind:'renderer-and-application-supplements',reason:'native-renderer-and-application-supplement-scope-unverified'}],
  sourceNativeRecord:job,sourceNativeListingRecord:listing,sourceNativeClosingListingRecord:closingListing,sourceNativeClosingListingAbsentAtDateTie:closingListing===null,
  sourceNativeClosingListingCriteria:closingListing?Object.fromEntries(Object.entries(closingListing).filter(([key])=>/description|criteria|qualification|requirement|header|footer|html$/i.test(key))):null,
  sourceNativeJobPosting:schema,sourceNativeApplicationOriginalModel:appModel,sourceNativeAuthoredCriteriaStatements:authored.statements,
  backendApplicationActivationVerified:false,employmentType:job.type??null,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
// Preserve whole authored job/application business models. Request transaction
// IDs, nonce-bearing form templates and response timings remain in originals but
// cannot reconcile between independent GET requests.
const roleSnapshot=document=>({context:document.context,job:document.model.jobDetail?.data?.job,schemas:document.schemas,canonical:document.canonical})
const applicationSnapshot=document=>{
 const m=structuredClone(document.model.response),r=m?.response
 if(m){delete m.applyTimeStamp;delete m.jsTemplate}
 if(r){delete r.apTxnId;delete r.jsTemplate}
 return {context:document.context,originalBusinessModel:m}
}
export async function runCurrentNative(options={}){
 need(options.maxJobs==null,'Truncated observations unsupported')
 const observedAt=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'Invalid observation time')
 const reader=createCurrentReader(SOURCE,[CAREERS,SEARCH],options)
 try{
  const home=readCurrentDocument((await reader.read(CAREERS)).body);checkContext(home,'home');need(home.links.some(r=>r.href===SEARCH),'Current own career search handoff absent')
  const search=readCurrentDocument((await reader.read(SEARCH)).body),query=currentQuery(search),request=reader.allowQuery(API,query),opening=parseCurrentListing((await reader.read(API,'json',request)).body)
  need(opening.jobs.length>0,'Current native India page empty')
  for(const row of opening.jobs){reader.allow(currentRoleURL(row));reader.allow(currentApplicationURL(row))}
  const roles=[],applications=[],closingRoles=[],closingApplications=[]
  for(const row of opening.jobs){roles.push(readCurrentDocument((await reader.read(currentRoleURL(row))).body));applications.push(readCurrentDocument((await reader.read(currentApplicationURL(row))).body))}
  for(const row of opening.jobs){closingRoles.push(readCurrentDocument((await reader.read(currentRoleURL(row))).body));closingApplications.push(readCurrentDocument((await reader.read(currentApplicationURL(row))).body))}
  need(same(roles.map(roleSnapshot),closingRoles.map(roleSnapshot))&&same(applications.map(applicationSnapshot),closingApplications.map(applicationSnapshot)),'Closing whole original native role/application business models changed')
  const closing=parseCurrentListing((await reader.read(API,'json',request)).body,{closing:true}),closingSearch=readCurrentDocument((await reader.read(SEARCH)).body),closingHome=readCurrentDocument((await reader.read(CAREERS)).body),agreement=reconcileCurrentQuery(opening,closing,observedAt)
  checkContext(closingHome,'home');need(same(query,currentQuery(closingSearch))&&same(home.context,closingHome.context)&&closingHome.links.some(r=>r.href===SEARCH),'Closing native query/publisher/context changed')
  const jobs=[],heldNativeRoles=[]
  for(const [index,row] of opening.jobs.entries())try{jobs.push({...qualifyCurrentRole(roles[index],row,applications[index],observedAt,agreement.closingById.get(row.jobId)??null),sourceNativeClosingRecord:closingRoles[index].model.jobDetail.data.job,sourceNativeClosingJobPosting:closingRoles[index].schemas[0],sourceNativeClosingApplicationOriginalModel:closingApplications[index].model.response,sourceClosingReconciled:true})}
  catch(error){if(!error?.message?.startsWith('Merck current publication:'))throw error;heldNativeRoles.push({listing:row,closingListing:agreement.closingById.get(row.jobId)??null,original:roles[index],application:applications[index],closing:closingRoles[index],closingApplication:closingApplications[index],reason:error.message})}
  for(const job of jobs)Object.assign(job,{source:SOURCE,company:COMPANY,link:job.applyUrl,scrapedAt:observedAt,companyCareerPage:CAREERS,companyDomain:'merckgroup.com',atsPlatform:'own-current-native-Phenom-publication'})
  const observedNativeVacancies=new Set([...opening.jobs,...closing.jobs].map(row=>row.jobId)).size
  const audit={source:SOURCE,recoveryKind:'valid-partial-native-records-current-policy',recordKind:'vacancy-rows',observedRecordCount:observedNativeVacancies,observedVacancyCount:observedNativeVacancies,
   originalNativeQuery:query,originalNativeListing:opening.original,closingNativeListing:closing.original,originalNativeRoleModels:roles.map(r=>r.model),closingNativeRoleModels:closingRoles.map(r=>r.model),
   originalNativeApplicationModels:applications.map(r=>r.model),closingNativeApplicationModels:closingApplications.map(r=>r.model),heldNativeRoles,returnedRows:jobs.length,nativeIndiaCountryMatches:jobs.length,nativeOpeningClosingRecordsMatch:true,
   nativeOpeningClosingRoleAndApplicationBusinessModelsMatch:true,nativeOpeningClosingQueryMatch:agreement.queryMatch,nativeRankingBoundaryEvidence:agreement.evidence,
   fullCriteriaRecovered:false,fullCriteriaIndiaJobs:0,missingCriteriaJobs:jobs.length,backendApplicationActivationVerified:false,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   sourceNativeClosingComparison:'all-original-role-and-application-business-keys-and-values;JSON-object-key-order-insignificant;array-order-retained;declared-request-generated-fields-excluded;bounded-native-index-date-tie-held-separately;known-closing-index-fields-qualified;unknown-index-changes-held;all-raw-models-retained',
   sourcePaginationHold:'first-current-native-Most-recent-India-page10-only;exact-three-existing-approved-legal-employers;remaining-pages-and-full-renderer-scope-unproven',...reader.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observedNativeVacancies,observedVacancyCount:observedNativeVacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SEARCH,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:audit.sourcePaginationHold})
  need(Buffer.byteLength(JSON.stringify(jobs))<=12*1024*1024,'Current native output bound');reader.check();return jobs
 }finally{reader.close()}
}
