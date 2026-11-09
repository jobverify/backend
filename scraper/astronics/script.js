import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentAstronics,CURRENT_TEST_SYSTEMS,CURRENT_CAREERS,US} from './currentNative.js'
const currentDir=path.dirname(fileURLToPath(import.meta.url))
export const SOURCE='astronics',COMPANY='Astronics Test Systems',HOMEPAGE_URL=CURRENT_TEST_SYSTEMS,CAREERS_URL=CURRENT_CAREERS,JOBS_URL=US
export const createAstronicsScraper=()=>({run:options=>runCurrentAstronics(options)})
export const run=options=>runCurrentAstronics(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(currentDir,'jobs.json'));else await saveToDB(jobs,SOURCE)}
