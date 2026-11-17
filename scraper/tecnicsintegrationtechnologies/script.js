import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentTecnics} from './currentNative20261117.js'
import {TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG} from './catalog.js'
export const PROVIDER_METADATA=TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG
export const SOURCE='tecnicsintegrationtechnologies',COMPANY='Tecnics Integration Technologies',HOMEPAGE_URL='https://tecnics.com/',CAREERS_URL='https://tecnics.com/'
export const createTecnicsIntegrationTechnologiesScraper=()=>({run:runCurrentTecnics})
export const run=runCurrentTecnics
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else{const e=readInventoryEvidence(jobs);if(e?.status!=='complete'||e.lifecycleCleanupAllowed===false)throw Error('Native inventory/cleanup remains unqualified');await saveToDB(jobs,SOURCE)}
}
