import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentSaarthi} from './currentNative20261117.js'
import {SAARTHI_CATALOG as PROVIDER_METADATA} from './catalog.js'
export {PROVIDER_METADATA}
export const SOURCE=PROVIDER_METADATA.source,COMPANY=PROVIDER_METADATA.companyName,OFFICIAL_BRAND_NAME=PROVIDER_METADATA.officialBrandName,VERIFIED_ON=PROVIDER_METADATA.verifiedOn,VERIFIED_SURFACE_SUMMARY=PROVIDER_METADATA.verifiedSurfaceSummary,HOMEPAGE_URL=PROVIDER_METADATA.homepageUrl,ABOUT_URL=PROVIDER_METADATA.companyCareerPage,PUBLIC_MARKETPLACE_URL=PROVIDER_METADATA.publicMarketplaceUrl
export const createSaarthiScraper=()=>({run:runCurrentSaarthi})
export const run=runCurrentSaarthi
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
