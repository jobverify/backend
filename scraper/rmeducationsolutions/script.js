import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import RM_EDUCATION_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = RM_EDUCATION_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const INDIA_PAGE_URL = 'https://www.rm.com/about/our-locations/india'
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LOCATIONS_URL = PROVIDER_METADATA.locationsIndexUrl
export const INDIA_COUNTRY_URL = PROVIDER_METADATA.indiaCountryJobsUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialIndiaSignal = (html = '') => {
  const page = normalizeWhitespace(html) || ''

  return /Life\s*(?:@|at)\s*RM India/i.test(page)
    && (
      /join RM India/i.test(page)
      || /When you join RM India/i.test(page)
      || /Come to Trivandrum/i.test(page)
    )
}

export const hasVerifiedJobsShell = (html = '') => {
  const page = normalizeWhitespace(html) || ''
  return /See jobs by:/i.test(page)
    && /\bCategories\b/i.test(page)
    && /\bLocations\b/i.test(page)
}

const hasLocationsIndexSignal = (html = '') => {
  const page = normalizeWhitespace(html) || ''
  return page.includes('By City')
    && page.includes('By State / Province')
    && page.includes('By Country')
    && /\/jobs\/locations\/country\/India/i.test(String(html ?? ''))
}

const hasCountryRouteJobLinks = (html = '') => /\/jobs\/\d+\?lang=/i.test(String(html ?? ''))

export const createRmEducationSolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const indiaHtml = await fetchText(INDIA_PAGE_URL)
    if (!hasOfficialIndiaSignal(indiaHtml)) {
      throw new Error('RM Education Solutions verified RM India page no longer matches the expected first-party India surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedJobsShell(careersHtml)) {
      throw new Error('RM Education Solutions verified RM careers shell no longer matches the known public Jibe shell')
    }

    const locationsHtml = await fetchText(LOCATIONS_URL)
    if (!hasLocationsIndexSignal(locationsHtml)) {
      throw new Error('RM Education Solutions verified RM locations index no longer exposes the expected India navigation')
    }

    const indiaCountryHtml = await fetchText(INDIA_COUNTRY_URL)
    if (hasCountryRouteJobLinks(indiaCountryHtml)) {
      throw new Error('RM Education Solutions public jobs surface appeared on the India country route and needs reassessment before scraping')
    }

    if (!hasVerifiedJobsShell(indiaCountryHtml)) {
      throw new Error('RM Education Solutions verified empty India country shell no longer matches the fail-closed contract')
    }

    return []
  },
})

export const run = async (options = {}) => createRmEducationSolutionsScraper(options).run(options)

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
