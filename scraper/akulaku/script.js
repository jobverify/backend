import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {AKULAKU_CATALOG} from './catalog.js'
import {runCurrentAkulaku} from './currentNative.js'
import {CORPORATE,BOARD,corporateModel,boardModel,jobCards,nextPage,description,isExplicitIndiaLocation} from './nativeModels.js'
export const PROVIDER_METADATA=AKULAKU_CATALOG,SOURCE='akulaku',COMPANY='Akulaku',OFFICIAL_BRAND_NAME='Akulaku',VERIFIED_ON=null,FIRST_PARTY_CAREERS_URL=CORPORATE,OFFICIAL_JOBS_BOARD_URL=BOARD,JOB_LISTINGS_URL=BOARD+'alljob/?o=1',VERIFIED_SURFACE_SUMMARY_TEXT=AKULAKU_CATALOG.verifiedSurfaceSummary
export const extractJobCards=jobCards,extractNextPageUrl=nextPage,extractJobDescription=description,isIndiaLocation=isExplicitIndiaLocation
export const hasFirstPartyCareersSignal=html=>{try{corporateModel(html);return true}catch{return false}}
export const extractOfficialJobsBoardUrl=html=>hasFirstPartyCareersSignal(html)?BOARD:null
export const hasOfficialJobsBoardSignal=html=>{try{boardModel(html);return true}catch{return false}}
export const createAkulakuScraper=defaults=>({run:options=>runCurrentAkulaku({...defaults,...options})})
export const run=options=>runCurrentAkulaku(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
