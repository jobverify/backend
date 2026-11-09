import {createDoximityNativeScraper} from './native20261108.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import provider from './catalog.js'
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage
export const createDoximityScraper=createDoximityNativeScraper
export const run=options=>createDoximityScraper().run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
