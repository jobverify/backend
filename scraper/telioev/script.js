import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCurrentPublications } from './currentPublished20261120.js'
import { PROVIDER_METADATA } from './catalog.js'

export { PROVIDER_METADATA }

export const SOURCE = "telioev"
export const COMPANY = "TelioEV"
export const CAREERS_URL = 'https://telioev.com/job-opening/'
export const DISPOSITION = 'current-own-native-partial-publication'
export const run = options => runCurrentPublications(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
