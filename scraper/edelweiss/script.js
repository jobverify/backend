import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {ROOT_URL,CAREERS_URL,runCurrentEdelweiss} from './currentNative20261117.js'
export {ROOT_URL,CAREERS_URL}
export const SOURCE='edelweiss'
export const COMPANY='Edelweiss'
export {default as PROVIDER_METADATA} from './catalog.js'
export const createEdelweissScraper=(options={})=>({async run(runOptions={}){return runCurrentEdelweiss({...options,...runOptions})}})
export const run=async(options={})=>createEdelweissScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
