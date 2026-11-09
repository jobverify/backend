import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {DHAN_CATALOG} from './catalog.js'
import {readCurrentCorporate,normalizeCurrentKekaJob,runCurrentDhan} from './currentNative.js'
export {CAREERS_URL,BOARD_URL as CAREERS_HANDOFF_URL,ACTIVE_URL as KEKA_JOBS_API_URL} from './currentNative.js'
export const SOURCE=DHAN_CATALOG.source,COMPANY=DHAN_CATALOG.companyName,VERIFIED_AT=DHAN_CATALOG.verifiedOn
export const PROVIDER_METADATA=DHAN_CATALOG,VERIFIED_SURFACE_SUMMARY=DHAN_CATALOG.verifiedSurfaceSummary
export const hasOfficialCareersPageSignal=html=>{try{readCurrentCorporate(html);return true}catch{return false}}
export const normalizeKekaJob=normalizeCurrentKekaJob
export const createDhanScraper=(defaults={})=>({run:options=>runCurrentDhan({...defaults,...options})})
export const run=(options={})=>runCurrentDhan(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
