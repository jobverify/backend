import path from 'node:path'
import {fileURLToPath} from 'node:url'
import metadata from './catalog.js'
import {runCurrentConfiguredBoard} from './currentConfiguredBoard20261120.js'
export const SOURCE=metadata.source,COMPANY=metadata.companyName,CAREERS_URL=metadata.companyCareerPage,PROVIDER_METADATA=metadata
export const DISPOSITION='current-own-declared-native-configured-listed-India-projection'
export const createImmersiveLabsScraper=()=>({run:options=>runCurrentConfiguredBoard(options)})
export const run=options=>createImmersiveLabsScraper().run(options)
// Historical generic discovery is available only through this explicit entry.
export const createLegacyImmersiveLabsScraper=()=>({run:async options=>(await import('../../scraper-support/utils/officialAtsRecovery.js')).createOfficialAtsRecoveryScraper({source:'immersivelabs',companyName:'Immersive Labs',companyDomain:'immersivelabs.com',companyCareerPage:'https://www.immersivelabs.com/company/careers',officialHomepageUrl:'https://www.immersivelabs.com/',sourceScopeComplete:false}).run(options)})
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,SOURCE)}
