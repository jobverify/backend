import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {DENTALKART_CATALOG} from './catalog.js'
import {readCurrentCorporate,readCurrentBoard,runCurrentDentalkart} from './currentNative.js'
export {CAREERS_URL,BOARD_URL as CAREERS_PORTAL_URL,normalizeCurrentDentalkartRecord} from './currentNative.js'
export const SOURCE=DENTALKART_CATALOG.source,COMPANY=DENTALKART_CATALOG.companyName,VERIFIED_AT=DENTALKART_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY=DENTALKART_CATALOG.verifiedSurfaceSummary
export const hasOfficialCareersShellSignal=html=>{try{readCurrentCorporate(html);return true}catch{return false}}
export const readPortalInventory=html=>readCurrentBoard(html).records
export const createDentalkartScraper=(defaults={})=>({run:options=>runCurrentDentalkart({...defaults,...options})})
export const run=(options={})=>runCurrentDentalkart(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
