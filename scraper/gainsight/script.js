import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { GAINSIGHT_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_SHELL_URL = PROVIDER_METADATA.officialJobsShellUrl
export const LOCATIONS_URL = PROVIDER_METADATA.officialLocationsUrl
export const EXPECTED_JIBE_COMPANY_ID = 'gainsight'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
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

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Careers & Culture/i.test(text)
    && /Find (?:Authentic Jobs|Your Dream Job)/i.test(text)
    && /Gainsight Software/i.test(text)
}

export const extractJibeCompanyId = (html = '') =>
  String(html ?? '').match(/window\._jibe\s*=\s*\{"cid":"([^"]+)"\}/i)?.[1] || null

export const hasEmptyJobsShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Gainsight Careers\s*<\/title>/i.test(page)
    && extractJibeCompanyId(page) === EXPECTED_JIBE_COMPANY_ID
    && /search-results-none/i.test(page)
    && /Join Our Talent Community/i.test(text)
}

export const hasEmptyLocationsSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /No cities/i.test(text) && /No country/i.test(text)
}

export const hasPublicJobSignal = (html = '') =>
  /href=["']\/jobs\/(?!brands\b|locations\b|categories\b|Join-Our-Talent-Network\b)[^"'?#/][^"'?#]*["']/i.test(String(html ?? ''))
  || /data-job-id=/i.test(String(html ?? ''))

export const createGainsightScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Gainsight verified official careers page no longer matches the trusted surface')
    }

    const jobsShellHtml = await fetchText(JOBS_SHELL_URL)
    if (hasPublicJobSignal(jobsShellHtml)) {
      throw new Error('Gainsight first-party Jibe shell now appears to expose public jobs')
    }
    if (!hasEmptyJobsShellSignal(jobsShellHtml)) {
      throw new Error('Gainsight verified empty first-party Jibe shell changed materially')
    }

    const locationsHtml = await fetchText(LOCATIONS_URL)
    if (!hasEmptyLocationsSignal(locationsHtml)) {
      throw new Error('Gainsight verified empty locations surface changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createGainsightScraper().run(options)

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
