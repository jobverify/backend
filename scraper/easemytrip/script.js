import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {collectEaseMyTripNative,runEaseMyTripNative} from './nativeCareers.js'
export {SOURCE,COMPANY,HOME as HOME_URL,CAREERS as CAREERS_URL,APPLICATION as APPLICATION_URL} from './nativeModels.js'
import {SOURCE} from './nativeModels.js'
export const inspectInventory=collectEaseMyTripNative
export const run=runEaseMyTripNative

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')

  if (isDryRun) {
    saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
