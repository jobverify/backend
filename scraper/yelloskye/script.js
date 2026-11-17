import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentYello} from './currentNative20261117.js'
export const SOURCE='yelloskye',COMPANY='YelloSKYE',HOMEPAGE_URL='https://yelloskye.com/',CAREERS_URL='https://yelloskye.com/'
export const createYelloSkyeScraper=()=>({run:runCurrentYello})
export const run=runCurrentYello
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else{const e=readInventoryEvidence(jobs);if(e?.status!=='complete'||e.lifecycleCleanupAllowed===false)throw Error('Native inventory/cleanup remains unqualified');await saveToDB(jobs,SOURCE)}
}
