import path from 'node:path'
import {fileURLToPath} from 'node:url'
import SMALLCASE_CATALOG from './catalog.js'
import {runCurrentConfiguredBoard} from './currentConfiguredBoard20261120.js'
export const PROVIDER_METADATA=SMALLCASE_CATALOG,SOURCE=SMALLCASE_CATALOG.source,COMPANY=SMALLCASE_CATALOG.companyName,OFFICIAL_BRAND_NAME=SMALLCASE_CATALOG.officialBrandName,VERIFIED_ON=null,VERIFIED_SURFACE_SUMMARY=SMALLCASE_CATALOG.verifiedSurfaceSummary,CAREERS_PAGE_URL=SMALLCASE_CATALOG.companyCareerPage,OFFICIAL_CAREERS_HANDOFF_URL=SMALLCASE_CATALOG.officialCareersHandoffUrl
export const createSmallcaseScraper=(defaults={})=>({run:(options={})=>runCurrentConfiguredBoard({...defaults,...options})})
export const run=(options={})=>runCurrentConfiguredBoard(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,SOURCE)}
