import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createAXANativeScraper} from './native20261108.js'

export const SOURCE = "axa"
export const COMPANY = "AXA"
export const CAREERS_URL = "https://careers.axa.com/careers-home/"
export const DISPOSITION = 'native-current-posting-extraction;country-conflicts-and-company-scope-unresolved'
export const run = options => createAXANativeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
