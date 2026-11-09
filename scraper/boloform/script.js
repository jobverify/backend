import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='boloform', COMPANY='Boloform'
export const FIRST_PARTY_ROOT_URL='https://www.boloform.se/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}

// Current configured domain is a Wix HTTP404 domain-connection error. A newly
// accessible source requires native employer and vacancy review before use.
export const createBoloformScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('Boloform coverage gap: '+reason,{cause}),{
  code:'BOLOFORM_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
  sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:FIRST_PARTY_ROOT_URL,
   firstParty:false,listingComplete:false,pagesFetched:retainedResponses.length,
   reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=gap('Aggregate source fetch/body deadline exceeded');controller.abort(error);reject(error)},timeoutMs)
 })
 const probe=async()=>{
  const response=await fetchImpl(FIRST_PARTY_ROOT_URL,{signal:controller.signal,redirect:'error',headers:{Accept:'text/html,application/json'}})
  const cancelBody=reason=>{void Promise.resolve().then(()=>response.body?.cancel?.(reason)).catch(()=>{})}
  if(controller.signal.aborted)cancelBody(controller.signal.reason)
  controller.signal.throwIfAborted()
  if(response.url!==FIRST_PARTY_ROOT_URL||response.status!==200){
   retainedResponses.push({url:FIRST_PARTY_ROOT_URL,finalUrl:response.url,status:response.status,bodyUnread:true,capturedAt:new Date().toISOString()})
   const reason=response.url!==FIRST_PARTY_ROOT_URL?'Configured source final URL changed; exact employer review required':'Configured employer source HTTP failure; inventory unavailable'
   const error=Object.assign(gap(reason+'; HTTP '+response.status+' for '+FIRST_PARTY_ROOT_URL+'; final URL '+response.url),{status:response.status,requestUrl:FIRST_PARTY_ROOT_URL,finalUrl:response.url})
   cancelBody(error);throw error
  }
  let body
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let bytes=0
   const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
   controller.signal.addEventListener('abort',cancel,{once:true})
   try{
    while(true){
     controller.signal.throwIfAborted()
     const {done,value}=await reader.read()
     controller.signal.throwIfAborted()
     if(done)break
     bytes+=value.byteLength
     if(bytes>4000000){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds byte limit')}
     chunks.push(Buffer.from(value))
    }
    body=Buffer.concat(chunks).toString('utf8')
   }finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock()}
  }else body=await response.text()
  controller.signal.throwIfAborted()
  if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>4000000)throw gap('Source body missing or exceeds bound')
  retainedResponses.push({url:FIRST_PARTY_ROOT_URL,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
  throw gap('Configured source newly accessible; exact employer, native vacancies, explicit country, earliest public date, expiry and active application require review')
 }
 try{return await Promise.race([probe(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='BOLOFORM_COVERAGE_GAP')throw error;throw gap('Native employer transport or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})

export const run=async(options={})=>createBoloformScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/boloform/script.js')){
 try{await run()}catch(error){console.error(error.code+': '+error.message);process.exitCode=1}
}
