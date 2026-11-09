import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublishedCareersScraper, roleLinks, firstPartyVeeam } from '../../scraper-support/native-sources/cisVeeam/nativeCareers.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'veeamindia'
export const COMPANY = 'Veeam India'
export const OFFICIAL_BRAND_NAME = 'Veeam'
export const VERIFIED_ON = null
export const INDIA_CAREERS_URL = 'https://careers.veeam.com/india'
// Historical seed retained for API compatibility; runtime follows current primary advertisements.
export const INDIA_JOBS_URL = 'https://careers.veeam.com/location/india-jobs/22681/1269750/2'
export const COMPANY_DOMAIN = 'careers.veeam.com'
export const buildIndiaJobsUrl = () => INDIA_JOBS_URL
export const extractJobCards = html => roleLinks(SOURCE, html)
export const extractJobDetail = firstPartyVeeam
export const createVeeamIndiaScraper = () => createPublishedCareersScraper(SOURCE)
export const run = options => createVeeamIndiaScraper().run(options)

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
