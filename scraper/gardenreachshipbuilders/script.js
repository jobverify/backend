import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {GARDEN_REACH_SHIPBUILDERS_CATALOG} from './catalog.js'
import {createCurrentNoticeScraper} from './currentNotice20261110.js'
export {hasOfficialPortalIndexSignal,extractPortalNotices,hasOfficialNoticeDetailSignal,extractNoticePdfUrl,extractNoticeDetailsFromPdf} from './currentNotice20261110.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA=GARDEN_REACH_SHIPBUILDERS_CATALOG
export const SOURCE=PROVIDER_METADATA.source
export const COMPANY=PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME=PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON=PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL=PROVIDER_METADATA.homepageUrl
export const CAREERS_URL=PROVIDER_METADATA.companyCareerPage
export const VERIFIED_APPLY_PORTAL_URLS=PROVIDER_METADATA.verifiedApplyPortalUrls
export const createGardenReachShipbuildersScraper=createCurrentNoticeScraper
export const run=(options={})=>createGardenReachShipbuildersScraper(options).run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
