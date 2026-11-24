import path from 'node:path'
import {fileURLToPath} from 'node:url'
import metadata from './catalog.js'
import {runCurrentConfiguredBoard} from './currentConfiguredBoard20261120.js'
export const SOURCE=metadata.source,COMPANY=metadata.companyName,CAREERS_URL=metadata.companyCareerPage,PROVIDER_METADATA=metadata
export const DISPOSITION='current-own-declared-native-configured-listed-India-projection'
export const createFreshpaintScraper=()=>({run:options=>runCurrentConfiguredBoard(options)})
export const run=options=>createFreshpaintScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,SOURCE)}
