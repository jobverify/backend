import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {runCurrentNative,INDEX} from './currentNative20261119.js'
import {createEpamScraper as createLegacyEpamScraper} from './legacyNative20261107.js'
export * from './legacyNative20261107.js'
export const SOURCE='epam',COMPANY='EPAM',CAREERS_URL=INDEX
export const DISPOSITION='current-own-native-published-subset-company-coverage-held'
// Historical parsed/native packet callers retain their previous held admission
// boundary. Ordinary production/factory calls always use current originals.
export const createEpamScraper=({maxJobs=null}={})=>({run:(options={})=>
 options.transport||options.fetchJson?createLegacyEpamScraper({maxJobs}).run(options):runCurrentNative({maxJobs,...options})})
export const run=(options={})=>createEpamScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js'),jobs=await run()
 if(process.argv.includes('--dry-run'))saveToFile(jobs,path.join(path.dirname(fileURLToPath(import.meta.url)),'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
