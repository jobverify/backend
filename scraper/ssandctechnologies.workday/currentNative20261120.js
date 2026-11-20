import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {plain} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createCurrentReader} from './currentTransport20261120.js'
import {countryMentions,readAuthoredRoleStatements} from './currentAuthoredStatements20261120.js'

export const SOURCE='ssandctechnologies',COMPANY='SS&C Technologies',HOME='https://www.ssctech.com/',CAREERS='https://www.ssctech.com/careers/why-ssc'
export const BOARD='https://wd1.myworkdaysite.com/recruiting/ssctech/SSCTechnologies',API='https://wd1.myworkdaysite.com/wday/cxs/ssctech/SSCTechnologies'
// This exact native hiring label was already source-approved. Other branches,
// acquired companies and disabled employer labels never inherit this scope.
export const NATIVE_EMPLOYER='SS&C Fintech Svc India - Hyderabad'
const fail=message=>Object.assign(Error('SS&C current publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
// Native facet value order varies between equal-count results. Compare those
// finite declared facet entries as multisets, retaining every complete entry,
// unknown key, descriptor, ID, count and duplicate in the original models.
const facetSnapshot=facet=>{
 const value=canonical(facet)
 if(typeof facet?.facetParameter==='string'&&Array.isArray(facet.values))value.values=facet.values.map(row=>typeof row?.facetParameter==='string'?facetSnapshot(row):canonical(row)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 return value
}
const listingSnapshot=model=>({...model,facets:model.facets.map(facetSnapshot).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))})
export function nativeDate(raw,label,observedAt,deadline=false){
 need(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)
  &&Number.isFinite(Date.parse(raw))&&new Date(raw.slice(0,10)).toISOString().slice(0,10)===raw.slice(0,10),'Malformed native '+label)
 const milliseconds=Date.parse(raw),last=milliseconds+(raw.length===10?86399999:0)
 need(deadline?last>=Date.parse(observedAt):milliseconds<=Date.parse(observedAt),'Expired or future native '+label)
 return {raw,milliseconds,precision:raw.length===10?'calendar-day':'timestamp'}
}
const json=body=>readLiteralModel(body).value
function links(html){const doc=readNativeDocument(html);need(!doc.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'Unreviewed corporate navigation');return doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>({href:n.attrs.href,text:doc.text(n)}))}
export function parseCurrentListing(body){
 const data=json(body)
 need(data.userAuthenticated===false&&Number.isSafeInteger(data.total)&&data.total>=0&&Array.isArray(data.jobPostings)&&data.jobPostings.length<=20&&Array.isArray(data.facets),'Current native published listing shape changed')
 need(data.jobPostings.every(r=>r.title&&typeof r.externalPath==='string'&&/^\/job\/[^?#]+_(R\d+)(?:-\d+)?$/.test(r.externalPath))
  &&new Set(data.jobPostings.map(r=>r.externalPath)).size===data.jobPostings.length,'Ambiguous current native listing identities')
 return data
}
export function currentFacetQuery(data){
 const facets=[],walk=value=>{if(value&&typeof value==='object'){if(value.facetParameter)facets.push(value);for(const part of Object.values(value))walk(part)}}
 walk(data.facets)
 const choose=(parameter,label)=>{
  const rows=facets.filter(r=>r.facetParameter===parameter).flatMap(r=>r.values??[]).filter(r=>r.descriptor===label)
  need(rows.length===1&&/^[a-f\d]{32}$/.test(rows[0].id),'Missing or ambiguous current '+parameter+' '+label);return rows[0]
 }
 const country=choose('locationCountry','India'),location=choose('locations','Hyderabad, India')
 return {country,location,body:{appliedFacets:{locationCountry:[country.id],locations:[location.id]},limit:20,offset:0,searchText:''}}
}
export function qualifyCurrentRole(model,listing,country,observedAt){
 const job=model.jobPostingInfo,id=listing.externalPath.match(/_(R\d+)(?:-\d+)?$/)?.[1],employer=model.hiringOrganization
 need(model.userAuthenticated===false&&job&&job.title===listing.title&&job.jobReqId===id&&job.jobPostingSiteId==='SSCTechnologies'
  &&typeof job.id==='string'&&/^[a-f\d]{32}$/.test(job.id)&&job.jobPostingId===listing.externalPath.split('/').at(-1),'Native exact requisition/title/site identity disagrees')
 need(employer?.name===NATIVE_EMPLOYER,'Unapproved, other or disabled native employer')
 need(job.canApply===true&&job.posted===true,'Native role is not currently published/applicable')
 need(job.externalUrl===BOARD+listing.externalPath,'Native own role/application entry is foreign or wrong-requisition')
 need(job.country?.descriptor==='India'&&job.country.id===country.id&&job.jobRequisitionLocation?.country?.descriptor==='India'
  &&job.jobRequisitionLocation.country.id===country.id&&job.jobRequisitionLocation.country.alpha2Code==='IN','Native own typed country carriers disagree')
 const parts=String(job.location??'').split(',').map(p=>p.trim())
 need(parts.length>=2&&parts.length<=3&&parts.every(Boolean)&&!/[;|/\\]/.test(job.location)&&countryName(parts.at(-1))==='India'
  &&parts.slice(0,-1).every(part=>!countryName(part)),'Native primary workplace is not one India tuple')
 const city=parts[0],state=parts.length===3?parts[1]:null,geography={countries:['India'],originalPlaces:[{originalLocation:job.location,country:'India',city,state}]}
 const caption=job.jobRequisitionLocation.descriptor
 need(typeof caption==='string'&&caption.toLowerCase().includes(city.toLowerCase())&&countryMentions(caption,geography).every(value=>value==='India'),'Native requisition office contradicts primary India worksite')
 for(const location of job.additionalLocations??[]){
  need(typeof location==='string','Malformed additional native worksite')
  const countries=countryMentions(location,geography);for(const value of countries)if(!geography.countries.includes(value))geography.countries.push(value)
  geography.originalPlaces.push({originalLocation:location,country:countries.length===1?countries[0]:null,city:null,state:null})
 }
 for(const key of ['countryCode','addressCountry'])if(job[key]!=null&&job[key]!=='')need(countryName(job[key])==='India','Additional native country contradiction')
 for(const key of ['closed','isClosed','expired','isExpired','isConfidential','archived','disabled'])if(job[key]!=null)need(job[key]===false,'Native role unavailable: '+key)
 for(const key of ['isActive','isPublished','allowApplications'])if(job[key]!=null)need(job[key]===true,'Native role disabled: '+key)
 for(const key of ['status','jobStatus','publicationStatus'])if(job[key]!=null)need(typeof job[key]==='string'&&/^(?:open|active|published)$/i.test(job[key]),'Native role status unavailable: '+key)
 const authored=readAuthoredRoleStatements({jobPostingInfo:job},{failure:fail,validateDate:nativeDate,observedAt,geography,employerNames:[COMPANY,NATIVE_EMPLOYER,'SS&C']})
 const publications=[...authored.publications],deadlines=[...authored.deadlines]
 for(const key of ['startDate','datePosted','postingDate','publishedAt'])if(job[key]!=null&&job[key]!=='')publications.push({field:key,...nativeDate(job[key],'publication',observedAt)})
 for(const key of ['applicationDeadline','validThrough','closingDate','expiryDate'])if(job[key]!=null&&job[key]!=='')deadlines.push({field:key,...nativeDate(job[key],'deadline',observedAt,true)})
 const description=plain(job.jobDescription),first=publications.toSorted((a,b)=>a.milliseconds-b.milliseconds)[0]
 return {jobId:SOURCE+'-'+id,requisitionId:id,nativePostingId:job.id,title:job.title,sourceUrl:job.externalUrl,applyUrl:job.externalUrl,
  nativeEmployerDisplayName:employer.name,sourceLegalEmployer:null,sourceNativeHiringOrganization:employer,
  country:'India',city,state,location:job.location,sourceCountryScopeUnresolved:false,sourceNativeGeography:geography,
  postingDate:first?.raw??null,closingDate:deadlines.toSorted((a,b)=>a.milliseconds-b.milliseconds)[0]?.raw??null,
  sourceNativePublicationDates:publications,sourceNativeExpiryDates:deadlines,sourceNativeRelativePostedOn:job.postedOn??null,
  sourcePublicationDatePolicy:'earliest-actually-authored-original-native-publication;relative-label-and-precision-retained;first-ever-publication-unproven',
  jobDescription:description||null,sourceDescription:description||null,sourceDescriptionHTML:job.jobDescription??null,
  sourceDetailComplete:false,sourceDetailFailureKind:'native-renderer-application-transition-and-supplement-scope-unverified',
  sourceMissingCriteria:[{kind:'renderer-and-application-supplements',reason:'native-renderer-application-transition-and-supplement-scope-unverified'}],
  sourceNativeApplicationEvidence:{canApply:job.canApply,posted:job.posted,externalUrl:job.externalUrl},
  nativeApplicationType:'own-published-role-with-native-canApply-true;application-transition-unverified',backendApplicationActivationVerified:false,
  sourceNativeRecord:model,sourceNativeListingRecord:listing,sourceNativeAuthoredCriteriaStatements:authored.statements,
  employmentType:job.timeType??null,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
export async function runCurrentNative(options={}){
 need(options.maxJobs==null,'Truncated current native observations unsupported')
 const observedAt=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'Invalid observation time')
 const reader=createCurrentReader(SOURCE,[HOME,CAREERS,BOARD],options)
 try{
  const publisher=async()=>{
   need(links((await reader.read(HOME)).body).some(r=>r.href===CAREERS),'Current own corporate careers handoff absent')
   need(links((await reader.read(CAREERS)).body).some(r=>r.href===BOARD&&/Apply Now/.test(r.text)),'Current exact own external account handoff absent')
   const landing=json((await reader.read(BOARD,'json')).body)
   need(landing.widget==='redirect'&&landing.url==='/recruiting/ssctech/SSCTechnologies'&&landing.externalSpa===true,'Current native account landing changed');return landing
  }
  const landing=await publisher(),allRequest=reader.allowQuery(API+'/jobs',{appliedFacets:{},limit:20,offset:0,searchText:''})
  const global=parseCurrentListing((await reader.read(API+'/jobs','json',allRequest)).body),query=currentFacetQuery(global),targetRequest=reader.allowQuery(API+'/jobs',query.body)
  const listing=parseCurrentListing((await reader.read(API+'/jobs','json',targetRequest)).body)
  need(listing.total>=listing.jobPostings.length&&listing.jobPostings.length>0,'Current native own location cohort unavailable')
  for(const row of listing.jobPostings)reader.allow(API+row.externalPath)
  const opening=[],closing=[]
  for(const row of listing.jobPostings)opening.push(json((await reader.read(API+row.externalPath,'json')).body))
  for(const row of listing.jobPostings)closing.push(json((await reader.read(API+row.externalPath,'json')).body))
  need(same(opening,closing),'Closing original native detail models changed')
  const closingListing=parseCurrentListing((await reader.read(API+'/jobs','json',targetRequest)).body),closingGlobal=parseCurrentListing((await reader.read(API+'/jobs','json',allRequest)).body)
  need(same(listingSnapshot(listing),listingSnapshot(closingListing))&&same(listingSnapshot(global),listingSnapshot(closingGlobal))&&same(landing,await publisher()),'Closing current native listings, facets or publisher changed')
  const jobs=[],heldNativeRoles=[]
  for(const [index,row] of listing.jobPostings.entries())try{jobs.push({...qualifyCurrentRole(opening[index],row,query.country,observedAt),sourceNativeClosingRecord:closing[index],sourceClosingReconciled:true})}
  catch(error){if(!error?.message?.startsWith('SS&C current publication:'))throw error;heldNativeRoles.push({listing:row,original:opening[index],closing:closing[index],reason:error.message})}
  for(const job of jobs)Object.assign(job,{source:SOURCE,company:COMPANY,link:job.applyUrl,scrapedAt:observedAt,companyCareerPage:CAREERS,companyDomain:'ssctech.com',atsPlatform:'own-current-native-Workday-publication'})
  const audit={source:SOURCE,recoveryKind:'valid-partial-native-records-current-policy',recordKind:'vacancy-rows',observedRecordCount:listing.jobPostings.length,observedVacancyCount:listing.jobPostings.length,
   originalNativeGlobalListing:global,originalNativeFacetQuery:query,originalNativeListing:listing,closingNativeGlobalListing:closingGlobal,closingNativeListing:closingListing,
   originalNativeRoleRecords:opening,closingNativeRoleRecords:closing,heldNativeRoles,returnedRows:jobs.length,nativeIndiaCountryMatches:jobs.length,nativeOpeningClosingRecordsMatch:true,
   fullCriteriaRecovered:false,fullCriteriaIndiaJobs:0,missingCriteriaJobs:jobs.length,backendApplicationActivationVerified:false,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   sourceNativeClosingComparison:'all-original-business-keys-and-values;JSON-object-key-order-insignificant;known-facet-values-compared-as-complete-entry-multisets;other-array-order-retained;all-raw-models-retained',
   sourcePaginationHold:'current-native-India-and-Hyderabad-facet-first20-cohort;only-existing-approved-exact-hiring-label;remaining-company-and-renderer-scope-unproven',...reader.stats()}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:listing.jobPostings.length,observedVacancyCount:listing.jobPostings.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:audit.sourcePaginationHold})
  need(Buffer.byteLength(JSON.stringify(jobs))<=8*1024*1024,'Current native output bound');reader.check();return jobs
 }finally{reader.close()}
}
