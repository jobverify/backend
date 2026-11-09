import path from'node:path';import{fileURLToPath}from'node:url'
import catalog from'./catalog.js';import{runCurrentAmicable}from'./currentScreenloop.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE=catalog.source,COMPANY=catalog.companyName,VERIFIED_AT=catalog.verifiedOn,VERIFIED_SURFACE_SUMMARY=catalog.verifiedSurfaceSummary,HOMEPAGE_URL=catalog.officialHomepageUrl,CAREERS_URL=catalog.companyCareerPage,SCREENLOOP_BOARD_URL=catalog.officialScreenloopBoardUrl,SPECULATIVE_APPLY_EMAIL=catalog.officialSpeculativeApplyEmail
export const createAmicableAiScraper=()=>({run:options=>runCurrentAmicable(options)})
export const run=options=>runCurrentAmicable(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
