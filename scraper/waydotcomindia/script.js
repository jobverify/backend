import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentWay} from './currentNative20261117.js'
export const SOURCE='waydotcomindia',COMPANY='Way Dot Com India Private Limited',CAREERS_URL='https://www.way.com/careers',JOBS_JSON_URL='https://www.way.com/assets/jobs.json'
export const createWayDotComIndiaScraper=()=>({run:runCurrentWay})
export const run=runCurrentWay
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
