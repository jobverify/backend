import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {HOMEPAGE_URL,CAREERS_URL,ENQUIRY_URL,runCurrentElectrosteel} from './currentNative20261117.js'
export {HOMEPAGE_URL,CAREERS_URL,ENQUIRY_URL}
export const SOURCE='electrosteelcastings'
export const COMPANY='Electrosteel Castings Limited'
export const createElectrosteelCastingsScraper=(options={})=>({async run(runOptions={}){return runCurrentElectrosteel({...options,...runOptions})}})
export const run=async(options={})=>createElectrosteelCastingsScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
