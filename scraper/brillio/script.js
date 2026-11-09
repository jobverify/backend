import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {resolveWorksiteCountry} from './worksiteCountry.js'
import {resolveNativeApplicationCountry} from './nativeApplicationCountry.js'
export {resolveNativeApplicationCountry}
import {CORPORATE,CAREERS,BOARD,BOARD_ROOT,API,listingJobs,jobDetail,pagination,searchBody,validateCorporate,validateClient,isExactNativeHandoff,countryOf} from './nativeContract.js'
export const LISTING_PAGE_URL=BOARD
export const DETAIL_PAGE_URL_PREFIX='https://careers.brillio.com/job-details?job-id='
export const APPLY_PAGE_URL_PREFIX='https://careers.brillio.com/privacy-notice?job-id='
export const buildListingUrl=(page=1)=>page<=1?BOARD:`${BOARD}?paged=${page}`
export const extractListingJobs=listingJobs
export const extractJobDetail=jobDetail
const blocked=text=>/access denied|verify you are human|captcha|request blocked|attention required|cf-chl-/i.test(text)
const decorate=(listing,detail,now)=>({
 title:detail.title||listing.title,company:'Brillio',department:listing.department,location:detail.location||listing.location,
 city:(detail.location||listing.location)?.split(',')[0]?.trim()||null,country:'India',jobId:listing.jobId,requisitionId:listing.requisitionId,
 sourceUrl:listing.detailUrl,applyUrl:detail.applyUrl,link:detail.applyUrl||null,employmentType:null,experienceRequired:null,
 minimumQualification:null,preferredQualification:null,requiredSkills:detail.requiredSkills||[],postingDate:detail.postingDate||null,closingDate:detail.closingDate||null,
 jobDescription:detail.jobDescription||listing.summary,remoteStatus:null,source:'brillio',scrapedAt:now,
 sourceDetailComplete:detail.sourceDetailComplete===true,sourceDetailFailureKind:detail.sourceDetailFailureKind||null,
 sourceDescriptionType:detail.jobDescription?'native-role-content':'listing-preview',sourceDescription:detail.jobDescription||listing.summary,
 sourceDocumentDates:detail.sourceDocumentDates||[],sourceNativeStructuredCriteria:detail.sourceNativeStructuredCriteria||[],
 sourceNativeAvailability:detail.sourceNativeAvailability||'unknown',nativePills:listing.nativePills||[],
 applicationUrlIsGeneric:!detail.applyUrl,lifecycleCleanupAllowed:false,
})
export const extractSearchResults=({listingHtmlByUrl={},detailHtmlByUrl={}}={})=>{
 const listings=[...new Map(Object.values(listingHtmlByUrl).flatMap(listingJobs).map(row=>[row.jobId,row])).values()]
 return listings.filter(row=>countryOf(row.location)==='India').map(row=>({...decorate(row,jobDetail(detailHtmlByUrl[row.detailUrl]||'',{jobId:row.jobId}),null),sourceListingComplete:false}))
}
export const createBrillioScraper=({maxJobs=null}={})=>({
 async run(options={}){
  const now=new Date(options.now||Date.now()).toISOString(),fetchNative=options.fetch||globalThis.fetch,allRows=[],jobs=[],requests=[],errors=[],contextualCountryEvidence=[]
  let denied=false,pagesFetched=0,enumerationComplete=false,closingMatches=false,bindingVerified=false,unknownCount=0,foreignCount=0,globalCount=0,fullCount=0,closedCount=0
  const get=async(url,init={},expectedFinalUrls=null)=>{
   if(denied)throw Error('Brillio native access already denied')
   options.signal?.throwIfAborted()
   let body,finalURL=url,status=200
   try{
    if(options.fetchText){body=await options.fetchText(url,init)}else{
     const response=await fetchNative(url,{...init,headers:{Accept:init.method==='POST'?'application/json':'text/html',...(init.headers||{})},signal:options.signal||AbortSignal.timeout(options.timeoutMs||30000)})
     status=response.status;finalURL=response.url||url;body=await response.text()
    }
   }catch(error){throw Error('Brillio native request failed: '+error.message)}
   requests.push({url,method:init.method||'GET',status,finalURL})
   if([401,403,429].includes(status)||blocked(body)){denied=true;throw Error('Brillio native public access denied')}
   if(status<200||status>=300)throw Error('Brillio native HTTP '+status)
   const requested=new URL(url),final=new URL(finalURL)
   if(requested.hostname!==final.hostname||requested.searchParams.get('job-id')!==final.searchParams.get('job-id')||expectedFinalUrls&&!expectedFinalUrls.some(expected=>isExactNativeHandoff(final.href,expected)))throw Error('Brillio native response identity redirect mismatch')
   return body
  }
  const inventory=async()=>{
   const rows=[],ids=new Set();let lastPage=1,pageSize=null
   for(let page=1;page<=lastPage;page++){
    const raw=await get(API,{method:'POST',body:searchBody(page),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}});pagesFetched++
    let data;try{data=JSON.parse(raw)}catch{throw Error('Brillio native search JSON invalid')}
    if(data?.success!==true||typeof data.data?.html!=='string'||typeof data.data.pagination!=='string')throw Error('Brillio native search response invalid')
    const parsed=listingJobs(data.data.html),pager=pagination(data.data.pagination,page)
    if(page===1){lastPage=pager.lastPage;pageSize=parsed.length}else if(pager.lastPage!==lastPage)throw Error('Brillio native page count changed')
    if(lastPage>1000||!parsed.length||page<lastPage&&parsed.length!==pageSize||page===lastPage&&parsed.length>pageSize||page<lastPage&&!pager.hasNext||page===lastPage&&pager.hasNext)throw Error('Brillio native pagination does not reconcile')
    for(const row of parsed){if(!row.jobId||!row.title||!row.location||row.visibilityUncertain||ids.has(row.jobId))throw Error('Brillio native listing duplicate or incomplete');ids.add(row.jobId);rows.push(row)}
   }
   return rows
  }
  try{
   const handoff=validateCorporate(await get(CORPORATE),CAREERS,[BOARD,BOARD_ROOT])
   if(handoff===CAREERS)validateCorporate(await get(CAREERS),BOARD)
   let board
   if(handoff===BOARD_ROOT){
    const landing=await get(BOARD_ROOT,{},[BOARD_ROOT,BOARD])
    try{validateClient(landing);board=landing}catch{validateCorporate(landing,BOARD);board=await get(BOARD)}
   }else board=await get(BOARD)
   validateClient(board);bindingVerified=true
   allRows.push(...await inventory());globalCount=allRows.length;enumerationComplete=true
   for(const row of allRows){
    const listingCountry=countryOf(row.location)
    if(listingCountry==='foreign'){foreignCount++;continue}
    let detail
    try{detail=jobDetail(await get(row.detailUrl),{jobId:row.jobId})}catch(error){errors.push({jobId:row.jobId,reason:error.message});detail=jobDetail('',{jobId:row.jobId})}
    if(denied)break
    if(detail.sourceNativeAvailability==='closed'){closedCount++;errors.push({jobId:row.jobId,reason:'explicit native role closing notice'});continue}
    if(detail.title&&detail.title!==row.title){detail.sourceDetailComplete=false;detail.sourceDetailFailureKind='native-title-identity-mismatch'}
    if(detail.location&&detail.location!==row.location){detail.sourceDetailComplete=false;detail.sourceDetailFailureKind='native-location-identity-mismatch'}
    const contextCountry=resolveWorksiteCountry({location:detail.location,description:detail.jobDescription,roleWorksiteStatements:detail.sourceRoleWorksiteStatements,complete:detail.sourceDetailComplete})
    let detailCountry=countryOf(detail.location)||(contextCountry.country==='United States'?'foreign':null)
    if(contextCountry.country)contextualCountryEvidence.push({jobId:row.jobId,...contextCountry})
    if(!listingCountry&&!detailCountry&&detail.sourceDetailComplete){
     try{
      const applicationCountry=await resolveNativeApplicationCountry(row,detail,get)
      contextualCountryEvidence.push(applicationCountry)
      detailCountry=applicationCountry.country==='India'?'India':'foreign'
     }catch(error){options.signal?.throwIfAborted();errors.push({jobId:row.jobId,reason:error.message})}
    }
    if(listingCountry==='India'&&detailCountry==='foreign'||listingCountry==='foreign'&&detailCountry==='India'){unknownCount++;errors.push({jobId:row.jobId,reason:'conflicting native country'});continue}
    if(listingCountry!=='India'&&detailCountry!=='India'){if(detailCountry==='foreign')foreignCount++;else unknownCount++;continue}
    if(detail.sourceDetailComplete)fullCount++
    jobs.push(decorate(row,detail,now))
   }
   if(!denied){const closing=await inventory();const identity=rows=>JSON.stringify(rows.map(r=>[r.jobId,r.title,r.location,r.requisitionId,r.nativePills]));closingMatches=identity(allRows)===identity(closing);if(!closingMatches)errors.push({reason:'closing native inventory changed'})}
  }catch(error){errors.push({reason:error.message})}
  const cap=Number.isInteger(options.maxJobs)?options.maxJobs:maxJobs,selected=Number.isInteger(cap)&&cap>=0?jobs.slice(0,cap):jobs
  const complete=enumerationComplete&&closingMatches&&!denied&&!unknownCount&&!errors.length&&fullCount===jobs.length&&selected.length===jobs.length
  const audit={globalCount,indiaCount:jobs.length,listedIndiaCount:allRows.filter(row=>countryOf(row.location)==='India').length,foreignCount,countryUnknownCount:unknownCount,closedCount,fullDetailCount:fullCount,returnedCount:selected.length,
   nativeReportedTotal:null,nativeIndiaFacetCount:null,globalPostingIds:allRows.map(row=>row.jobId),contextualCountryEvidence,
   enumerationComplete,closingInventoryMatches:closingMatches,bindingVerified,scopeComplete:complete,pagesFetched,denied,errors,requests}
  for(const job of selected)Object.assign(job,{sourceListingComplete:complete,sourceNativeInventory:audit,lifecycleCleanupAllowed:complete})
  const failureReasons=[...new Set(errors.map(error=>error.reason))].slice(0,5)
  return attachInventoryEvidence(selected,{status:complete?'complete-inventory':'coverage-gap',surface:BOARD,firstParty:bindingVerified,listingComplete:complete,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:complete?'native-unfiltered-pages-and-closing-inventory-reconciled':['native-country-detail-or-scope-unresolved',...failureReasons].join(':')})
 }
})
export const run=options=>createBrillioScraper().run(options)
