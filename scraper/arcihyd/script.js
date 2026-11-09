import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentArci} from './currentNative.js'
export {CAREERS as CAREERS_PAGE_URL,VACANCIES as VACANCIES_PAGE_URL} from './advertisements.js'
export const createArciHydScraper=defaults=>({run:options=>runCurrentArci({...defaults,...options})})
export const run=options=>runCurrentArci(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,'arcihyd')
}
