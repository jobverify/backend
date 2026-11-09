import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { STRATOGENT_TECHNOLOGY_SERVICES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#8220;|&#8221;|&quot;/gi, '"')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*PTP India Careers:\s*Grow Fast in Biotech &(?:amp;|&)\s*Life Sciences IT\s*<\/title>/i.test(page)
    && text.includes('Opportunities at PTP / Stratogent: Build trusted life sciences cloud from India')
    && text.includes('always hiring')
    && (/mailto:careers-india@stratogent\.com/i.test(page) || text.includes('careers-india@stratogent.com'))
}

export const hasPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /class=["'][^"']*(job-card|opening-card|position-card)[^"']*["']/i.test(page)
    || /\bcurrent openings?\b/i.test(page)
    || /\bjob openings?\b/i.test(page)
    || /\bopen positions?\b/i.test(page)
    || /\bapply now\b/i.test(page)
    || /href=["'][^"']+\/jobs\/[^"']+["']/i.test(page)
}

export const createStratogentTechnologyServicesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Stratogent Technology Services verified careers page no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(careersHtml)) {
      throw new Error('Stratogent Technology Services careers surface now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createStratogentTechnologyServicesScraper().run(options)

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
