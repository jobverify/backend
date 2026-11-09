import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {SOURCE,createTripcomScraper} from './nativeInventory.js'

export {SOURCE,COMPANY,CAREERS_URL,JOBS_API_URL,PAGE_SIZE,COUNTRY_CODE,buildJobsRequestBody,buildDetailRequestBody,extractJobsFromPayload,projectNativeHtml,createTripcomScraper} from './nativeInventory.js'
export const run=(options={})=>createTripcomScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
