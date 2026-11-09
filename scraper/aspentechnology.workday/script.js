import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {runAspenNativeRecruitment} from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "aspentechnology"
export const COMPANY = "Aspen Technology"
export const CAREERS_URL = 'https://www.aspentech.com/en/careers'
export const DISPOSITION = 'current-company-published-native-India-offices-partial-company-scope'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Current corporate handoff, published native India office facets, full original role and employer models, calendar publication and closing publisher/listing/role reconciliation. Whole-company recruitment scope remains unqualified.'

export const run = options => runAspenNativeRecruitment(options)

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
