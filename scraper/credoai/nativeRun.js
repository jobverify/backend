import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {HOME,CAREERS,BOARD,API,check,verifyCorporate,preload,validateInventory,validateDetail} from './nativeContract.js'
export async function runNative(options={}){
 const now=new Date(options.now??Date.now()).toISOString(),timeout=options.timeoutMs??90000
 check(options.maxJobs==null,'Partial caps unsupported');check(Number.isSafeInteger(timeout)&&timeout>0&&timeout<=180000,'Invalid timeout')
 const c=new AbortController(),timer=setTimeout(()=>c.abort(Error('Credo AI deadline exceeded')),timeout),signal=options.signal?AbortSignal.any([options.signal,c.signal]):c.signal
 async function get(url){signal.throwIfAborted();let abort;try{return await Promise.race([new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true})}),(async()=>{const r=await(options.fetch??fetch)(url,{method:'GET',signal,redirect:'error'});signal.throwIfAborted();check(r.status===200&&r.url===url,'Native transport status/final URL mismatch');const body=await r.text();signal.throwIfAborted();check(Buffer.byteLength(body)<=2500000,'Native response too large');return body})()])}finally{signal.removeEventListener('abort',abort)}}
 try{
  verifyCorporate(await get(HOME),await get(CAREERS));const board=preload(await get(BOARD)),payload=JSON.parse(await get(API)),india=validateInventory(payload,board,now),descriptions=new Map()
  for(const row of india)descriptions.set(row.id,validateDetail(row,preload(await get(row.jobUrl)),preload(await get(row.applyUrl))))
  const mapped=await createPublishingGapAtsScraper({source:'credoai',companyName:'Credo AI',atsPlatform:'ashby',boardToken:'credo.ai'}).run({signal,fetchJson:async url=>{check(url===API,'Unexpected shared public API');return payload}})
  check(mapped.length===india.length&&mapped.every(j=>descriptions.has(j.jobId)),'Shared mapping lost/added native India IDs')
  const final=JSON.parse(await get(API)),finalBoard=preload(await get(BOARD));validateInventory(final,finalBoard,now)
  check(JSON.stringify(final)===JSON.stringify(payload)&&JSON.stringify(finalBoard.jobBoard)===JSON.stringify(board.jobBoard),'Native inventory changed during extraction');signal.throwIfAborted()
  const jobs=mapped.map(j=>({...j,jobDescription:descriptions.get(j.jobId),description:descriptions.get(j.jobId),sourceDescription:descriptions.get(j.jobId),sourceDetailComplete:!!descriptions.get(j.jobId),sourceDetailStatus:descriptions.get(j.jobId)?'complete':'missing-content',sourceListingComplete:false,sourceScopeComplete:false,nativeLegalEmployer:null,nativeBrand:'Credo.AI',nativeObservedBoardCount:payload.jobs.length,nativeUnknownLocationIds:payload.jobs.filter(r=>r.address===null).map(r=>r.id),scrapedAt:now}))
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:1,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'Stable public Ashby board/API plus full explicit India role/application pages. Generic Remote future-hiring record unresolved; other hiring surfaces and whole-company scope unproven.'})
 }finally{clearTimeout(timer);c.abort()}
}
