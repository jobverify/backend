import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {attachInventoryEvidence,normalizeInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {collectPurplleNative} from './native.js'
import {collectPurplleTurboHire} from './turboHire.js'
import candidate from './catalog-candidate.json' with {type:'json'}

export const SOURCE='purplle', COMPANY='Purplle'
export const CAREERS_URL='https://www.purplle.com/careers'
export const ORGANIZATION_ID='2706205'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const FIRST_PARTY_ROOT_URL='https://www.purplle.com/careers'
export const PROVIDER_METADATA={...candidate,modulePath:fileURLToPath(import.meta.url)}
export const createPurplleScraper=(defaults={})=>({async run(options={}) {
 const {fetchImpl=globalThis.fetch,signal,timeoutMs=45000,now=new Date(),maxJobs=2,requestIntervalMs=800}={...defaults,...options}
 signal?.throwIfAborted()
 const controller=new AbortController(),retainedResponses=[]
 let surface=FIRST_PARTY_ROOT_URL,timer,onAbort
 const gap=(reason,cause)=>Object.assign(new Error('Purplle coverage gap: '+reason,{cause}),{
  code:'PURPLLE_COVERAGE_GAP',source:SOURCE,partial:true,abortRetries:true,
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
   if(response.url!==url||(response.status!==200)){
    retainedResponses.push({url,finalUrl:response.url,status:response.status,bodyUnread:true,capturedAt:new Date().toISOString()})
    const reason=response.url!==url?'Source final URL changed':'Source HTTP failure'
    const error=Object.assign(gap(reason+'; HTTP '+response.status+' for '+url+'; final URL '+response.url),{status:response.status,requestUrl:url,finalUrl:response.url})
    // A nonstandard response is unavailable source data, never an empty board.
    // Keep it distinct from a changed employer identity in an HTTP 200 page.
    if(response.url===url&&response.status===247)Object.assign(error,{failureType:'upstream_unavailable',softFailure:true,failureKind:'upstream_unavailable',upstreamOutage:true})
    cancelBody(error);throw error
   }
   let body
   if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let bytes=0
    const cancel=()=>{void reader.cancel(controller.signal.reason).catch(()=>{})}
    controller.signal.addEventListener('abort',cancel,{once:true})
    try{while(true){checkBudget();const {done,value}=await reader.read();checkBudget();if(done)break;bytes+=value.byteLength;if(bytes>3000000){void reader.cancel().catch(()=>{});throw gap('Source streamed body exceeds byte limit')}chunks.push(Buffer.from(value))}body=Buffer.concat(chunks).toString('utf8')}
    finally{controller.signal.removeEventListener('abort',cancel);reader.releaseLock?.()}
   }else {const error=gap('Bounded source stream unavailable');cancelBody(error);throw error}
   checkBudget()
   if(typeof body!=='string'||!body.trim()||Buffer.byteLength(body)>3000000)throw gap('Source body missing or exceeds bound')
   retainedResponses.push({url,finalUrl:response.url,status:response.status,body,capturedAt:new Date().toISOString(),bodySHA256:createHash('sha256').update(body).digest('hex')})
   return body
  }
  let collected
  try{collected=await collectPurplleNative({read,now:typeof now==='function'?now():now})}
  catch(error){
   const corporateUnavailable=error.status===247&&error.requestUrl===CAREERS_URL&&error.finalUrl===CAREERS_URL?{url:CAREERS_URL,status:247}:null
   const exactEmployerDenied=[403,429].includes(error.status)&&error.requestUrl==='https://www.linkedin.com/company/purplle-com/'&&error.finalUrl===error.requestUrl
   if(!corporateUnavailable&&!exactEmployerDenied)throw error
   try{collected=await collectPurplleTurboHire({fetchImpl,signal:controller.signal,now,retainedResponses,maxJobs,requestIntervalMs,corporateUnavailable})}
   catch(recoveryError){if(!corporateUnavailable)throw recoveryError;error.independentRecoveryFailure={message:recoveryError.message,status:recoveryError.status??null};throw error}
   surface=collected.facts.nativeSurface
  }
  const {jobs,facts,firstParty,reason,inventoryStatus}=collected
  checkBudget()
  const result=attachInventoryEvidence(jobs,{status:inventoryStatus,surface,firstParty,listingComplete:false,pagesFetched:retainedResponses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})
  Object.defineProperty(result,'nativeCollectionEvidence',{value:{retainedResponses,...facts,lifecycleCleanupAllowed:false}})
  attachSourceObservationEvidence(result,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:facts.nativeRecordCount,
   observedVacancyCount:facts.nativeRecordCount,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  return result
 }
 try{return await Promise.race([collect(),aborted])}
 catch(error){if(signal?.aborted)throw signal.reason;if(error?.code==='PURPLLE_COVERAGE_GAP')throw error;throw gap('Native source transport, body or inventory unavailable: '+error.message,error)}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);controller.abort()}
}})
export const run=async(options={})=>createPurplleScraper(options).run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()

  if (readInventoryEvidence(jobs)?.listingComplete !== true) {
    if (process.argv.includes('--dry-run')) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(readInventoryEvidence(jobs), null, 2))
    }
    console.error(readInventoryEvidence(jobs)?.reason)
    process.exitCode = 1
  } else if (process.argv.includes('--dry-run')) {
    const { saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    const { saveToDB } = await import('../../scraper-support/utils/saveToDB.js')
    await saveToDB(jobs, SOURCE)
  }
}
