import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {SOURCE,COMPANY,SURFACE as CAREERS_URL,API as CAREERS_API_URL,collect} from './native.js'
export {SOURCE,COMPANY,CAREERS_URL,CAREERS_API_URL}
export {isVerifiedCareersPage,extractJobs} from './native.js'
export const VERIFIED_ON='2026-07-13'
export const VERIFIED_SURFACE_SUMMARY='Historical official-source discovery; current API/rendered role observations do not certify whole-company inventory.'

const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const createPragyaRefrigerationAndElectricalsPrivateLimitedScraper=(configuration={})=>({async run(options={}){return collect({...configuration,...options})}})
export const run=async(options={})=>createPragyaRefrigerationAndElectricalsPrivateLimitedScraper().run(options)

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
