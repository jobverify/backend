import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runAdpushupPublicRead } from './currentPublic.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "adpushup"
export const COMPANY = "AdPushup"
export const CAREERS_URL = "https://www.adpushup.com/careers/"
export const DISPOSITION = "current-first-party-careers-context-incomplete"
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = "The default reader acquires the configured current anonymous careers document and retains its original response evidence. Any qualified hiring context is a non-vacancy observation; native, company and India vacancy totals remain unknown, inventory is incomplete, and lifecycle cleanup is forbidden."

export const run = async (options = {}) => runAdpushupPublicRead(options)

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
