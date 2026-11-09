import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {ENTRY,CAREERS,EMBED,BOARD,API,check,verifyCorporate,inventory,detail} from './nativeContract.js'
export async function runNative(options={}){
 const now=new Date(options.now??Date.now()).toISOString(),timeout=options.timeoutMs??90000
 check(options.maxJobs==null,'Partial caps are unsupported');check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000,'Invalid timeout')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('DataHub deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 async function get(url){
  signal.throwIfAborted();let abort
  try{return await Promise.race([new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})}),(async()=>{
   const response=await(options.fetch??fetch)(url,{method:'GET',redirect:'error',signal})
   signal.throwIfAborted();check(response.status===200&&response.url===url,'Native response status or URL mismatch')
   const body=await response.text();signal.throwIfAborted();check(Buffer.byteLength(body)<=3000000,'Native response too large');return body
  })()])}finally{signal.removeEventListener('abort',abort)}
 }
 try{
  verifyCorporate(await get(ENTRY),await get(CAREERS),await get(EMBED))
  const payload=JSON.parse(await get(API)),india=inventory(payload,now),details=new Map()
  for(const row of india)details.set(String(row.id),detail(await get(row.absolute_url),row,now))
  const mapped=await createPublishingGapAtsScraper({source:'datahub',companyName:'DataHub',atsPlatform:'greenhouse',boardToken:'acryldata'}).run({signal,fetchJson:async url=>{check(url===API,'Unexpected shared API request');return payload}})
  check(mapped.length===india.length&&mapped.every(job=>details.has(String(job.jobId))),'Shared mapping lost or added native India identity')
  const final=JSON.parse(await get(API));inventory(final,now);check(JSON.stringify(final)===JSON.stringify(payload),'Native inventory drift');signal.throwIfAborted()
  const jobs=mapped.map(job=>{
   const row=india.find(row=>String(row.id)===String(job.jobId)),full=details.get(String(job.jobId))
   return{...job,jobId:String(row.id),source:'datahub',company:'DataHub',sourceUrl:row.absolute_url,applyUrl:row.absolute_url,link:row.absolute_url,jobDescription:full.description,sourceDescription:full.description,description:full.description,
    postedAt:full.postedAt,postingDate:full.postedAt,closingDate:full.closingDate,sourceClosingDateIsExact:full.closingDate!=null,nativePublishedAt:full.nativePublishedAt,nativeUpdatedAt:row.updated_at,nativeLocation:full.nativeLocation,
    nativeCountry:null,nativeLegalEmployer:null,nativeBrand:row.company_name,sourceCountryEvidence:'Exact native role and public API location label explicitly include India',sourceDetailComplete:!!full.description,sourceDetailStatus:full.description?'complete':'native-description-missing',
    sourceAvailabilityEvidence:full.availability??undefined,sourceDetailFailureReason:full.sourceDetailFailureReason,nativeRejectedDescription:full.nativeRejectedDescription,
    sourceListingComplete:false,sourceScopeComplete:false,sourceCompanyCoverageComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,nativeObservedBoardRecords:payload.jobs.length,scrapedAt:now}
  })
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
   reason:payload.jobs.length===0?'Stable scoped public board empty; whole-company inventory scope unproven':'Stable observed public Greenhouse API and full India details; whole-company recruiting scope unproven. Original publication dates retained separately from edits.'})
 }finally{clearTimeout(timer);controller.abort()}
}
