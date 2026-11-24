import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {CAREERS_URL,BOARD_URL,API_URL,LEGAL_URL,check,parseCorporate,validateClient,validateLegal,parseBoard,parseListing,mergeListings,parseDetail,sameNative} from './native.js'
export {CAREERS_URL,BOARD_URL,API_URL}
export const SOURCE='branchmetrics'
export const COMPANY='Branch Metrics'
const apiUrl=page=>API_URL.replace('page=0',`page=${page}`)
const fetchText=async(url,{signal}={})=>{
 // The source already owns a bounded 120-second budget. A second, shorter
 // request deadline discarded valid public responses within that budget.
 const response=await fetch(url,{credentials:'omit',redirect:'manual',signal:signal||AbortSignal.timeout(20000),headers:{accept:'text/html,application/json'}})
 if(response.status!==200)throw Error(`Branch Metrics native HTTP ${response.status} for ${url}`)
 check(response.url===url,'public response redirect identity changed for '+url)
 return response.text()
}
export async function run({fetchText:get=fetchText,signal,maxPages=20,maxJobs=500,now=new Date()}={}){
 check(Number.isInteger(maxPages)&&maxPages>0&&maxPages<=100&&Number.isInteger(maxJobs)&&maxJobs>0&&maxJobs<=10000,'invalid inventory caps')
 const deadline=AbortSignal.timeout(120000),active=signal?AbortSignal.any([signal,deadline]):deadline
 const request=async url=>{signal?.throwIfAborted();active.throwIfAborted();let listener
  try{return await Promise.race([Promise.resolve().then(()=>get(url,{signal:active})),new Promise((_resolve,reject)=>{listener=()=>reject(active.reason);active.addEventListener('abort',listener,{once:true})})])}
  finally{active.removeEventListener('abort',listener);signal?.throwIfAborted();active.throwIfAborted()}
 }
 const binding=parseCorporate(await request(CAREERS_URL))
 // Start the independent board read immediately. Read the advertised API only
 // after the exact current client and legal employer have both been verified.
 const boardRead=request(BOARD_URL),firstPageRead=Promise.all([request(binding.clientUrl),request(LEGAL_URL)])
  .then(([client,legal])=>{validateClient(client);validateLegal(legal);return request(apiUrl(0))})
 const[boardHtml,firstPageBody]=await Promise.all([boardRead,firstPageRead]),board=parseBoard(boardHtml)
 let page=0,total=null,totalPages=null,pagesFetched=0,complete=false
 const rows=[]
 while(page<maxPages){
  const payload=parseListing(JSON.parse(page===0?firstPageBody:await request(apiUrl(page))),page);pagesFetched++
  if(total!==null)check(total===payload.totalItems&&totalPages===payload.totalPages,'native inventory total drift')
  total=payload.totalItems;totalPages=payload.totalPages;rows.push(...payload.rows)
  if(page===0)check(board.totalItems===total&&sameNative(board.rows,rows.slice(0,board.rows.length)),'native board and public API inventory differ')
  page++
  if(page>=totalPages){complete=rows.length===total;break}
 }
 const listings=mergeListings(rows)
 const initialListingComplete=complete,isIndia=listing=>listing.locations.some(location=>location.countryCode==='IN')
 const india=listings.filter(isIndia),detailQueue=[...listings].sort((a,b)=>Number(isIndia(b))-Number(isIndia(a)))
 let cursor=0;const details=new Map();let identityComplete=true
 let interruption=null,closingComplete=false
 const stopForDeadline=()=>{
  signal?.throwIfAborted()
  if(!deadline.aborted)return false
  interruption||={kind:'source-deadline',message:deadline.reason?.message||String(deadline.reason)}
  return true
 }
 // Validate every current native vacancy, including foreign roles, before a
 // whole-board inventory claim. Prioritize explicit India roles so a slow
 // unrelated role cannot consume the entire budget before useful details.
 await Promise.all(Array.from({length:Math.min(2,listings.length)},async()=>{
  while(cursor<detailQueue.length){
   if(stopForDeadline())break
   const listing=detailQueue[cursor++]
   try{details.set(listing.jobId,parseDetail(await request(listing.sourceUrl),listing,{now}))}
   catch(error){if(stopForDeadline())break;identityComplete=false;details.set(listing.jobId,{jobDescription:'',sourceDescription:'',sourceDetailComplete:false,
    sourceDetailFailureKind:error.code==='BRANCHMETRICS_NATIVE_CONTRACT'?'identity-mismatch':'upstream'})}
  }
 }))
 stopForDeadline()
 const closingUnavailable=Symbol('closing-transport-unavailable')
 const closingRead=async url=>{
  try{return await request(url)}catch(error){
   signal?.throwIfAborted()
   if(error?.code==='BRANCHMETRICS_NATIVE_CONTRACT'||error instanceof SyntaxError)throw error
   if(!stopForDeadline())interruption||={kind:'closing-transport-failure',message:error?.message||String(error)}
   return closingUnavailable
  }
 }
 if(complete&&!interruption){
  for(let finalPage=0;finalPage<Math.max(1,totalPages);finalPage++){
   const body=await closingRead(apiUrl(finalPage));if(body===closingUnavailable)break
   const final=parseListing(JSON.parse(body),finalPage)
   check(final.totalItems===total&&final.totalPages===totalPages&&sameNative(final.rows,rows.slice(finalPage*1000,finalPage*1000+final.rows.length)),'final native inventory drift')
  }
  if(!interruption&&totalPages>0){
   const body=await closingRead(apiUrl(totalPages))
   if(body!==closingUnavailable){const terminal=parseListing(JSON.parse(body),totalPages);check(terminal.totalItems===total&&terminal.totalPages===totalPages,'terminal native total drift')}
  }
  closingComplete=!interruption
 }
 let selected=india.slice(0,maxJobs)
 const healthy=selected.every(listing=>details.get(listing.jobId)?.sourceDetailComplete===true)
 complete=complete&&closingComplete&&!interruption&&identityComplete&&selected.length===india.length&&healthy
 // An interrupted collection exposes only independently validated full roles.
 // It cannot promote unvisited listing cards or failed identity placeholders.
 if(interruption)selected=selected.filter(listing=>details.get(listing.jobId)?.sourceDetailComplete===true)
 const jobs=selected.map(listing=>{
  const places=listing.locations.filter(l=>l.countryCode==='IN'),detail=details.get(listing.jobId)
  return{jobId:listing.jobId,requisitionId:listing.jobId,title:listing.title,source:SOURCE,company:COMPANY,
   companyDomain:'branch.io',companyCareerPage:CAREERS_URL,location:places.map(l=>l.name).join(' / '),city:places[0].city??null,state:places[0].state??null,country:'India',
   department:listing.department.name,sourceUrl:listing.sourceUrl,applyUrl:listing.sourceUrl,link:listing.sourceUrl,
   sourceNativeRecordCount:total,sourceNativeVacancyCount:listings.length,sourceNativeLocations:listing.locations,
   ...detail,sourceListingComplete:complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()}
 })
 signal?.throwIfAborted()
 Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{source:SOURCE,initialListingComplete,closingComplete,
  nativeRecordCount:total,nativeVacancyCount:listings.length,detailAttempts:cursor,settledDetailAttempts:details.size,
  detailFailures:[...details].filter(([_id,detail])=>detail.sourceDetailComplete!==true).map(([id,detail])=>({id,kind:detail.sourceDetailFailureKind})),
  uninspectedNativeIds:listings.filter(listing=>!details.has(listing.jobId)).map(listing=>listing.jobId),interruption,
  configuredBoardListingComplete:complete,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
 return attachInventoryEvidence(jobs,{status:complete?(total===0?'verified-empty':'complete-inventory'):interruption?'coverage-gap':'discovery-only',firstParty:true,listingComplete:complete,lifecycleCleanupAllowed:false,
  surface:API_URL,pagesFetched,reportedTotal:total,indiaFacetCount:india.length,verifiedAt:new Date().toISOString(),
  reason:complete?'branchmetrics-current-corporate-client-legal-company-native-records-unique-vacancies-all-role-identities-and-full-India-details-reconciled;public-board-scope-only':'branchmetrics-native-observed-inventory-or-details-incomplete'+(interruption?';'+interruption.kind:'')})
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
