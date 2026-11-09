import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CAREERS, runNativeChownow } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "chownow"
export const COMPANY = "Chownow"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'current-official-loader-native-Lever-postings'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Reverify the current corporate script loader, public native feed data flow and role identities; retain original full native content and timestamps. Other channels and public visibility remain unknown.'

export const run = options => runNativeChownow(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
