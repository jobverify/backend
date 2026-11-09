import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNative } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "agco"
export const COMPANY = "AGCO"
export const CAREERS_URL = 'https://careers.agcocorp.com/search/'
export const DISPOSITION = 'first-party-agco-successfactors-native-tiles'

export const run = options => runNative(options)

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
