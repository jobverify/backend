import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { R_LOGIC_TECHNOLOGY_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG.source
export const COMPANY = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG.officialBrandName
export const VERIFIED_ON = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG.verifiedOn
export const CAREERS_CULTURE_URL = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG.companyCareerPage
export const CONTACT_URL = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG.contactPageUrl
export const PROVIDER_METADATA = R_LOGIC_TECHNOLOGY_SERVICES_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /href=["']https?:\/\/www\.r-logic\.com\/careers-culture\/[^"']+/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2018\u2019\u201b]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableText = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[\u2013\u2014]+/g, ' ')
  .replace(/[?]/g, "'")
  .replace(/\s+/g, ' ')

export const hasOfficialCareersCultureSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeComparableText(page)

  return /<title>\s*Careers\s*&amp;\s*Culture\s*-\s*R-Logic\s*<\/title>/i.test(page)
    && normalized.includes('careers and culture')
    && normalized.includes('your curiosity, your skills, your growth')
    && normalized.includes('see life at r-logic')
    && normalized.includes('employee stories')
    && normalized.includes('a day in the life at r-logic')
    && normalized.includes('passion. purpose. possibility.')
    && normalized.includes('join our team')
    && normalized.includes('bring your curiosity, test your ideas')
    && normalized.includes('get started')
}

export const hasOfficialContactHandoffSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeComparableText(page)

  return /<title>\s*Contact\s+Us\s*-\s*R-Logic\s*<\/title>/i.test(page)
    && normalized.includes("let's build what's next together")
    && normalized.includes('careers at r-logic')
    && normalized.includes('explore roles, growth paths, and what life is like in our teams.')
    && (/landbot\.pro/i.test(page) || /wa\.link/i.test(page))
}

const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createRLogicTechnologyServicesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_CULTURE_URL)
    const contactHtml = await fetchText(CONTACT_URL)

    if (!hasOfficialCareersCultureSignal(careersHtml)) {
      throw new Error('R-Logic Technology Services verified first-party careers-culture surface no longer matches the public contract')
    }

    if (!hasOfficialContactHandoffSignal(contactHtml)) {
      throw new Error('R-Logic Technology Services verified first-party contact handoff surface no longer matches the public contract')
    }

    if (hasPublicJobsSignal(careersHtml) || hasPublicJobsSignal(contactHtml)) {
      throw new Error('R-Logic Technology Services careers or contact surface now exposes a direct public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createRLogicTechnologyServicesScraper().run(options)

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
