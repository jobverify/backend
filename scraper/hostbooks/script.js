import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import HOSTBOOKS_CATALOG from './catalog.js'
import {hostBooksSummaryRows,readHostBooksRoles} from './native.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=HOSTBOOKS_CATALOG
export const SOURCE=HOSTBOOKS_CATALOG.source,COMPANY=HOSTBOOKS_CATALOG.companyName,CAREERS_URL=HOSTBOOKS_CATALOG.companyCareerPage,VERIFIED_ON=HOSTBOOKS_CATALOG.verifiedOn
const normalize=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
export const hasOfficialCareersSignal=(html='')=>{
 const text=normalize(html)
 return text.includes('Current Opening')&&text.includes('Submit Your Resume')&&text.includes('Java Developer')&&text.includes('Finance Manager')
}
export const extractOpeningSummaryRows=hostBooksSummaryRows
export const extractOpeningSections=readHostBooksRoles
const defaultFetchText=(url,{signal}={})=>fetchTextWithRetry(url,{signal,
 headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},label:SOURCE,timeoutMs:15000})
export const createHostBooksScraper=({now=()=>new Date().toISOString()}={})=>({async run({fetchText=defaultFetchText,signal}={}){
 signal?.throwIfAborted()
 const html=await fetchText(CAREERS_URL,{signal});signal?.throwIfAborted()
 if(!hasOfficialCareersSignal(html))throw Error('The verified HostBooks careers page no longer matches the trusted first-party surface')
 const jobs=readHostBooksRoles(html)
 if(!jobs.length)throw Error('The verified HostBooks careers page no longer exposes the trusted current-opening surface')
 const scrapedAt=now(),result=jobs.map(job=>({...job,source:SOURCE,link:job.applyUrl,scrapedAt}))
 const audit={source:SOURCE,observedListingCount:jobs.length,reportedTotal:null,indiaFacetCount:null,
  candidateDetails:jobs.length,extractedDetailJobs:jobs.filter(job=>job.sourceDetailComplete).length,excludedDetailJobs:0,
  failures:jobs.filter(job=>!job.sourceDetailComplete).map(job=>({stage:'native-detail',nativeRoleId:job.nativeRoleId||job.jobId,kind:'missing-content'})),
  listingPaginationComplete:null,closingInventoryMatches:null,sourceScopeComplete:false,nativeOpeningRowCount:jobs.length,
  nativeCountryQualifiedCount:jobs.filter(job=>job.country).length,nativeCountryUnknownCount:jobs.filter(job=>!job.country).length,
  exactIndiaInventoryUnknown:true,closingCohortValidated:false,reason:'Bound first-party opening table and declared modal details; corporate addresses excluded from workplace proof.'}
 if(result.length)result[0].nativeCollectionEvidence=audit
 Object.defineProperty(result,'nativeCollectionEvidence',{value:audit})
 return attachInventoryEvidence(result,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched:1,
  reportedTotal:null,indiaFacetCount:null,verifiedAt:scrapedAt,reason:'Native role-owned workplace labels retained. '+jobs.filter(job=>!job.country).length+' role countries remain unknown; application criteria, modal rendering and closing inventory remain unqualified.'})
}})
export const run=async(options={})=>createHostBooksScraper(options).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
