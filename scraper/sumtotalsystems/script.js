import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
import {SUMTOTAL_SYSTEMS_CATALOG} from './catalog.js'
export const PROVIDER_METADATA=SUMTOTAL_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECT_HOMEPAGE_URL = PROVIDER_METADATA.redirectHomepageUrl
export const REDIRECT_COMPANY_URL = PROVIDER_METADATA.redirectCompanyUrl
export const PARENT_CAREERS_URL = PROVIDER_METADATA.parentCareersUrl
export const PARENT_OPEN_POSITIONS_URL = PROVIDER_METADATA.parentOpenPositionsUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const createSumTotalSystemsScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
