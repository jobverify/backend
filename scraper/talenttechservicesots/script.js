import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentTalentTech} from './currentNative20261117.js'
export const SOURCE='talenttechservicesots',COMPANY='Talent Tech Services OTS',HOMEPAGE_URL='https://talenttechservices.com/'
export const createTalentTechServicesOtsScraper=()=>({run:runCurrentTalentTech})
export const run=runCurrentTalentTech
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
