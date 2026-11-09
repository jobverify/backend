import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAstraSecurityNativeScraper } from './native20261108.js'

export const SOURCE = "astrasecurity"
export const COMPANY = "Astra Security"
export const CAREERS_URL = "https://www.getastra.com/team-and-culture"
export const DISPOSITION = 'native-board-and-own-details;unknown-country-and-company-scope-held'
export const run = options => createAstraSecurityNativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
