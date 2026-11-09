import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runNative} from './native.js'
import {PROVIDER_METADATA} from './catalog.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='epson'
export const COMPANY='Epson'
export const CAREERS_URL='https://www.epson.co.in/careers'
export const DISPOSITION='regional-native-India-coverage-gap'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary
export {PROVIDER_METADATA}
export const run=(options={})=>runNative(options)
// Ordinary CLI persistence is inactive when selected catalog extraction imports this module.
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
