import path from 'node:path'
import { fileURLToPath } from 'node:url'

import CIVICA_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

import { createEmployerBoundWorkableScraper } from '../../scraper-support/utils/workableEmployerInventory.js'
export const PROVIDER_METADATA = CIVICA_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKABLE_PAGE_URL = 'https://apply.workable.com/civica-uk-ltd-1/'
export const createCivicaIndiaScraper = (defaults = {}) => createEmployerBoundWorkableScraper({
  source: SOURCE, company: 'Civica', tenant: 'civica-uk-ltd-1',
  accountUid: '8433007d-b16d-4cd7-bd7d-a8cd3a8ebff3', careersUrl: CAREERS_URL, companyDomain: 'civica.com',
  reciprocalWebsiteUrl: 'https://www.civica.com/en-gb/', reconcileClosingInventory: true,
}, defaults)
export const run = async (options = {}) => createCivicaIndiaScraper().run(options)

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
