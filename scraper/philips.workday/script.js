import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261120.js'
export const SOURCE='philips',COMPANY='Philips',CAREERS_URL='https://www.careers.philips.com/in/en/home',DISPOSITION='runtime-verified-recruitment'
export const createPhilipsScraper=()=>({run:runCurrentNative})
export const run=options=>createPhilipsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
