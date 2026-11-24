import path from 'node:path'
import {fileURLToPath} from 'node:url'
import metadata from './catalog.js'
import {runCurrentConfiguredBoard} from './currentConfiguredBoard20261120.js'
export const SOURCE=metadata.source,COMPANY=metadata.companyName,CAREERS_URL=metadata.companyCareerPage,PROVIDER_METADATA=metadata
export const DISPOSITION='current-own-declared-native-configured-listed-India-projection'
export const createContrastSecurityScraper=()=>({run:options=>runCurrentConfiguredBoard(options)})
export const run=options=>createContrastSecurityScraper().run(options)
// Historical declared-feed discovery remains available only through this explicit entry.
export const createLegacyDeclaredContrastSecurityScraper=()=>({run:async options=>(await import('../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js')).createDeclaredJobFeedScraper((await import('../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js')).DECLARED_JOB_FEED_PROFILES.contrastsecurity).run(options)})
export const runLegacyDeclaredContrastSecurity=options=>createLegacyDeclaredContrastSecurityScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){const{saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run();if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'));else await saveToDB(jobs,SOURCE)}
