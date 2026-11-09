import path from 'node:path'
import {fileURLToPath} from 'node:url'
import DIGITAL_WEB_SOLUTIONS_CATALOG from './catalog.js'
import {SOURCE,COMPANY,CAREERS,BOARD,corporateHandoff,nativeListings,nativeRole,runNative} from './native.js'

export const PROVIDER_METADATA=DIGITAL_WEB_SOLUTIONS_CATALOG
export {SOURCE,COMPANY}
export const CAREERS_URL=CAREERS,JOBS_BOARD_URL=BOARD
export const hasOfficialCareersSignal=html=>{try{corporateHandoff(html);return true}catch{return false}}
export const hasOfficialJobsBoardSignal=html=>{try{nativeListings(html);return true}catch{return false}}
export const extractBoardJobs=html=>nativeListings(html).map(row=>({...row,sourceUrl:row.url,applyUrl:row.url}))
export const extractDetailJobData=(html,listing={})=>nativeRole(listing.sourceUrl,html,listing)
export const createDigitalWebSolutionsScraper=(configuration={})=>({run:options=>runNative({...configuration,...options})})
export const run=options=>runNative(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
