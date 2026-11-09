import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runNative} from './native.js'
import {PROVIDER_METADATA} from './catalog.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='globalpayments'
export const COMPANY='Global Payments'
export const CAREERS_URL='https://jobs.globalpayments.com/jobs'
export const DISPOSITION='native-portal-India-coverage-gap'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary
export {PROVIDER_METADATA}
export const run=(options={})=>runNative(options)
// This ordinary CLI persistence branch is inactive during extraction imports.
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
