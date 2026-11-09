import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {CAREERS_URL,BOARD_URL,API_URL,LEGAL_URL,check,parseCorporate,validateClient,validateLegal,parseBoard,parseListing,mergeListings,parseDetail,sameNative} from './native.js'
export {CAREERS_URL,BOARD_URL,API_URL}
export const SOURCE='branchmetrics'
export const COMPANY='Branch Metrics'
const apiUrl=page=>API_URL.replace('page=0',`page=${page}`)
const fetchText=async(url,{signal}={})=>{
 const response=await fetch(url,{credentials:'omit',redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{accept:'text/html,application/json'}})
 if(response.status!==200||response.url!==url)throw Error(`Branch Metrics native HTTP ${response.status} or unexpected redirect for ${url}`)
 return response.text()
}
export async function run({fetchText:get=fetchText,signal,maxPages=20,maxJobs=500,now=new Date()}={}){
 check(Number.isInteger(maxPages)&&maxPages>0&&maxPages<=100&&Number.isInteger(maxJobs)&&maxJobs>0&&maxJobs<=10000,'invalid inventory caps')
 const active=signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)
 const request=async url=>{active.throwIfAborted();let listener
  try{return await Promise.race([Promise.resolve().then(()=>get(url,{signal:active})),new Promise((_resolve,reject)=>{listener=()=>reject(active.reason);active.addEventListener('abort',listener,{once:true})})])}
  finally{active.removeEventListener('abort',listener);active.throwIfAborted()}
 }
 const binding=parseCorporate(await request(CAREERS_URL))
 const[client,legal,boardHtml]=await Promise.all([request(binding.clientUrl),request(LEGAL_URL),request(BOARD_URL)])
 validateClient(client);validateLegal(legal);const board=parseBoard(boardHtml)
 let page=0,total=null,totalPages=null,pagesFetched=0,complete=false
 const rows=[]
 while(page<maxPages){
  const payload=parseListing(JSON.parse(await request(apiUrl(page))),page);pagesFetched++
  if(total!==null)check(total===payload.totalItems&&totalPages===payload.totalPages,'native inventory total drift')
  total=payload.totalItems;totalPages=payload.totalPages;rows.push(...payload.rows)
  if(page===0)check(board.totalItems===total&&sameNative(board.rows,rows.slice(0,board.rows.length)),'native board and public API inventory differ')
  page++
  if(page>=totalPages){complete=rows.length===total;break}
 }
 const listings=mergeListings(rows)
 let cursor=0;const details=new Map();let identityComplete=true
 // Validate every current native vacancy, including foreign roles, before a
 // whole-board inventory claim. Only explicit India locations become jobs.
 await Promise.all(Array.from({length:Math.min(2,listings.length)},async()=>{
  while(cursor<listings.length){const listing=listings[cursor++]
   try{details.set(listing.jobId,parseDetail(await request(listing.sourceUrl),listing,{now}))}
   catch(error){active.throwIfAborted();identityComplete=false;details.set(listing.jobId,{jobDescription:'',sourceDescription:'',sourceDetailComplete:false,
    sourceDetailFailureKind:error.code==='BRANCHMETRICS_NATIVE_CONTRACT'?'identity-mismatch':'upstream'})}
  }
 }))
 if(complete){
  for(let finalPage=0;finalPage<Math.max(1,totalPages);finalPage++){
   const final=parseListing(JSON.parse(await request(apiUrl(finalPage))),finalPage)
   check(final.totalItems===total&&final.totalPages===totalPages&&sameNative(final.rows,rows.slice(finalPage*1000,finalPage*1000+final.rows.length)),'final native inventory drift')
  }
  if(totalPages>0){const terminal=parseListing(JSON.parse(await request(apiUrl(totalPages))),totalPages);check(terminal.totalItems===total&&terminal.totalPages===totalPages,'terminal native total drift')}
 }
 const india=listings.filter(listing=>listing.locations.some(l=>l.countryCode==='IN'))
 const selected=india.slice(0,maxJobs),healthy=selected.every(listing=>details.get(listing.jobId)?.sourceDetailComplete===true)
 complete=complete&&identityComplete&&selected.length===india.length&&healthy
 const jobs=selected.map(listing=>{
  const places=listing.locations.filter(l=>l.countryCode==='IN'),detail=details.get(listing.jobId)
  return{jobId:listing.jobId,requisitionId:listing.jobId,title:listing.title,source:SOURCE,company:COMPANY,
   companyDomain:'branch.io',companyCareerPage:CAREERS_URL,location:places.map(l=>l.name).join(' / '),city:places[0].city??null,state:places[0].state??null,country:'India',
   department:listing.department.name,sourceUrl:listing.sourceUrl,applyUrl:listing.sourceUrl,link:listing.sourceUrl,
   sourceNativeRecordCount:total,sourceNativeVacancyCount:listings.length,sourceNativeLocations:listing.locations,
   ...detail,sourceListingComplete:complete,scrapedAt:new Date().toISOString()}
 })
 active.throwIfAborted()
 return attachInventoryEvidence(jobs,{status:complete?(total===0?'verified-empty':'complete-inventory'):'discovery-only',firstParty:true,listingComplete:complete,
  surface:API_URL,pagesFetched,reportedTotal:total,indiaFacetCount:india.length,verifiedAt:new Date().toISOString(),
  reason:complete?'branchmetrics-current-corporate-client-legal-company-native-records-unique-vacancies-all-role-identities-and-full-India-details-reconciled':'branchmetrics-native-observed-inventory-or-details-incomplete'})
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
