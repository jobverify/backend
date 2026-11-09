import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNativeHightouch } from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "hightouch"
export const COMPANY = "Hightouch"
export const CAREERS_URL = 'https://hightouch.com/careers'
export const DISPOSITION = 'current-first-party-Next-JobPosting-bound-native-Ashby-extraction'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Revalidate active primary role cards, matching Next JobPosting identity and current application account, native account branding and all unfiltered native role summaries. Reconcile both complete native content snapshots and retain original publication dates and compensation. Remote country scope and whole-company coverage remain unverified.'

export const run = options => runNativeHightouch(options)

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
