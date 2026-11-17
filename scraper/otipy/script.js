import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative} from './currentNative20261117.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
import {OTIPY_CATALOG} from './catalog.js'
export const SOURCE=OTIPY_CATALOG.source,COMPANY=OTIPY_CATALOG.companyName,OFFICIAL_BRAND_NAME=OTIPY_CATALOG.officialBrandName,VERIFIED_ON=OTIPY_CATALOG.verifiedOn,VERIFIED_SURFACE_SUMMARY=OTIPY_CATALOG.verifiedSurfaceSummary,HOMEPAGE_URL=OTIPY_CATALOG.homepageUrl,CAREERS_URL=OTIPY_CATALOG.companyCareerPage,JOBS_URL=OTIPY_CATALOG.officialJobsPageUrl
export {defaultFetchPage} from './currentNative20261117.js'
export const createOtipyScraper=()=>({run:runCurrentNative})

export const run=async(options={})=>runCurrentNative(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
