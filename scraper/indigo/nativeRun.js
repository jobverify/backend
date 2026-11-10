import {CORPORATE,BOARD,API,REMOTE_ENTRY,APP,verifyIndigoBinding,readIndigoJobs} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const check=(ok,message)=>{if(!ok)throw new Error('Indigo current native inventory: '+message)}
export async function runNativeIndigo(options={}){
 const {fetchImpl=globalThis.fetch}=options,timeoutMs=options.timeoutMs??90000,requestTimeoutMs=options.requestTimeoutMs??20000,cap=options.maxJobs??Infinity
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=180000,'Invalid bounded deadline');check(cap===Infinity||Number.isInteger(cap)&&cap>=0,'Invalid job cap')
 check(Number.isInteger(requestTimeoutMs)&&requestTimeoutMs>0&&requestTimeoutMs<=20000,'Invalid HTTP read deadline')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString();check(Number.isFinite(Date.parse(now)),'Invalid check time')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Object.assign(new Error('Indigo source deadline'),{
  name:'TimeoutError',source:'indigo',sourceTimeoutMs:timeoutMs,failureKind:'network_or_timeout',softFailure:true,upstreamOutage:true,abortRetries:true,
 })),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
 const abort=(active=signal)=>{if(signal.aborted)throw signal.reason;if(active.aborted)throw active.reason}
 const cancelBody=(response,reason)=>{try{Promise.resolve(response?.body?.cancel?.(reason)).catch(()=>{})}catch{}}
 async function bounded(fn,active=signal,disposeLate){
  abort(active);let listener,value,hasValue=false,disposed=false
  const dispose=reason=>{if(hasValue&&!disposed&&disposeLate){disposed=true;disposeLate(value,reason)}}
  const operation=Promise.resolve().then(()=>{abort(active);return fn()}).then(result=>{
   value=result;hasValue=true
   if(signal.aborted||active.aborted)dispose(signal.aborted?signal.reason:active.reason)
   return result
  })
  try{return await Promise.race([operation,new Promise((_,reject)=>{
   listener=()=>{try{abort(active)}catch(error){reject(error)}}
   active.addEventListener('abort',listener,{once:true})
  })])}finally{
   active.removeEventListener('abort',listener)
   try{abort(active)}catch(error){dispose(error);throw error}
  }
 }
 async function get(url,headers={}){
  abort();const requestController=new AbortController(),requestSignal=AbortSignal.any([signal,requestController.signal])
  let stage='headers',response,reader
  // One read budget covers both headers and body, inside the unchanged source
  // deadline. Abort the transport as well as settling uncooperative hooks.
  const requestTimer=setTimeout(()=>{
   if(signal.aborted)return
   requestController.abort(Object.assign(new Error(`Indigo HTTP read timeout during ${stage} after ${requestTimeoutMs}ms: ${url}`),{
    name:'TimeoutError',code:'INDIGO_HTTP_READ_TIMEOUT',source:'indigo',requestUrl:url,stage,timeoutMs:requestTimeoutMs,
    failureKind:'network_or_timeout',softFailure:true,upstreamOutage:true,abortRetries:true,
   }))
  },requestTimeoutMs)
  try{
   response=await bounded(()=>fetchImpl(url,{signal:requestSignal,redirect:'follow',headers:{Accept:'text/html,application/json,application/javascript',Origin:'https://www.goindigo.in',Referer:BOARD,...headers}}),requestSignal,cancelBody)
   check(response.status===200&&response.url===url,'Native HTTP status or URL changed')
   stage='body';let body
   if(response.body?.getReader){
    // Own the reader so a stalled real Response can be cancelled while locked.
    reader=response.body.getReader();const decoder=new TextDecoder();body=''
    while(true){
     const {done,value}=await bounded(()=>reader.read(),requestSignal)
     if(done){body+=decoder.decode();break}
     check(value instanceof Uint8Array,'Native response content invalid')
     body+=decoder.decode(value,{stream:true})
     check(body.length<=8000000,'Native response content invalid')
    }
   }else body=await bounded(()=>response.text(),requestSignal)
   check(typeof body==='string'&&body.length<=8000000,'Native response content invalid');return body
  }catch(error){
   requestController.abort(error)
   if(reader){try{Promise.resolve(reader.cancel(error)).catch(()=>{})}catch{}}else cancelBody(response,error)
   throw error
  }finally{
   clearTimeout(requestTimer)
   if(reader){try{reader.releaseLock()}catch{}}
  }
 }
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
