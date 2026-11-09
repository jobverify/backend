import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createTeamleaseReader} from './boundedRead.js'
import {CAREERS_URL,CAREERS_API_URL,SOURCE,COMPANY,buildSearchUrl,extractSearchResults,extractJobDetail,parseArchive,nativeFailure} from './currentNative.js'

export {CAREERS_URL,CAREERS_API_URL,buildSearchUrl,extractSearchResults,extractJobDetail}
export const PAGE_SIZE=100
const currentDir=path.dirname(fileURLToPath(import.meta.url))
const snapshot=rows=>JSON.stringify(rows.map(row=>row.sourceNativeListingRecord).sort((a,b)=>a.id-b.id))
const optionalInteger=(value,name)=>{
 if(value==null||value==='')return null
 if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw nativeFailure('Invalid native '+name)
 return Number(value)
}
export const createTeamleaseScraper=(factoryOptions={})=>({
 async run(runOptions={}){
  const options={...factoryOptions,...runOptions},pageSize=options.pageSize??PAGE_SIZE,maxPages=options.maxPages??24,maxJobs=options.maxJobs??null
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100
   ||maxJobs!==null&&(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>10000))throw RangeError('Invalid TeamLease native collection limits')
  const reader=createTeamleaseReader(options)
  try{
   const observedAt=(options.now??(()=>new Date().toISOString()))()
   if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw nativeFailure('Invalid source observation clock')
   reader.check()
   const archive=await reader.read(CAREERS_URL),opening=[],pages=[],seenIds=new Set(),seenURLs=new Set()
   let total=null,totalPages=null,ended=false
   for(let page=1;page<=maxPages;page++){
    const url=reader.allowInventory(page,pageSize),response=await reader.read(url,'json')
    const raw=JSON.parse(response.body),rows=extractSearchResults(raw)
    if(rows.length>pageSize)throw nativeFailure('Native response exceeds the requested page size')
    const reported=optionalInteger(response.headers['x-wp-total'],'published post total'),reportedPages=optionalInteger(response.headers['x-wp-totalpages'],'published page total')
    if(reported!==null){if(total!==null&&total!==reported)throw nativeFailure('Native inventory total changed');total=reported}
    if(reportedPages!==null){if(totalPages!==null&&totalPages!==reportedPages)throw nativeFailure('Native inventory page count changed');totalPages=reportedPages}
    for(const row of rows){
     if(seenIds.has(row.jobId)||seenURLs.has(row.sourceUrl))throw nativeFailure('Repeated/cyclic native published inventory')
     seenIds.add(row.jobId);seenURLs.add(row.sourceUrl);opening.push(row);reader.allowRole(row.sourceUrl)
    }
    pages.push({url,snapshot:snapshot(rows),reported,reportedPages})
    if(rows.length<pageSize||totalPages!==null&&page===totalPages){ended=true;break}
   }
   if(!ended)throw nativeFailure('Native pagination limit reached before the complete public feed')
   if(total!==null&&opening.length!==total)throw nativeFailure('Native published post total does not match unique records')
   if(totalPages!==null&&pages.length!==Math.max(1,totalPages))throw nativeFailure('Native published page count does not match traversal')
   if(!opening.length)throw nativeFailure('Empty native published feed without employer-scope proof')
   const openingArchive=parseArchive(archive.body,opening,{check:reader.check})
   const jobs=[],exclusions=[]
   for(const row of opening){
    if(maxJobs!==null&&jobs.length>=maxJobs)break
    reader.check()
    const response=await reader.read(row.sourceUrl)
    const job=extractJobDetail(response.body,row,{now:observedAt,check:reader.check})
    if(job.sourceRoleExpired||job.sourceFuturePublication){exclusions.push({postId:row.jobId,reason:job.sourceRoleExpired?'native-expired-post':'native-future-publication'});continue}
    jobs.push({...job,source:SOURCE,company:COMPANY,link:job.applyUrl,companyCareerPage:CAREERS_URL,
     companyDomain:'group.teamlease.com',atsPlatform:'wp-job-openings',scrapedAt:observedAt})
   }
   for(const page of pages){
    const closing=await reader.read(page.url,'json'),rows=extractSearchResults(JSON.parse(closing.body))
    if(snapshot(rows)!==page.snapshot||optionalInteger(closing.headers['x-wp-total'],'closing published total')!==page.reported
     ||optionalInteger(closing.headers['x-wp-totalpages'],'closing published page count')!==page.reportedPages)throw nativeFailure('Closing native inventory changed')
   }
   const closingArchiveResponse=await reader.read(CAREERS_URL)
   if(JSON.stringify(parseArchive(closingArchiveResponse.body,opening,{check:reader.check}))!==JSON.stringify(openingArchive))throw nativeFailure('Closing native archive changed')
   reader.check()
   const summary={source:SOURCE,observedPublishedPostCount:opening.length,observedVacancyCount:opening.length,
    nativeFeedReportedTotal:total,nativeFeedPages:pages.length,nativeVisibleArchiveLinks:openingArchive.length,
    fullDescriptionCount:jobs.length,unknownCountryCount:jobs.filter(job=>job.country===null).length,
    explicitIndiaCountryMatches:jobs.filter(job=>job.country==='India').length,excludedPosts:exclusions,
    sourceExplicitLimit:maxJobs,openingClosingNativeRecordsMatch:true,openingClosingArchiveLinksMatch:true,
    companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,...reader.stats()}
   if(jobs.length)jobs[0].nativeCollectionEvidence=summary
   attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.length,
    observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
   Object.defineProperty(jobs,'nativeCollectionEvidence',{value:summary,configurable:true})
   attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,
    pagesFetched:summary.requests,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,
    reason:'current-native-published-posts-and-full-role-criteria;workplace-country-and-company-scope-unverified;cleanup-forbidden'})
   if(Buffer.byteLength(JSON.stringify(jobs))>8*1024*1024)throw nativeFailure('Native output byte budget exceeded')
   reader.check();return jobs
  }catch(error){if(options.signal?.aborted)throw options.signal.reason;throw error}
  finally{reader.close()}
 }
})
export const run=options=>createTeamleaseScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
