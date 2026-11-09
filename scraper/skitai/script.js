import currentConfig from './currentConfig.json' with {type:'json'}
import currentScope from './current.scope.json' with {type:'json'}
import {runCurrentKeka} from '../acciojob/currentKeka.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createVerifiedCareersEmptyStateScraper } from './verifiedCareersEmptyState.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "skitai"
export const COMPANY = "Skit.ai"
export const CAREERS_URL = "https://skit.ai/careers/"
export const DISPOSITION = "verified-first-party-careers-empty-result"
export const VERIFIED_ON = "2026-07-25"
export const VERIFIED_SURFACE_SUMMARY = "Verified on Saturday, July 25, 2026 that https://skit.ai/careers/ was the live first-party careers surface for Skit.ai and exposed zero trustworthy public jobs. The dedicated batch-04 snapshot scraper returns this authoritative empty result; a future review must replace it with a parser before publishing jobs."

export const run = (options={}) => runCurrentKeka(currentConfig,currentScope,options)

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
