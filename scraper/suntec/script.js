import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {SOURCE,SURFACE as CAREERS_URL,collect} from './native.js'
export {CAREERS_URL}
export {hasOfficialCareersSignal,extractListings,extractJobDetail} from './native.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createSuntecScraper=(configuration={})=>({async run(options={}){return collect({...configuration,...options})}})
export const run=async(options={})=>createSuntecScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
