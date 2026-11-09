import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HAPPAY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_PAGE_URL = PROVIDER_METADATA.jobsPageUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.contactPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
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
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Current Openings')
    && normalized.includes('Amazing things happen at Happay all the time.')
    && normalized.includes('Begin your journey of excellence with Indias leading Travel, Expense and Payment Management Solution.')
    && /Happay-MMT/i.test(page)
    && /makemytrip/i.test(normalized)
}

export const hasBrokenJobsShortcodeSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return (
    normalized.includes('Home Â» Jobs')
    && normalized.includes('[jobs per_page="12" show_filters="true"]')
    && /Happay-MMT/i.test(page)
  ) || (
    /<title>\s*Jobs\s*-\s*Expense Management Software/i.test(page)
    && normalized.includes('Expense Management')
    && normalized.includes('Travel Management')
    && /Happay-MMT/i.test(page)
  )
}

export const hasOfficialCareersContactSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Looking to get in touch with us?')
    && normalized.includes('To join the Happay team')
    && normalized.includes('careers@happay.in')
    && (
      normalized.includes('MakeMyTrip India Private Limited')
      || normalized.includes('MakeMyTrip (India) Limited')
    )
    && normalized.includes('Bengaluru office address')
}

export const pageExposesStructuredJobListings = (html = '') =>
  /<(?:article|li|div)[^>]+(?:job-card|job-listing|opening)[^>]*>[\s\S]*?<a[^>]+href=["'][^"']+["'][^>]*>[\s\S]*?(?:apply now|view job|job details)/i.test(String(html ?? ''))
  || /href=["'][^"']*\/jobs\/[^"']+["'][^>]*>\s*(?:apply now|view job|job details)/i.test(String(html ?? ''))

export const createHappayScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Happay careers page no longer matches the trusted first-party surface')
    }

    const jobsHtml = await fetchText(JOBS_PAGE_URL)
    if (pageExposesStructuredJobListings(jobsHtml)) {
      throw new Error('The Happay jobs page now exposes structured public job listings and needs a dedicated scraper')
    }
    if (!hasBrokenJobsShortcodeSignal(jobsHtml)) {
      throw new Error('The verified Happay jobs shortcode page no longer matches the trusted first-party surface')
    }

    const contactHtml = await fetchText(CONTACT_PAGE_URL)
    if (!hasOfficialCareersContactSignal(contactHtml)) {
      throw new Error('The verified Happay contact page no longer matches the trusted hiring contact surface')
    }

    return []
  },
})

export const run = async (options = {}) => createHappayScraper().run(options)

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
