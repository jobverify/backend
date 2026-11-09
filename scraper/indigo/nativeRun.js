import {CORPORATE,BOARD,API,REMOTE_ENTRY,APP,verifyIndigoBinding,readIndigoJobs} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const check=(ok,message)=>{if(!ok)throw new Error('Indigo current native inventory: '+message)}
export async function runNativeIndigo(options={}){
 const {fetchImpl=globalThis.fetch}=options,timeoutMs=options.timeoutMs??90000,cap=options.maxJobs??Infinity
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid bounded deadline');check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid job cap')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();check(Number.isFinite(Date.parse(now)),'Invalid check time')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Indigo source deadline')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const abort=()=>{if(signal.aborted)throw signal.reason||new Error('Caller aborted')}
 async function bounded(fn){abort();let listener;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{listener=()=>reject(signal.reason||new Error('Caller aborted'));signal.addEventListener('abort',listener,{once:true})})])}finally{signal.removeEventListener('abort',listener);abort()}}
 async function get(url,headers={}){const response=await bounded(()=>fetchImpl(url,{signal,redirect:'follow',headers:{Accept:'text/html,application/json,application/javascript',Origin:'https://www.goindigo.in',Referer:BOARD,...headers}}));check(response.status===200&&response.url===url,'Native HTTP status or URL changed');const body=await bounded(()=>response.text());check(typeof body==='string'&&body.length<=8000000,'Native response content invalid');return body}
 try{
  const corporate=await get(CORPORATE),board=await get(BOARD),remote=await get(REMOTE_ENTRY),app=await get(APP),config=verifyIndigoBinding(corporate,board,remote,app)
  const fetchRows=async()=>{const payload=JSON.parse(await get(API,{user_key:config.userKey})),officeHolds=[];return{payload,officeHolds,jobs:readIndigoJobs(payload,{now,config,onUnsupportedOffice:hold=>officeHolds.push(hold)})}}
  const first=await fetchRows(),last=await fetchRows();check(JSON.stringify(first.payload)===JSON.stringify(last.payload),'Native full response changed during collection')
  const qualified=first.jobs.filter(job=>job.sourceDetailComplete),missingCriteria=first.jobs.filter(job=>!job.sourceDetailComplete).map(job=>({jobId:job.jobId,title:job.title,reason:'native-full-description-placeholder-or-missing'}))
  const capped=cap<qualified.length,jobs=qualified.slice(0,cap).map(job=>({...job,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:true}))
  const evidence={source:'indigo',observedNativeRecords:first.payload.result.length,fullyQualifiedNativeRecords:qualified.length,returnedQualifiedRecords:jobs.length,
   officeHolds:first.officeHolds,missingCriteria,nativeRecords:structuredClone(first.payload.result),closingInventoryMatches:true,
   nativeInventoryTotal:first.payload.result.length,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false,callerCapped:capped,
   candidateDetails:first.payload.result.length,extractedDetailJobs:jobs.length,jobs:jobs.map(job=>({id:job.jobId})),failures:[...first.officeHolds,...missingCriteria]}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:evidence,configurable:true})
  abort();return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:API,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,
   reason:'declared-native-feed-only;observed:'+evidence.observedNativeRecords+';full-qualified:'+qualified.length+';office-holds:'+first.officeHolds.length+';missing-criteria:'+missingCriteria.length+(capped?';caller-cap':'')+';company-inventory-not-certified'})
 }finally{clearTimeout(timer)}
}
