import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {CAREER_PAGE_URL,readCurrentAcsiaModel,runCurrentAcsia} from './currentNative20261117.js'
export {CAREER_PAGE_URL}
export const SOURCE='acsia'
export const COMPANY='Acsia Technologies'
export const extractSearchResults=html=>readCurrentAcsiaModel(html).rows
export const createAcsiaScraper=(options={})=>({async run(runOptions={}){return runCurrentAcsia({...options,...runOptions})}})
export const run=async(options={})=>createAcsiaScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
