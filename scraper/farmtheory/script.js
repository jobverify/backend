import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {collectFarmTheoryNative, HOME_URL, EMPLOYER_URL} from './native.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='farmtheory', COMPANY='FarmTheory'
export const FIRST_PARTY_ROOT_URL='https://farmtheory.in/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createFarmTheoryScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000,now=new Date()}={...defaults,...options}
 const sourceNow=typeof now==='function'?now():now
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let pagesFetched=0,surface=HOME_URL,timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('FarmTheory coverage gap: '+reason,{cause}),{
  code:'FARMTHEORY_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:false,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async url=>{
   surface=url;controller.signal.throwIfAborted()
   const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html,application/json'}})
   const cancelBody=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
   if(controller.signal.aborted)cancelBody(controller.signal.reason)
   controller.signal.throwIfAborted()
   if(response.url!==url){const error=gap('Source final URL changed');cancelBody(error);throw error}
   if(response.status!==200){const error=Object.assign(gap('Source HTTP failure'),{status:response.status});cancelBody(error);throw error}
   let body
   if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0
    const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
    controller.signal.addEventListener('abort',cancel,{once:true})
    try{while(true){controller.signal.throwIfAborted();const {done,value}=await reader.read();controller.signal.throwIfAborted();if(done)break;bytes+=value.byteLength;if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source body exceeds bound')}chunks.push(value)}body=Buffer.concat(chunks).toString('utf8')}
    finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock()}
   }else {cancelBody();throw gap('Bounded readable response stream unavailable')}
   controller.signal.throwIfAborted()
   if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000000)throw gap('Source body missing or exceeds bound')
   pagesFetched++;retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
   return body
  }
  const {jobs, facts, firstParty, reason}=await collectFarmTheoryNative({read,now:sourceNow})
  const result=attachInventoryEvidence(jobs,{status:'discovery-only',surface:EMPLOYER_URL,firstParty,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,...facts,lifecycleCleanupAllowed:false}})
  return result
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='FARMTHEORY_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createFarmTheoryScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/farmtheory/script.js')){
 const jobs=await run()
 if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
}
