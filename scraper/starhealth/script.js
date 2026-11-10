import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {collectStarHealthNative, CAREERS_URL, EMPLOYER_URL} from './native.js'
import {readStarHealthHTTP} from './httpRead.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='starhealth', COMPANY='Star Health'
export const FIRST_PARTY_ROOT_URL='https://www.starhealth.in/careers/'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createStarHealthScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=30000,requestTimeoutMs=20000,now=new Date()}={...defaults,...options}
 const sourceNow=typeof now==='function'?now():now
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let pagesFetched=0,surface=CAREERS_URL,timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('StarHealth coverage gap: '+reason,{cause}),{
  code:'STARHEALTH_COVERAGE_GAP',sourceListingComplete:false,lifecycleCleanupAllowed:false,retainedResponses,
  inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface,firstParty:false,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason}),
 })
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw gap('Invalid aggregate request budget')
 if(!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>20000)throw gap('Invalid HTTP read budget')
 const aborted=new Promise((_,reject)=>{
  onAbort=()=>{controller.abort(signal.reason);reject(signal.reason)}
  signal?.addEventListener('abort',onAbort,{once:true})
  timer=setTimeout(()=>{const error=Object.assign(gap('Aggregate source deadline exceeded'),{
   name:'TimeoutError',sourceTimeoutMs:timeoutMs,softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout',abortRetries:true,
  });controller.abort(error);reject(error)},timeoutMs)
 })
 const collect=async()=>{
  const read=async url=>{
   surface=url;controller.signal.throwIfAborted()
   const {body,finalUrl,status}=await readStarHealthHTTP(url,{fetchImpl,signal:controller.signal,requestTimeoutMs,gap})
   pagesFetched++;retainedResponses.push({url,finalUrl,status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
   return body
  }
  const {jobs, facts, firstParty, reason}=await collectStarHealthNative({read,now:sourceNow})
  const result=attachInventoryEvidence(jobs,{status:'discovery-only',surface:EMPLOYER_URL,firstParty,listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,...facts,lifecycleCleanupAllowed:false}})
  return result
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='STARHEALTH_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable',error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createStarHealthScraper(options).run(options)
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/starhealth/script.js')){
 const jobs=await run()
 if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}
}
