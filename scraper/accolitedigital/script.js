import path from 'node:path'
import{fileURLToPath}from'node:url'
import{extractCurrentSearchResults}from'../bounteous/currentNative.js'
import{runCurrentAccoliteDelegation}from'./currentDelegation.js'
export{CAREER_PAGE_URL,TURBOHIRE_ENDPOINT,BOUNTEOUS_JOB_ROUTE_PREFIX}from'../bounteous/currentNative.js'
export const extractSearchResults=payload=>extractCurrentSearchResults({turboHirePayload:payload})
export const createAccoliteDigitalScraper=({maxJobs=null}={})=>({run:options=>runCurrentAccoliteDelegation({...options,maxJobs:options?.maxJobs===undefined?maxJobs:options.maxJobs})})
export const run=(options={})=>createAccoliteDigitalScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else{console.log('DB result:',await saveToDB(jobs,'bounteous'));process.exit(0)}
}
