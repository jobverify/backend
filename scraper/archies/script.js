import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {HOMEPAGE_URL,ABOUT_URL,runCurrentArchies} from './currentNative20261117.js'
export {HOMEPAGE_URL,ABOUT_URL}
export const SOURCE='archies'
export const COMPANY='Archies'
export {ARCHIES_CATALOG as PROVIDER_METADATA} from './catalog.js'
export const OFFICIAL_BRAND_NAME='Archies Online'
export const createArchiesScraper=(options={})=>({async run(runOptions={}){return runCurrentArchies({...options,...runOptions})}})
export const run=async(options={})=>createArchiesScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
