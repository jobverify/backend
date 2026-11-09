import {HOME,CAREERS,CLIENT,verifyExperionInventory,validateExperionDetail} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const check=(ok,message)=>{if(!ok)throw new Error('Experion current native inventory: '+message)}
export async function runNativeExperion(options={}){
 const {fetchImpl=globalThis.fetch}=options,timeoutMs=options.timeoutMs??90000,cap=options.maxJobs??Infinity
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid bounded deadline')
 check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid job cap')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();check(Number.isFinite(Date.parse(now)),'Invalid check time')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Experion source deadline')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const abort=()=>{if(signal.aborted)throw signal.reason||new Error('Caller aborted')}
 async function bounded(fn){abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason||new Error('Caller aborted'));signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
 async function get(url){const response=await bounded(()=>fetchImpl(url,{signal,redirect:'follow',headers:{Accept:'text/html,application/javascript'}}));check(response.status===200&&response.url===url,'Native HTTP status or URL changed');return bounded(()=>response.text())}
 try{
  const home=await get(HOME),html=await get(CAREERS),client=await get(CLIENT),rows=verifyExperionInventory(home,html,client),jobs=[]
  for(let start=0;start<rows.length;start+=2)jobs.push(...await Promise.all(rows.slice(start,start+2).map(async row=>validateExperionDetail(await get(row.sourceUrl),row,{now}))))
  const current=verifyExperionInventory(home,await get(CAREERS),client)
  check(JSON.stringify(rows)===JSON.stringify(current),'Native listing changed during detail collection')
  const remote=rows.some(j=>j.nativeRemoteScopeUnknown),capped=cap<jobs.length,complete=!remote&&!capped
  abort()
  return attachInventoryEvidence(jobs.slice(0,cap).map(j=>({...j,sourceListingComplete:complete})),{status:complete?'complete-inventory':'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:complete,pagesFetched:2,reportedTotal:rows.length,indiaFacetCount:rows.length,verifiedAt:now,reason:remote?'native-remote-country-scope-unresolved':capped?'caller-cap':'current-native-client-side-enumeration-and-stable-details'})
 }finally{clearTimeout(timer)}
}
