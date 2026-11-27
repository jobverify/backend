import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runNative} from '../../scraper-support/shared/rmkNativePair.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE="hershey"
export const COMPANY="Hershey"
export const CAREERS_URL="https://careers.thehersheycompany.com/search/"
export const DISPOSITION='official-native-RMK-HTML-India-coverage-gap'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY='Full official RMK native descriptions and typed India addresses; original publication, legal employer and whole-employer scope unknown. Cleanup forbidden.'
export const NATIVE_CONFIG=Object.freeze({
  "source": "hershey",
  "companyName": "Hershey",
  "home": "https://www.thehersheycompany.com/",
  "origin": "https://careers.thehersheycompany.com",
  "companyToken": "Hersheys",
  "nativeEmployer": "The Hershey Company",
  "requisitionProperty": "customfield3"
})
export async function run(options={}){
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(540000)]):AbortSignal.timeout(540000)
 const attempts=[]
 for(let attempt=1;attempt<=2;attempt++){
  signal.throwIfAborted()
  try{
   const jobs=await runNative(NATIVE_CONFIG,{...options,signal})
   signal.throwIfAborted()
   if(attempts.length)Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{
    source:SOURCE,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
    nativeCaptureAttempts:[...attempts,{attempt,status:'reconciled',reportedTotal:readInventoryEvidence(jobs)?.reportedTotal}],
   }})
   return jobs
  }catch(error){
   signal.throwIfAborted()
   if(error?.code==='RMK_NATIVE_INVENTORY_CHANGED'){
    attempts.push({attempt,status:'discarded-inventory-change',code:error.code,message:error.message,nativeInventoryChange:error.nativeInventoryChange})
    if(attempt===1)continue
   }
   if(attempts.length)error.nativeCaptureAttempts=attempts
   throw error
  }
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
