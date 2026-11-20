import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative,HOMEPAGE} from './currentNative20261119.js'
export {reconcileBlackRockEarlyCareers} from './legacyNative20261107.js'
export const SOURCE='blackrock',COMPANY='BlackRock',CAREERS_URL=HOMEPAGE
export const DISPOSITION='current-own-native-published-subset-company-coverage-held'
export const run=runCurrentNative
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
