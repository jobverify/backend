import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {SOURCE,COMPANY,ARCHIVE as JOBS_URL,HOME as HOMEPAGE_URL,CAREERS as CAREERS_URL,collect} from './native.js'
export {SOURCE,COMPANY,JOBS_URL,HOMEPAGE_URL,CAREERS_URL}
export {hasOfficialHomepageSignal,hasOfficialCareersPageSignal,hasOfficialJobsArchiveSignal,extractArchiveListings,hasOfficialJobDetailSignal,extractJobDetail} from './native.js'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createQualigyTechScraper=(configuration={})=>({async run(options={}){return collect({...configuration,...options})}})
export const run=async(options={})=>createQualigyTechScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
