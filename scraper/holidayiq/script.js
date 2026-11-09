import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inspectHolidayIQNative,inspectHolidayIQHome} from './native.js'
import candidate from './catalog-candidate.json' with {type:'json'}
export const SOURCE='holidayiq',COMPANY_NAME='HolidayIQ',CAREERS_URL='https://www.holidayiq.com/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createHolidayIQScraper=(defaults={})=>({async run(options={}){
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 const gap=(reason,cause)=>Object.assign(new Error('HolidayIQ coverage gap: '+reason,{cause}),{code:'HOLIDAYIQ_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:CAREERS_URL,firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})})
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 let timer,onAbort
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source fetch/body deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const read=async(url,negativeProbe=false)=>{
  const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html,application/json'}})
  const cancel=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
  if(controller.signal.aborted)cancel(controller.signal.reason)
  controller.signal.throwIfAborted()
  if(response.url!==url){const error=gap('Source final URL changed');cancel(error);throw error}
  if(!response.body?.getReader){const error=gap('Bounded source stream unavailable');cancel(error);throw error}
  const reader=response.body.getReader(),chunks=[];let bytes=0
  const cancelReader=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
  controller.signal.addEventListener('abort',cancelReader,{once:true})
  try{while(true){controller.signal.throwIfAborted();const {done,value}=await reader.read();controller.signal.throwIfAborted();if(done)break;bytes+=value.byteLength;if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds byte limit')}chunks.push(Buffer.from(value))}}
  catch(error){void reader.cancel(error).catch(()=>{});throw error}
  finally{controller.signal.removeEventListener('abort',cancelReader);reader.releaseLock()}
  const body=Buffer.concat(chunks).toString('utf8')
  retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
  if(response.status!==200){
   if(negativeProbe&&response.status===403&&body.includes('challenges.cloudflare.com'))return body
   throw Object.assign(gap('Source HTTP failure; employer recruiting inventory unavailable'),{status:response.status})
  }
  if(!body.trim())throw gap('Source body missing')
  return body
 }
 const collect=async()=>{
  inspectHolidayIQHome(await read(CAREERS_URL,true))
  const facts=await inspectHolidayIQNative({read})
  const error=gap(facts.reason)
  error.nativeCollectionEvidence={...facts,retainedResponses}
  error.discoveryEvidence=facts
  throw error
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='HOLIDAYIQ_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createHolidayIQScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/holidayiq/script.js')){
 try{await run()}catch(error){console.error(error.message);process.exitCode=1}
}
