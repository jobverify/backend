import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {CAREERS_URL,createCurrentCamsScraper} from './currentBoundary.js'
export const CAREERS_PAGE_URL=CAREERS_URL,buildSearchUrl=()=>CAREERS_URL,createCamsScraper=createCurrentCamsScraper
export const run=options=>createCamsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'cams')
}
