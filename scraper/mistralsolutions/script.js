import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {MISTRAL_SOLUTIONS_CATALOG as PROVIDER_METADATA} from './catalog.js'
import {readMistralTable,CAREERS} from './nativeModels.js'
import {createNativeMistralScraper} from './nativeRun.js'

export {PROVIDER_METADATA}
export const SOURCE=PROVIDER_METADATA.source,COMPANY=PROVIDER_METADATA.companyName,CAREERS_URL=CAREERS
export const hasOfficialCareersPageSignal=html=>{try{readMistralTable(html);return true}catch{return false}}
export const extractJobsFromHtml=html=>readMistralTable(html).jobs
export const createMistralSolutionsScraper=createNativeMistralScraper
export const run=options=>createMistralSolutionsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}