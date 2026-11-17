import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
import {PARENTLANE_CATALOG} from './catalog.js'
export const PROVIDER_METADATA=PARENTLANE_CATALOG,SOURCE=PROVIDER_METADATA.source,COMPANY=PROVIDER_METADATA.companyName,OFFICIAL_BRAND_NAME=PROVIDER_METADATA.officialBrandName,VERIFIED_ON=PROVIDER_METADATA.verifiedOn,VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary,HOMEPAGE_URL=PROVIDER_METADATA.homepageUrl,ABOUT_URL=PROVIDER_METADATA.companyCareerPage,CAREERS_URL=PROVIDER_METADATA.verifiedMissingCareersRouteUrl,SUPPORT_EMAIL=PROVIDER_METADATA.officialSupportEmail
export const createParentlaneScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
