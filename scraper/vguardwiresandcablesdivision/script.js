import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentVGuard} from './currentNative20261117.js'
export const SOURCE='vguardwiresandcablesdivision',COMPANY='V-Guard Wires & Cables Division',HOMEPAGE_URL='https://www.vguard.in/',APPLY_NOW_URL=HOMEPAGE_URL+'careers/apply-now',ATS_LIST_URL='https://vguard.mua.hrdepartment.com/hr/ats/JobSearch/viewAll'
export const createVGuardWiresAndCablesDivisionScraper=()=>({run:runCurrentVGuard})
export const run=runCurrentVGuard
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
