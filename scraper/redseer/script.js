import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { REDSEER_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_JOBS_ARCHIVE_URL = PROVIDER_METADATA.publicJobsArchiveUrl
export const JOBS_FEED_URL = PROVIDER_METADATA.emptyJobsFeedUrl
export const JOBS_API_URL = PROVIDER_METADATA.emptyJobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractArchiveJobsSection = (html = '') => {
  const match = String(html ?? '').match(/<div class="job-openings">\s*([\s\S]*?)\s*<\/div>/i)
  return match?.[1] ?? ''
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*Join the Red Team\s*\|\s*RedSeer\s*<\/title>/i.test(page)
    && text.includes('Challenge the Unchallenged')
    && text.includes('Work with a band of strategy consultants who have disrupted the 100+ year old legacy consulting industry')
    && text.includes('Job Openings')
    && /id="rec_job_listing_div"/i.test(page)
    && text.includes('Campus Placements')
    && text.includes('This form is for placement cells. For job applications, please apply through the listings on this page.')
}

export const hasOfficialArchiveSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Job openings Archive\s*\|\s*Redseer Strategy Consultants\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/redseer\.com\/jobopenings\/["'][^>]*>/i.test(page)
    && text.includes('Job Openings')
    && /<form[^>]+action="\/jobopenings\/"/i.test(page)
    && text.includes('All industries')
    && text.includes('Consulting')
    && text.includes('Bengaluru')
    && text.includes('Gurgaon')
    && text.includes('Singapore')
    && text.includes('Dubai')
    && text.includes('View More')
}

export const hasVisibleArchiveJobs = (html = '') => {
  const section = extractArchiveJobsSection(html)

  return /job-opening-card|rec-job-title|open-position|opening-item/i.test(section)
    || /<a\b[^>]+href=["']https:\/\/redseer\.com\/jobopenings\/[^"']+/i.test(section)
}

export const hasEmptyJobFeedSignal = (xml = '') => {
  const page = String(xml ?? '')

  return /<title>\s*Job openings Archive\s*\|\s*Redseer Strategy Consultants\s*<\/title>/i.test(page)
    && /<link>\s*https:\/\/redseer\.com\/jobopenings\/\s*<\/link>/i.test(page)
    && !/<item>/i.test(page)
}

export const isEmptyJobsApiPayload = (payload) =>
  Array.isArray(payload) && payload.length === 0

export const createRedseerScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Redseer verified official careers page no longer matches the trusted first-party surface')
    }

    const archiveHtml = await fetchText(PUBLIC_JOBS_ARCHIVE_URL)
    if (hasVisibleArchiveJobs(archiveHtml)) {
      throw new Error('Redseer job archive now appears to expose public jobs')
    }

    if (!hasOfficialArchiveSignal(archiveHtml)) {
      throw new Error('Redseer verified public job archive no longer matches the trusted first-party surface')
    }

    const feedXml = await fetchText(JOBS_FEED_URL)
    if (!/<title>\s*Job openings Archive\s*\|\s*Redseer Strategy Consultants\s*<\/title>/i.test(feedXml || '')) {
      throw new Error('Redseer verified job feed no longer matches the trusted first-party surface')
    }

    if (!hasEmptyJobFeedSignal(feedXml)) {
      throw new Error('Redseer job feed now appears to expose public jobs')
    }

    const jobsApiPayload = await fetchJson(JOBS_API_URL)
    if (!Array.isArray(jobsApiPayload)) {
      throw new Error('Redseer verified job api no longer matches the trusted first-party surface')
    }

    if (!isEmptyJobsApiPayload(jobsApiPayload)) {
      throw new Error('Redseer job api now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createRedseerScraper().run(options)

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
