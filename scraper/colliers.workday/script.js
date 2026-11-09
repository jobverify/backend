import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOARD, runNativeColliers } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "colliers"
export const COMPANY = "Colliers"
export const CAREERS_URL = BOARD
export const DISPOSITION = 'current-first-party-regional-native-HTML'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current India listing pages and full native role records are reconciled. Original publication, written country, employer and application identities are retained; other regional boards and publication remain unverified.'

export const run = options => runNativeColliers(options)

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
