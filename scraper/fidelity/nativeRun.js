import{HOME,BOARD,FEED,parseFidelityHome,parseFidelityBoard,parseFidelityFeed,reconcileFidelityBoardFeed,validateFidelityDetail}from'./nativeContract.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const check=(ok,m)=>{if(!ok)throw Error('Fidelity native run: '+m)},canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)
export async function runNativeFidelity(options={}){
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),cap=options.maxJobs??Infinity,timeoutMs=options.timeoutMs??120000
 check(Number.isFinite(Date.parse(now)),'Invalid check time');check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid source cap');check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid deadline')
 const timerController=new AbortController(),timer=setTimeout(()=>timerController.abort(new Error('Fidelity source deadline')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,timerController.signal]):timerController.signal,abort=()=>signal.throwIfAborted()
 async function bounded(fn){abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason||Error('Caller aborted'));signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
 async function get(url){let p;if(options.fetchPage)p=await bounded(()=>options.fetchPage(url,{signal}));else{const r=await bounded(()=>fetch(url,{signal,headers:{Accept:'text/html,application/xml;q=0.9,*/*;q=0.8','User-Agent':'Mozilla/5.0'},redirect:'follow'})),body=await bounded(()=>r.text());p={status:r.status,url:r.url,body}}
  if(p?.status!==200||p.url!==url||typeof p.body!=='string'||p.body.length>5000000){const error=Error('Fidelity native public HTTP/identity unavailable: '+String(p?.status??'unknown')+' '+url);error.failureKind=p?.status===403?'upstream_blocked':'native_http_contract_failure';error.httpStatus=p?.status??null;throw error}return p.body}
 try{
  const identity=parseFidelityHome(await get(HOME)),board=parseFidelityBoard(await get(BOARD)),feed=parseFidelityFeed(await get(FEED),{now});reconcileFidelityBoardFeed(board,feed)
  const jobs=[];for(let i=0;i<feed.jobs.length;i+=2)jobs.push(...await Promise.all(feed.jobs.slice(i,i+2).map(async job=>validateFidelityDetail(await get(job.sourceUrl),job))))
  const finalBoard=parseFidelityBoard(await get(BOARD)),finalFeed=parseFidelityFeed(await get(FEED),{now});reconcileFidelityBoardFeed(finalBoard,finalFeed);check(canonical(board)===canonical(finalBoard)&&canonical(feed.jobs)===canonical(finalFeed.jobs),'Native listing/feed drift');abort()
  const sourceBoardInventory={scope:'current-unfiltered-regional-India-careers-board',observedNativeRows:board.total,observedIndiaRows:feed.jobs.length,uniqueNativeIDs:jobs.length,fullNativeDetails:jobs.filter(j=>j.sourceDetailComplete).length,stableBoardResponses:2,stableFeedResponses:2,boardInventoryComplete:true,companyCoverageComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
  const output=jobs.slice(0,cap).map(job=>({...job,scrapedAt:now,sourceBoardInventory,sourceOfficialIdentity:{...identity,checkedAt:now},sourceCompanyCoverageComplete:false,sourceListingComplete:false,sourceGlobalJobCount:null}))
  return attachInventoryEvidence(output,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:cap<jobs.length?'caller-cap-with-unknown-company-scope':'regional-india-board-and-feed-reconciled-whole-company-scope-unproven'})
 }finally{clearTimeout(timer)}
}
