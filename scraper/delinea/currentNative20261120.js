import {createDelineaPublicReader} from './publicRead.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {appData,nativeOrganization,nativePlaces,roleURL,plain,fullCriteria} from '../../scraper-support/native-sources/declaredAshby/nativeData.js'
import {readJobPosting,countryName} from '../../scraper-support/native-sources/jobPostingData.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readAuthoredRoleStatements} from './currentAuthoredStatements20261120.js'

export const SOURCE='delinea',COMPANY='Delinea',CAREERS='https://delinea.com/careers',BOARD='https://jobs.ashbyhq.com/delinea',FEED='https://api.ashbyhq.com/posting-api/job-board/delinea'
const CONTRACT={companyName:COMPANY,boardSlug:SOURCE,organizationId:'2c53ba9d-4709-41ce-be8d-4421f52aca5a',websiteOrigin:'https://delinea.com'}
const WORKDAY='https://centrify.wd1.myworkdayjobs.com/en-US/External/'
const fail=message=>Object.assign(Error('Delinea current publication: '+message),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})
const need=(ok,message)=>{if(!ok)throw fail(message)}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function currentCareersChannels(html){
 const doc=readNativeDocument(html),channels=new Set(),locales=new Set()
 need(!doc.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'Unreviewed corporate navigation')
 for(const node of doc.nodes(n=>n.tag==='a'&&n.attrs.href)){
  let url;try{url=new URL(node.attrs.href,CAREERS)}catch{continue}
  if(url.protocol!=='https:'||url.username||url.password)continue
  if(url.origin==='https://delinea.com'&&/^\/(?:de|es|fr|pt)\/careers\/?$/.test(url.pathname))locales.add(url.href)
  if(url.hostname==='jobs.ashbyhq.com'||/(?:^|\.)myworkdayjobs\.com$/.test(url.hostname)
   ||url.hostname!=='delinea.com'&&/apply today|we['’]?re hiring|join (?:the )?team/i.test(doc.text(node)))channels.add(url.href.replace(url.hostname==='jobs.ashbyhq.com'?/\/$/:/$^/,''))
 }
 return {channels:[...channels].sort(),locales:[...locales].sort()}
}
const iso=(raw,label,observedAt,deadline=false)=>{
 need(typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)
  &&Number.isFinite(Date.parse(raw))&&new Date(raw.slice(0,10)).toISOString().slice(0,10)===raw.slice(0,10),'Malformed '+label)
 const milliseconds=Date.parse(raw),last=milliseconds+(raw.length===10?86399999:0)
 need(deadline?last>=Date.parse(observedAt):milliseconds<=Date.parse(observedAt),'Expired or future '+label)
 return {raw,milliseconds,precision:raw.length===10?'calendar-day':'timestamp'}
}
function context(html){
 const doc=readNativeDocument(html)
 need(!doc.nodes(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')).length,'Unsupported native navigation')
 let model;try{model=appData(doc)}catch(error){throw fail('Current literal employer context: '+error.message)}
 need(nativeOrganization(CONTRACT,model.organization)&&model.environment==='production'&&model.maintenanceMode===false&&model.routerPrefix==='/','Foreign, demo, unavailable or unreviewed native employer context')
 return model
}
export function parseCurrentBoard(html){
 const data=context(html),board=data.jobBoard
 need(data.posting===null&&board&&board.stealthAccess===false&&Array.isArray(board.jobPostings)&&board.jobPostings.length<=500,'Missing current native board')
 need(board.jobPostings.every(r=>r&&typeof r.id==='string'&&r.title&&r.locationName&&Array.isArray(r.secondaryLocations))
  &&new Set(board.jobPostings.map(r=>r.id)).size===board.jobPostings.length,'Missing or duplicate native board identity')
 return {organization:data.organization,jobBoard:board}
}
export function parseCurrentFeed(body){
 const model=readLiteralModel(body).value
 need(model&&Array.isArray(model.jobs)&&model.jobs.length<=500&&model.jobs.every(r=>r&&typeof r.id==='string')
  &&new Set(model.jobs.map(r=>r.id)).size===model.jobs.length,'Missing or duplicate current public feed identity')
 return model
}
function availability(record,observedAt){
 for(const key of ['isClosed','closed','expired','isExpired','disabled','archived','isConfidential'])if(record[key]!=null)need(record[key]===false,'Native role unavailable: '+key)
 for(const key of ['canApply','isActive','isPublished','allowApplications'])if(record[key]!=null)need(record[key]===true,'Native role application unavailable: '+key)
 const dates=[]
 for(const key of ['applicationDeadline','validThrough','closingDate','expiryDate'])if(record[key]!=null&&record[key]!=='')dates.push({field:key,...iso(record[key],'native '+key,observedAt,true)})
 return dates
}
export function parseCurrentRole(html,job,brief,board,observedAt){
 const data=context(html),posting=data.posting,schemaData=readJobPosting(html)
 need(same(data.organization,board.organization)&&posting&&posting.id===job.id&&job.isListed===true&&posting.isListed===true,'Own current role identity/publication disagrees')
 need(roleURL(CONTRACT,job.jobUrl,job.id)&&roleURL(CONTRACT,job.applyUrl,job.id,true),'Foreign or wrong-role published application')
 need(schemaData.errors.length===0&&schemaData.candidates.length===1,'Missing or ambiguous native JobPosting')
 const schema=schemaData.candidate.model
 need(schema.title===job.title&&posting.title===job.title&&brief.title===job.title&&schema.identifier?.name===COMPANY&&schema.identifier?.value===job.id
  &&schema.hiringOrganization?.name===COMPANY&&schema.hiringOrganization?.sameAs==='https://delinea.com/','Native employer/title/identifier disagrees')
 need(schema.url==null||schema.url===job.jobUrl,'Native schema role URL disagrees')
 const names=[job.location,...(job.secondaryLocations??[]).map(r=>r.location)].sort()
 need(same(names,[brief.locationName,...brief.secondaryLocations.map(r=>r.locationName)].sort())
  &&same(names,[posting.locationName,...(posting.secondaryLocationNames??[])].sort()),'Native own workplaces disagree')
 need(posting.employmentType===job.employmentType&&brief.employmentType===job.employmentType
  &&posting.workplaceType===job.workplaceType&&brief.workplaceType===job.workplaceType,'Native own employment/workplace type disagrees')
 const geography=nativePlaces(job,schema)
 need(geography.indiaWorksiteQualified&&!geography.schemaConflict&&!geography.applicantConflict,'Native own India workplace or schema country unresolved/conflicting')
 for(const place of geography.originalPlaces){
  const written=String(place.originalLocation).split(/[(),;|/]/).map(value=>countryName(value.trim())).filter(Boolean)
  need(written.every(value=>value===place.country),'Written native workplace contradicts typed country')
 }
 for(const carrier of [job,posting])for(const key of ['country','countryCode','addressCountry'])if(carrier[key]!=null&&carrier[key]!=='')need(countryName(carrier[key])==='India','Additional native country contradicts target')
 const authored=readAuthoredRoleStatements({feed:job,posting,schema},{failure:fail,validateDate:iso,observedAt,geography,employerNames:[COMPANY]})
 const deadlines=[...availability(job,observedAt),...availability(posting,observedAt),...availability(schema,observedAt),...authored.deadlines]
 const publications=[...authored.publications]
 if(job.publishedAt!=null&&job.publishedAt!=='')publications.push({field:'native-feed.publishedAt',...iso(job.publishedAt,'feed publication',observedAt)})
 if(schema.datePosted!=null&&schema.datePosted!=='')publications.push({field:'own-JobPosting.datePosted',...iso(schema.datePosted,'JobPosting publication',observedAt)})
 const first=publications.toSorted((a,b)=>a.milliseconds-b.milliseconds)[0],description=plain(posting.descriptionHtml)
 // The official public feed and own role models prove publication and preserve
 // authored criteria. Hydrated application/rendering supplements remain partial.
 return {jobId:SOURCE+'-'+job.id,requisitionId:null,nativePostingId:job.id,title:job.title,sourceUrl:job.jobUrl,applyUrl:job.applyUrl,
  nativeEmployerDisplayName:COMPANY,sourceLegalEmployer:null,sourceNativeHiringOrganization:schema.hiringOrganization,country:'India',city:geography.city,state:geography.state,location:geography.location,
  sourceCountryScopeUnresolved:false,sourceNativeGeography:geography,employmentType:job.employmentType,department:job.department??null,
  postingDate:first?.raw??null,closingDate:deadlines.toSorted((a,b)=>a.milliseconds-b.milliseconds)[0]?.raw??null,
  sourceNativePublicationDates:publications,sourceNativeExpiryDates:deadlines,sourceNativePublicationDateUnavailable:!publications.length,
  sourceNativePublicationDateConflict:publications.some(r=>new Date(r.milliseconds).toISOString().slice(0,10)!==new Date(publications[0].milliseconds).toISOString().slice(0,10)),
  sourcePublicationDatePolicy:'earliest-actually-authored-native-date-for-aging;original-precision-and-carriers-retained;first-ever-publication-unproven',
  jobDescription:description||null,sourceDescription:description||null,sourceDescriptionHTML:posting.descriptionHtml??null,
  sourceNativeModelCriteriaText:fullCriteria(posting),sourceDetailComplete:false,sourceDetailFailureKind:'native-renderer-and-application-supplement-scope-unverified',
  sourceNativeAuthoredCriteriaStatements:authored.statements,
  sourceMissingCriteria:[{kind:'current-renderer-supplements',reason:'native-renderer-and-application-supplement-scope-unverified'}],
  sourceNativeRecord:job,sourceNativeBoardRecord:brief,sourceNativeOwnRoleRecord:posting,sourceNativeJobPosting:schema,
  sourceNativeRoleContext:{environment:data.environment,maintenanceMode:data.maintenanceMode,organization:data.organization},
  nativeApplicationType:'current-own-Ashby-published-same-posting-application',backendApplicationActivationVerified:false,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
}
export async function runCurrentNative(options={}){
 need(options.maxJobs==null,'Truncated current publication observations unsupported')
 const observedAt=(typeof options.now==='function'?options.now():options.now)??new Date().toISOString()
 need(Number.isFinite(Date.parse(observedAt)),'Invalid observation time')
 const reader=createDelineaPublicReader(options),additionalChannelChecks=[],heldNativeRoles=[]
 try{
  const readChannels=async()=>{
   const original=currentCareersChannels(await reader.readText(CAREERS));need(original.channels.includes(BOARD),'Current own English Ashby handoff absent')
   const locales=[];for(const url of original.locales)locales.push({url,channels:currentCareersChannels(await reader.readText(url))})
   return {original,locales}
  }
  const handoffs=await readChannels(),channels=[...new Set([...handoffs.original.channels,...handoffs.locales.flatMap(r=>r.channels.channels)])].sort()
  for(const url of channels.filter(url=>url!==BOARD)){
   if(url!==WORKDAY){additionalChannelChecks.push({url,outcome:'unreviewed-advertised-channel-not-fetched',listingComplete:false,total:null});continue}
   try{await reader.readText(url);additionalChannelChecks.push({url,outcome:'unparsed-advertised-channel',listingComplete:false,total:null})}
   catch(error){options.signal?.throwIfAborted();if(reader.limitExceeded)throw error
    additionalChannelChecks.push({url,outcome:'unavailable',httpStatus:error.status??null,error:error.message,listingComplete:false,total:null})}
  }
  const board=parseCurrentBoard(await reader.readText(BOARD)),feed=parseCurrentFeed(await reader.readText(FEED)),published=feed.jobs.filter(r=>r.isListed===true)
  need(same(published.map(r=>r.id).sort(),board.jobBoard.jobPostings.map(r=>r.id).sort()),'Native published board/feed identities disagree')
  const selected=published.filter(job=>nativePlaces(job).indiaWorksiteQualified)
  need(selected.length<=20,'Current own India detail cohort exceeds bound')
  const opening=[],closing=[]
  const readRole=async job=>{const html=await reader.readText(job.jobUrl),brief=board.jobBoard.jobPostings.find(r=>r.id===job.id)
   try{return parseCurrentRole(html,job,brief,board,observedAt)}catch(error){if(!error?.message?.startsWith('Delinea current publication:'))throw error
    return {held:true,nativePostingId:job.id,reason:error.message,originalFeed:job,originalBoard:brief,originalOwnRoleHTML:html}}}
  for(const job of selected)opening.push(await readRole(job))
  for(const job of selected)closing.push(await readRole(job))
  const facts=[]
  for(let index=0;index<opening.length;index++){
   if(opening[index].held||closing[index].held){heldNativeRoles.push({nativePostingId:selected[index].id,opening:opening[index],closing:closing[index]});continue}
   need(same(opening[index],closing[index]),'Closing own role identity, country, application, criteria or original models changed');facts.push({...opening[index],sourceNativeClosingOwnRoleRecord:closing[index].sourceNativeOwnRoleRecord})
  }
  const closingBoard=parseCurrentBoard(await reader.readText(BOARD)),closingFeed=parseCurrentFeed(await reader.readText(FEED))
  need(same(board,closingBoard)&&same(feed,closingFeed),'Closing whole native board/feed models changed')
  need(same(handoffs,await readChannels()),'Closing own advertised recruitment channels changed')
  options.signal?.throwIfAborted();need(!reader.limitExceeded,'Current source budget exhausted')
  const jobs=facts.map(r=>({...r,source:SOURCE,company:COMPANY,link:r.applyUrl,scrapedAt:observedAt,sourceClosingReconciled:true,
   companyCareerPage:CAREERS,companyDomain:'delinea.com',atsPlatform:'own-current-Ashby-publication'}))
  const audit={source:SOURCE,recoveryKind:'valid-partial-native-records-current-policy',recordKind:'vacancy-rows',observedRecordCount:published.length,observedVacancyCount:published.length,
   originalNativeBoard:board,originalNativeFeed:feed,closingNativeBoard:closingBoard,closingNativeFeed:closingFeed,additionalChannelChecks,heldNativeRoles,
   returnedRows:jobs.length,nativeIndiaCountryMatches:jobs.length,nativeOpeningClosingRecordsMatch:true,nativeOpeningClosingObservedDetailFactsMatch:true,
   fullCriteriaRecovered:false,fullCriteriaIndiaJobs:0,missingCriteriaJobs:jobs.length,backendApplicationActivationVerified:false,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
   sourcePaginationHold:'current-own-published-Ashby-India-cohort;localized-Workday-channel-and-full-renderer-company-scope-unproven',
   requests:reader.audit.requests,decodedBytes:reader.audit.decodedBytes,receipts:reader.audit.responses,publicRead:reader.audit}
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:published.length,observedVacancyCount:published.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:audit.requests,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:audit.sourcePaginationHold})
  need(Buffer.byteLength(JSON.stringify(jobs))<=8*1024*1024,'Current native output byte bound');return jobs
 }finally{reader.dispose()}
}
