import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCultfitPublication} from './currentPublication20261119.js'

export {SOURCE,COMPANY,OFFICIAL_CAREERS_URL,CAREERS_BASE_URL,LISTING_API_URL,DETAIL_API_URL,
 hasVerifiedCareerPageSignals,buildSearchPayload,buildJobDetailUrl,extractSearchResults,extractJobDetail} from './legacyNative202607.js'

export const createCultFitScraper=(defaults={})=>({run:options=>runCultfitPublication({...defaults,...options})})
export const run=options=>createCultFitScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'cultfit')
}
