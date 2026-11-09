import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {collectSuperGamingNative} from './native.js'
import {SUPERGAMING_CATALOG as candidate} from './catalog.js'

export const SOURCE='supergaming', COMPANY='SuperGaming'
export const CAREERS_URL='https://www.supergaming.com/careers',CONTACT_EMAIL='careers@supergaming.com'
export const FIRST_PARTY_ROOT_URL='https://www.supergaming.com/careers'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createSuperGamingScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000,now=new Date()}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let surface=FIRST_PARTY_ROOT_URL,timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('SuperGaming coverage gap: '+reason,{cause}),{
  code:'SUPERGAMING_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const deadline=performance.now()+timeoutMs
 const checkBudget=()=>{
  if(!controller.signal.aborted&&performance.now()>=deadline)controller.abort(gap('Aggregate source fetch/body/parsing deadline exceeded'))
  controller.signal.throwIfAborted()
 }
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source fetch/body deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async url=>{
   surface=url;checkBudget()
   const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html,application/json'}})
   const cancelBody=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
   try{checkBudget()}catch(error){cancelBody(error);throw error}
   if(response.url!==url){const error=gap('Source final URL changed');cancelBody(error);throw error}
   if(response.status!==200){const error=Object.assign(gap('Source HTTP failure'),{status:response.status});cancelBody(error);throw error}
   let body
   if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0
    const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
    controller.signal.addEventListener('abort',cancel,{once:true})
    try{while(true){checkBudget();const {done,value}=await reader.read();checkBudget();if(done)break;bytes+=value.byteLength;if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds byte limit')}chunks.push(Buffer.from(value))}body=Buffer.concat(chunks).toString('utf8')}
    finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock()}
   }else {const error=gap('Bounded source stream unavailable');cancelBody(error);throw error}
   checkBudget()
   if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000000)throw gap('Source body missing or exceeds bound')
   retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
   return body
  }
  const {jobs,facts,firstParty,reason,inventoryStatus}=await collectSuperGamingNative({read,now:typeof now==='function'?now():now})
  checkBudget()
  const result=attachInventoryEvidence(jobs,{status:inventoryStatus,surface,firstParty,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,...facts,lifecycleCleanupAllowed:false}})
  attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:facts.nativeObservedRecordCount,
   observedVacancyCount:facts.nativeObservedRecordCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return result
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='SUPERGAMING_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable: '+error.message,error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createSuperGamingScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/supergaming/script.js')){
 const jobs=await run()
 if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
}
