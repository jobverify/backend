import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHealth2070NativeScraper} from './native20261108.js'

export const SOURCE = "2070health"
export const COMPANY = "2070Health"
export const CAREERS_URL = "https://2070health.com/careers/"
export const DISPOSITION = 'native-listing-and-partial-detail-extraction'
export const run = options => createHealth2070NativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
