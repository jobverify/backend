import path from 'node:path'
import {fileURLToPath} from 'node:url'
import metadata from './catalog.js'
import {runCurrentConfiguredProjection} from './currentConfiguredProjection20261121.js'
export const SOURCE=metadata.source,COMPANY=metadata.companyName,CAREERS_URL=metadata.companyCareerPage,PROVIDER_METADATA=metadata
export const DISPOSITION='current-own-semantic-GQL-authorized-native-listed-India-projection'
export const createDatafoldScraper=()=>({run:options=>runCurrentConfiguredProjection(options)})
export const run=options=>createDatafoldScraper().run(options)
// The prior renderer-qualified programme remains an explicit historical entry.
export const createLegacyDatafoldScraper=()=>({run:async options=>(await import('./currentProgramme.js')).runCurrentDatafoldProgramme(options)})
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,SOURCE)}
