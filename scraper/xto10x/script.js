import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {collectNative} from './native.js'
import candidate from './catalog-candidate.json' with {type:'json'}

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='xto10x', COMPANY='XTO10X', FIRST_PARTY_ROOT_URL='https://www.xto10x.com/about'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createXto10xScraper=(defaults={})=>({async run(options={}){
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=45000,now=()=>new Date().toISOString()}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal,retainedResponses=[]
 let surface=FIRST_PARTY_ROOT_URL,timer,onAbort
 const evidence=reason=>({status:'discovery-only',surface,firstParty:new URL(surface).hostname==='www.xto10x.com',listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason})
 const gap=(reason,cause)=>Object.assign(new Error('xto10x coverage gap: '+reason,{cause}),{code:'XTO10X_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,sourceListingComplete:false,lifecycleCleanupAllowed:false,retainedResponses,inventoryEvidence:{...evidence(reason),status:'coverage-gap'}})
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>180000)throw gap('Invalid aggregate request budget')
 const interrupted=new Promise((_,reject)=>{onAbort=()=>reject(combined.reason);combined.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>controller.abort(gap('aggregate fetch/body deadline exceeded')),timeoutMs)})
 const read=async (url,{json=false}={})=>{
  combined.throwIfAborted();surface=url
  const response=await fetchImpl(url,{signal:combined,redirect:'manual',headers:{Accept:json?'application/json':'text/html','User-Agent':'Mozilla/5.0'}})
  const cancelUnopened=()=>{try{void Promise.resolve(response.body?.cancel(combined.reason)).catch(()=>{})}catch{}}
  if(combined.aborted){cancelUnopened();combined.throwIfAborted()}
  if(response.url!==url||response.status!==200){cancelUnopened();throw gap('Native HTTP failure or final URL changed')}
  let body
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let bytes=0
   const cancel=()=>{void Promise.resolve(reader.cancel(combined.reason)).catch(()=>{})}
   combined.addEventListener('abort',cancel,{once:true})
   try {while(true){combined.throwIfAborted();const part=await reader.read();combined.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;if(bytes>5000000){cancel();throw gap('streamed native body exceeds byte bound')}chunks.push(Buffer.from(part.value))}body=Buffer.concat(chunks).toString('utf8')}
   finally{combined.removeEventListener('abort',cancel);reader.releaseLock?.()}
  }else body=await response.text()
  combined.throwIfAborted()
  if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>5000000)throw gap('Native body missing or oversized')
  retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:now(),bodySHA256:createHash('sha256').update(body).digest('hex')})
  return body
 }
 try{return await Promise.race([interrupted,(async()=>{
  const result=await collectNative({read,now,gap,signal:combined})
  const jobs=attachInventoryEvidence(result.jobs,{...evidence(result.reason),status:result.inventoryStatus??'discovery-only',firstParty:result.firstParty===true})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...result,retainedResponses,lifecycleCleanupAllowed:false}})
  return jobs
 })()])}catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='XTO10X_COVERAGE_GAP')throw error;throw gap('Native recruiting transport or contract unavailable',error)}finally{clearTimeout(timer);combined.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createXto10xScraper(options).run(options)
const direct=process.argv[1]?.replaceAll('\\','/').endsWith('/scraper/xto10x/script.js')
if(direct){const jobs=await run();if(readInventoryEvidence(jobs)?.listingComplete!==true){console.error(readInventoryEvidence(jobs)?.reason);process.exitCode=1}else{const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js');if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}}
