import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadConfig} from '../../scraper-support/utils/loadConfig.js'
import {extractCurrentSearchResults,runCurrentBounteous} from './currentNative.js'

export {CAREER_PAGE_URL,LEVER_ENDPOINT,TURBOHIRE_ENDPOINT,BOUNTEOUS_JOB_ROUTE_PREFIX} from './currentNative.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url)),config=loadConfig(currentDir)
export const extractSearchResults=extractCurrentSearchResults
export const createBounteousScraper=({maxJobs=Number.isSafeInteger(config.maxJobs)?config.maxJobs:null}={})=>({
 run:options=>runCurrentBounteous({...options,maxJobs:options?.maxJobs===undefined?maxJobs:options.maxJobs}),
})
export const run=(options={})=>createBounteousScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else{console.log('DB result:',await saveToDB(jobs,'bounteous'));process.exit(0)}
}
