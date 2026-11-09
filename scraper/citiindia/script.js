import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCitiSpecScraper, citiDetail } from '../../scraper-support/native-sources/citiSpec/nativeCareers.js'
import { CITI_PRIMARY, readCitiSearch, citiPagination } from '../../scraper-support/native-sources/citiSpec/citiProfile.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const COMPANY_NAME = 'Citi India'
export const SOURCE = 'citiindia'
export const ATS_PLATFORM = 'talentbrew-radancy'
export const BASE_URL = 'https://jobs.citi.com'
export const CAREER_PAGE_URL = CITI_PRIMARY
export const buildSearchUrl = ({ page = 1, primaryHTML } = {}) => {
  if (page === 1) return CAREER_PAGE_URL
  if (!primaryHTML) throw Error('Current native primary HTML is required for declared GET pagination')
  return citiPagination(readCitiSearch(primaryHTML), page).url
}
export const extractSearchResults = html => readCitiSearch(html).cards
export const extractPaginationSummary = html => {
  const parsed = readCitiSearch(html)
  return { hasNext: parsed.currentPage < parsed.totalPages, currentPage: parsed.currentPage, totalPages: parsed.totalPages, totalJobCount: parsed.reportedJobs }
}
export const extractJobDetail = citiDetail
export const createCitiIndiaScraper = options => createCitiSpecScraper(SOURCE, options)
export const run = options => createCitiIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
