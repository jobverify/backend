import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentSmartHealth} from './currentNative20261117.js'
export const SOURCE='smarthealthglobaltechnologies',COMPANY='Smart Health Global Technologies',LEGACY_HOME_URL='https://smarthealthglobal.in/',HOMEPAGE_URL='https://shgtechnologies.com/',ABOUT_URL=HOMEPAGE_URL+'about-us'
export const createSmartHealthGlobalTechnologiesScraper=()=>({run:runCurrentSmartHealth})
export const run=runCurrentSmartHealth
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
