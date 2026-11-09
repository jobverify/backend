import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL as SENTINEL_CAREERS_URL,
  CONTACT_EMAIL,
  createFailClosedSentinelScraper,
} from './failClosedSentinel.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "techjockey"
export const COMPANY = "Techjockey"
export const CAREERS_URL = SENTINEL_CAREERS_URL
export { CONTACT_EMAIL }
export const DISPOSITION = "verified-first-party-careers-empty-result"
export const VERIFIED_ON = "2026-07-25"
export const VERIFIED_SURFACE_SUMMARY = "Verified on Saturday, July 25, 2026 that https://www.techjockey.com/company/careers was the live Techjockey public careers surface and explicitly stated that there were currently no job openings while directing candidates to career@techjockey.com. This provider returns an authoritative empty result until the verified surface changes."

export const run = async () => createFailClosedSentinelScraper().run()

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
