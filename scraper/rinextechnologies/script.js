import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentRinex} from './currentNative20261117.js'
export const SOURCE='rinextechnologies',COMPANY='Rinex Technologies',HOMEPAGE_URL='https://rinex.ai/',CAREER_URL='https://rinex.ai/career',SITE_ORIGIN='https://rinex.ai'
export const createRinexTechnologiesScraper=()=>({run:runCurrentRinex})
export const run=runCurrentRinex
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
