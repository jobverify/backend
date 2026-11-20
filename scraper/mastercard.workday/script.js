import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261120.js'
export const SOURCE='mastercard',COMPANY='Mastercard',CAREERS_URL='https://careers.mastercard.com/us/en/',DISPOSITION='runtime-verified-recruitment'
export const createMastercardScraper=()=>({run:runCurrentNative})
export const run=options=>createMastercardScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
