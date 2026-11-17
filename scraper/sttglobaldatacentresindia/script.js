import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {runCurrentStt} from './currentNative20261117.js'
export const SOURCE='sttglobaldatacentresindia',COMPANY='STT Global Data Centres India Private Limited',HOMEPAGE_URL='https://www.sttgdc.com/in-en',ABOUT_URL=HOMEPAGE_URL+'/about-us/the-company',CAREERS_URL=HOMEPAGE_URL+'/about-us/careers',CONTACT_URL='https://www.sttgdc.com/contact'
export const createSttGlobalDataCentresIndiaScraper=()=>({run:runCurrentStt})
export const run=runCurrentStt
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else {const proof=readInventoryEvidence(jobs);if(proof?.status!=='complete'||proof.lifecycleCleanupAllowed===false)throw Error('Current native inventory and cleanup remain unqualified');await saveToDB(jobs,SOURCE)}
}
