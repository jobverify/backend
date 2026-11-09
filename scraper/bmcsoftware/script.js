import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {hasSourceDescription} from '../../src/utils/jobSourceContent.js'
import {CORPORATE_CAREERS_URL,INDIA_SEARCH_URL,verifyCorporateHandoff,parseListing,parseDetail} from './native.js'

export {CORPORATE_CAREERS_URL,INDIA_SEARCH_URL,parseListing,parseDetail}
export const SOURCE='bmcsoftware'
export const COMPANY='BMC Software'
export const CAREERS_URL=CORPORATE_CAREERS_URL
const fetchText=async(url,{signal}={})=>{
  const response=await fetch(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{'user-agent':'Mozilla/5.0',accept:'text/html'}})
  if(response.status!==200||response.url!==url)throw Error(`BMC native HTTP ${response.status} or unexpected redirect for ${url}`)
  return response.text()
}
export const run=async({fetchText:get=fetchText,signal,maxPages=20,maxJobs=500,now=new Date()}={})=>{
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>100||!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>10000)throw Error('BMC invalid inventory caps')
  const active=signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)
  const checkedNow=typeof now==='function'?now():now
  const request=async url=>{active.throwIfAborted();try{return await get(url,{signal:active})}finally{active.throwIfAborted()}}
  verifyCorporateHandoff(await request(CORPORATE_CAREERS_URL))
  const listings=[],seen=new Set();let url=INDIA_SEARCH_URL,total=null,pagesFetched=0,complete=false
  while(url&&pagesFetched<maxPages&&listings.length<maxJobs){
    const page=parseListing(await request(url),url,{now:checkedNow});pagesFetched++
    if(total!=null&&total!==page.total)throw Error('BMC native inventory total drift')
    if(page.start!==seen.size+1)throw Error('BMC native inventory pagination range gap')
    total=page.total
    for(const job of page.jobs){
      if(seen.has(job.jobId))throw Error('BMC native inventory duplicate identity across pages')
      seen.add(job.jobId);if(listings.length<maxJobs)listings.push(job)
    }
    url=page.nextUrl
    complete=!url&&seen.size===total&&listings.length===total
  }
  const jobs=listings.map(job=>({...job,source:SOURCE,company:COMPANY,link:job.applyUrl,jobDescription:null,closingDate:null,
    sourceDetailComplete:false,sourceDetailFailureKind:'upstream',...(complete?{}:{sourceListingComplete:false}),scrapedAt:new Date().toISOString()}))
  let next=0
  await Promise.all(Array.from({length:Math.min(3,jobs.length)},async()=>{
    while(next<jobs.length){
      const index=next++,listing=listings[index]
      try{
        const detail=parseDetail(await request(listing.sourceUrl),listing,{now:checkedNow})
        if(!hasSourceDescription(detail)){jobs[index].sourceDetailFailureKind='missing-content';continue}
        jobs[index]={...jobs[index],...detail,sourceDetailComplete:true};delete jobs[index].sourceDetailFailureKind
      }catch(error){active.throwIfAborted();jobs[index].sourceDetailFailureKind=error.code==='BMC_NATIVE_IDENTITY'?'identity-mismatch':'upstream'}
    }
  }))
  if(jobs.some(job=>job.sourceDetailComplete!==true))for(const job of jobs)job.sourceListingComplete=false
  return attachInventoryEvidence(jobs,{status:complete?'complete-inventory':'discovery-only',firstParty:true,listingComplete:complete,
    surface:INDIA_SEARCH_URL,pagesFetched,reportedTotal:total,indiaFacetCount:total,verifiedAt:new Date().toISOString(),
    reason:complete?'bmc-official-India-filter-native-ranges-unique-identities-reconciled-details-separate':'bmc-official-India-filter-native-inventory-cap'})
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
