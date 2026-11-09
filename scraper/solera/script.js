import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SOLERA_CATALOG as PROVIDER_METADATA } from './catalog.js'
import { runCurrentSoleraInventory } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const WORKDAY_TENANT_URL = PROVIDER_METADATA.workdayTenantUrl
export { PROVIDER_METADATA }

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Revving Up For Growth')
    && normalized.includes('Ready to take things to the next level? Start your journey here.')
}

export const hasWorkdayHandoffSignal = (html = '') =>
  String(html ?? '').includes(WORKDAY_TENANT_URL)
    && /See Open Positions/i.test(String(html ?? ''))

export const hasInlineJobCards = (html = '') =>
  /job card|job opening|current openings|view job|apply now|job-search-results|opening-title/i
    .test(normalizeWhitespace(html))

export const createSoleraScraper = () => ({ run: runCurrentSoleraInventory })

export const run = runCurrentSoleraInventory

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
