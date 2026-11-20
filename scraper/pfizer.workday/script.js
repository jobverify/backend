import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261120.js'
export const SOURCE='pfizer',COMPANY='Pfizer',CAREERS_URL='https://www.pfizer.com/about/careers/search-results',DISPOSITION='runtime-verified-recruitment'
export const createPfizerScraper=()=>({run:runCurrentNative})
export const run=options=>createPfizerScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
