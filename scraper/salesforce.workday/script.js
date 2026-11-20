import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentPublished} from './currentPublished20261120.js'
export const SOURCE='salesforce',COMPANY='Salesforce',CAREERS_URL='https://careers.salesforce.com/',DISPOSITION='runtime-verified-recruitment'
export const createSalesforceScraper=()=>({run:runCurrentPublished})
export const run=opts=>createSalesforceScraper().run(opts)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
