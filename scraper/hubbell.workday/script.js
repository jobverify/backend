import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runNative} from '../../scraper-support/shared/rmkNativePair.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE="hubbell"
export const COMPANY="Hubbell"
export const CAREERS_URL="https://careers.hubbell.com/search/"
export const DISPOSITION='official-native-RMK-HTML-India-coverage-gap'
export const VERIFIED_ON=null
export const VERIFIED_SURFACE_SUMMARY='Full official RMK native descriptions and typed India addresses; original publication, legal employer and whole-employer scope unknown. Cleanup forbidden.'
export const NATIVE_CONFIG=Object.freeze({
  "source": "hubbell",
  "companyName": "Hubbell",
  "home": "https://www.hubbell.com/",
  "homeRedirectPath": "/hubbell/en",
  "origin": "https://careers.hubbell.com",
  "companyToken": "Hubbell",
  "nativeEmployer": "Hubbell Incorporated",
  "requisitionProperty": null
})
export const run=(options={})=>runNative(NATIVE_CONFIG,options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
