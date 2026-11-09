import {CORPORATE,BOARD,API,CONTROLLER,MAIN,TEMPLATE,verifyAeriesBinding,readAeriesRows,nativeRoleUrl,validateAeriesDetail} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const check=(ok,message)=>{if(!ok)throw new Error('Aeries current native inventory: '+message)}
const body=()=>({parameters:JSON.stringify({intFunctionalArea:0,intPageIndex:1,searchKeyword:'',strLocation:'',jobSearch:'',queryString:'',FilterDataSource:null})})
export async function runNativeAeries(options={}){
 const {fetchImpl=globalThis.fetch}=options,timeoutMs=options.timeoutMs??120000,cap=options.maxJobs??Infinity
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid bounded deadline')
 check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid job cap')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();check(Number.isFinite(Date.parse(now)),'Invalid check time')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Aeries source deadline')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const abort=()=>{if(signal.aborted)throw signal.reason||new Error('Caller aborted')}
 async function bounded(fn){abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason||new Error('Caller aborted'));signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
 async function get(url,requestBody){const response=await bounded(()=>fetchImpl(url,{signal,redirect:'follow',headers:{Accept:'text/html,application/json,application/javascript','Content-Type':'application/json; charset=UTF-8'},...(requestBody?{method:'POST',body:JSON.stringify(requestBody)}:{})}));check(response.status===200&&response.url===url,'Native HTTP status or URL changed');const text=await bounded(()=>response.text());check(typeof text==='string'&&text.length<8000000,'Native response exceeds bounded content contract');return text}
 async function listing(){let payload;try{payload=JSON.parse(await get(API,body()))}catch(error){throw new Error('Aeries native listing failed: '+error.message)}return readAeriesRows(payload,{now})}
 try{
  const corporate=await get(CORPORATE),board=await get(BOARD),controllerCode=await get(CONTROLLER),main=await get(MAIN),template=await get(TEMPLATE)
  verifyAeriesBinding(corporate,board,controllerCode,main,template)
  const rows=await listing(),jobs=[]
  for(let start=0;start<rows.length;start+=2)jobs.push(...await Promise.all(rows.slice(start,start+2).map(async row=>validateAeriesDetail(await get(nativeRoleUrl(row)),row,{now}))))
  check(new Set(jobs.map(j=>j.nativeDisplayJobId)).size===jobs.length,'Duplicate native display job identity')
  const current=await listing();check(JSON.stringify(rows)===JSON.stringify(current),'Native full inventory changed during detail collection')
  const missing=jobs.some(j=>!j.sourceDetailComplete),capped=cap<jobs.length,complete=!missing&&!capped
  abort()
  return attachInventoryEvidence(jobs.slice(0,cap).map(j=>({...j,sourceListingComplete:complete})),{status:complete?(jobs.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:API,firstParty:true,listingComplete:complete,pagesFetched:2,reportedTotal:rows.length,indiaFacetCount:rows.length,verifiedAt:now,reason:missing?'native-full-description-placeholder-or-missing':capped?'caller-cap':'current-all-public-Jobs-local-pagination-and-stable-full-details'})
 }finally{clearTimeout(timer)}
}
