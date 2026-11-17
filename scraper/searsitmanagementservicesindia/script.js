import {runCurrentSears} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'



import { SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage



const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()



export const hasOfficialSearsCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(html)

  return /<title[^>]*>\s*Sears India Careers\s*\|\s*Together,\s*Let(?:’|'|&#8217;)s Commit to Excellence\s*<\/title>/i.test(rawHtml)
    && text.includes('Together, Let’s Commit to Excellence')
    && text.includes('Current Openings')
    && text.includes('Pune')
    && text.includes('Hyderabad')
    && text.includes('We are hiring for multiple roles across all Business Units')
    && text.includes('Job Disclaimer')
}

export const pageExposesStructuredJobListings = (html = '') => {
  const page = String(html ?? '')
  return /job[-_\s]?title/i.test(page)
    || /<a[^>]+href=["'][^"']+(job|opening|career)[^"']+["'][^>]*>\s*(Apply|View|Read|More Details)/i.test(page)
  }

export const createSearsITManagementServicesIndiaScraper = () => ({
  async run(options={}) { return runCurrentSears(options) },
})

export const run = async (options = {}) => createSearsITManagementServicesIndiaScraper().run(options)

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
