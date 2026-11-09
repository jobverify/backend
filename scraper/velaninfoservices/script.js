import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {VELANINFOSERVICES_CATALOG} from './catalog.js'
import {CAREERS,INDEX,readCareers,readIndex,readRole,makeListingObservation} from './nativeModels.js'
import {runVelanNative} from './nativeCareers.js'
export const PROVIDER_METADATA=VELANINFOSERVICES_CATALOG
export const SOURCE='velaninfoservices',COMPANY='Velan Info Services',OVERVIEW_URL=CAREERS,JOBS_URL=INDEX,VERIFIED_ON='2026-11-05'
export const hasOfficialCareersSignal=html=>{try{return Boolean(readCareers(html))}catch{return false}}
export const hasOfficialJobsSignal=html=>{try{return Boolean(readIndex(html))}catch{return false}}
export const extractJobs=html=>readIndex(html).rows.map(row=>makeListingObservation(row))
export const extractJobDetail=(html,row,options)=>readRole(html,row,options)
export const createVelanInfoServicesScraper=(defaults={})=>({run:(options={})=>runVelanNative({...defaults,...options})})
export const run=(options={})=>createVelanInfoServicesScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
