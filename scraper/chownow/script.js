import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CAREERS } from './native.js'
import { runCurrentChownow } from './currentApi.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "chownow"
export const COMPANY = "Chownow"
export const CAREERS_URL = CAREERS
export const DISPOSITION = 'reviewed-native-Lever-public-API-with-paired-records'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Read the reviewed native ChowNow Lever account directly, validate every original record and full criteria, and reconcile an unfiltered opening and closing snapshot. Corporate/API count disagreement, company scope and cleanup remain unqualified.'

export const run = options => runCurrentChownow(options)

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
