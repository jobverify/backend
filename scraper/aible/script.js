import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAibleNativeScraper } from './native20261108.js'

export const SOURCE = "aible"
export const COMPANY = "Aible"
export const CAREERS_URL = "https://www.aible.com/careers"
export const DISPOSITION = 'native-authored-roles-country-and-rendered-publication-unqualified'
export const run = options => createAibleNativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
