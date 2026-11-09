import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCurrentScraper } from './currentNative.js'

export const SOURCE = "2u"
export const COMPANY = "2U"
export const CAREERS_URL = "https://2u.com/careers/"
export const DISPOSITION = 'runtime-verified-recruitment'
export const run = options => createCurrentScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
