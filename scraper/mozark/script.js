import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {HOMEPAGE_URL,ABOUT_URL,runCurrentMozark} from './currentNative20261117.js'
export {HOMEPAGE_URL,ABOUT_URL}
export const SOURCE='mozark'
export const COMPANY='Mozark'
export const createMozarkScraper=(options={})=>({async run(runOptions={}){return runCurrentMozark({...options,...runOptions})}})
export const run=async(options={})=>createMozarkScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
