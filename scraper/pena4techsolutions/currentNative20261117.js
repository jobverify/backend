import {isDeepStrictEqual} from 'node:util'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {SOURCE,JOBS,SHORT,PORTAL,LIST,LABELS,PROGRAM,need,sha,corporateHandoff,portalConfiguration,verifyPortal,headersFor,queryFor,ownDetailURL,parsePage,verifyLabels,verifyOwnRole} from './currentContract20261117.js'
import {createPena4Reader} from './currentTransport20261117.js'
const holds=['native-work-country-unpublished;bare-city-and-India-tab-not-country-proof','full-native-rendered-criteria-and-application-contract-unqualified','native-posting-date-unpublished','employer-wide-inventory-scope-unproved']
function differences(a,b,path='$',out=[]){
 if(isDeepStrictEqual(a,b))return out
 if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  for(const key of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[key],b[key],path+'.'+key,out)
 }else out.push({path,openingValueSHA256:sha(JSON.stringify(a)??'undefined'),closingValueSHA256:sha(JSON.stringify(b)??'undefined')})
 return out
}
export async function runCurrentPena4(options={}){
 options.signal?.throwIfAborted()
 need(!options.fetchText&&!options.fetchPage&&!options.fetchJson,'original HTTP metadata required; body-only callbacks cannot certify current native positions')
 const maxJobs=options.maxJobs??200,maxPages=options.maxPages??20
 need(Number.isSafeInteger(maxJobs)&&maxJobs>=0&&maxJobs<=200&&Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=20,'invalid caller cap')
 const jobs=[],observedAt=typeof options.now==='function'?options.now():new Date().toISOString();need(Number.isFinite(Date.parse(observedAt)),'invalid observation clock')
 const inventory=(reason,pagesFetched)=>attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOBS,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason})
 if(maxJobs===0)return inventory('caller-zero-cap;native-inventory-unobserved',0)
 const io=createPena4Reader(options)
 async function authority(){
  const jobsPage=await io.read(JOBS);corporateHandoff(jobsPage.text)
  const handoff=await io.read(SHORT),config=portalConfiguration(handoff.location),portal=await io.read(handoff.location);verifyPortal(portal.text)
  const programs=[]
  for(const p of PROGRAM){const original=await io.read(PORTAL+p.path,{kind:'js'});need(original.bodySHA256===p.sha256,'whole declared '+p.label+' program changed');programs.push({label:p.label,sha256:original.bodySHA256})}
  return {jobsSHA256:jobsPage.bodySHA256,shortBodySHA256:handoff.bodySHA256,portalURL:handoff.location,portalSHA256:portal.bodySHA256,config,programs}
 }
 const readJSON=async(url,descriptor={})=>JSON.parse((await io.read(url,{kind:'json',...descriptor})).text)
 async function labels(config){const value=await readJSON(LABELS,{headers:headersFor(config)});verifyLabels(value);return value}
 async function listing(config){
  const pages=[],rows=[],seen=new Set()
  for(let page=1;page<=maxPages;page++){
   const parsed=parsePage(await readJSON(LIST,{method:'POST',headers:{...headersFor(config),'Content-Type':'application/json'},body:JSON.stringify(queryFor(config,page))}))
   for(const row of parsed.rows){need(!seen.has(row.positionId),'duplicate native position identity');seen.add(row.positionId);rows.push(row)}
   need(rows.length<=200,'native row bound exceeded');pages.push({page,rows:parsed.rows});if(parsed.terminal)return {pages,rows}
  }
  need(false,'no native terminal page within caller/source bound')
 }
 async function details(rows,config){
  const result=[];for(const row of rows){const data=await readJSON(ownDetailURL(row,config),{headers:headersFor(config)});verifyOwnRole(row,data);result.push({positionId:row.positionId,data})}return result
 }
 try{
  const openingAuthority=await authority(),config=openingAuthority.config,openingLabels=await labels(config),openingListing=await listing(config),openingDetails=await details(openingListing.rows,config)
  const opening={authority:openingAuthority,labels:openingLabels,...openingListing,details:openingDetails}
  const closingDetails=await details(openingListing.rows,config),closingListing=await listing(config),closingLabels=await labels(config),closingAuthority=await authority()
  const closing={authority:closingAuthority,labels:closingLabels,...closingListing,details:closingDetails}
  need(isDeepStrictEqual(openingAuthority,closingAuthority),'whole publisher/tenant/program closing changed')
  need(isDeepStrictEqual(openingLabels,closingLabels),'complete native label model changed at closing')
  need(isDeepStrictEqual(openingListing,closingListing),'complete ordered native page/row model changed at closing')
  const rawModelsClosingReconciled=isDeepStrictEqual(opening,closing),closingDifferences=differences(openingDetails,closingDetails,'$.details')
  // Retain every raw DTO field, including staff image SAS URLs, in both models.
  // No query keys are excluded without renderer proof. Even exact raw equality
  // cannot qualify missing country, full rendered criteria, or application.
  const observations=openingListing.rows.map((row,index)=>({
   source:SOURCE,company:'Pena4 Tech Solutions',jobId:String(row.positionId),requisitionId:row.jobCode,title:row.jobTitle,
   country:null,location:null,locations:[],city:null,sourceUrl:JOBS,applyUrl:SHORT,sourceRoleUrlQualified:false,
   nativeEmployer:openingDetails[index].data.company,nativeListModel:structuredClone(row),nativeOwnRoleDTO:structuredClone(openingDetails[index].data),nativeClosingOwnRoleDTO:structuredClone(closingDetails[index].data),
   jobDescription:null,sourceDetailComplete:false,sourceDetailStatus:'native-public-rendering-and-application-unqualified',postingDate:null,sourcePostingDateUnknown:true,
   sourceScopeComplete:false,sourceListingComplete:false,sourceApplicationQualificationComplete:false,sourceCountryScopeUnresolved:true,lifecycleCleanupAllowed:false,
   qualificationHolds:[...holds,...(rawModelsClosingReconciled?[]:['full-raw-native-DTO-closing-unqualified'])],
  }))
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,observedAt,
   observationScope:'published-position-rows-in-the-declared-India-tab-tenant;not-native-headcount-or-qualified-India-jobs',
   observations,opening,closing,listingPagesClosingReconciled:true,rawModelsClosingReconciled,closingQualified:false,closingDifferences,excludedClosingPaths:[],excludedTechnicalQueryKeys:[],
   qualificationHolds:[...holds,...(rawModelsClosingReconciled?[]:['full-raw-native-DTO-closing-unqualified'])],reader:io.stats()}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  inventory('declared-public-native-position-observations-only;country/rendering/application/company-scope-and-closing-unqualified',io.stats().requests)
  io.check();return jobs
 }finally{io.close()}
}
