import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SALESKEN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
]

export const SOURCE = SALESKEN_CATALOG.source
export const COMPANY = SALESKEN_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SALESKEN_CATALOG.officialBrandName
export const VERIFIED_ON = SALESKEN_CATALOG.verifiedOn
export const PROVIDER_METADATA = SALESKEN_CATALOG
export const HOMEPAGE_URL = SALESKEN_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = SALESKEN_CATALOG.companyCareerPage
export const JOBS_PAGE_URL = SALESKEN_CATALOG.verifiedJobsPageUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Empower Your Sales with AI \| Salesken\.ai\s*<\/title>/i.test(page)
    && normalized.includes('Empower Your Sales with AI')
    && /(?:Book|Request) a Demo/i.test(normalized)
    && normalized.includes('Pricing')
    && normalized.includes('Privacy Policy')
    && !/\bcareers\b/i.test(normalized)
}

export const isVerifiedMissingRouteResponse = ({ status, html } = {}) =>
  Number(status) === 404 && !hasPublicJobsSignal(html)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

export const createSaleskenScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (Number(homepage.status) !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Salesken verified official homepage changed materially')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Salesken careers surface now appears to expose public jobs')
    }
    if (!isVerifiedMissingRouteResponse(careersPage)) {
      throw new Error('Salesken verified missing careers route changed materially')
    }

    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (hasPublicJobsSignal(jobsPage.html)) {
      throw new Error('Salesken jobs surface now appears to expose public jobs')
    }
    if (!isVerifiedMissingRouteResponse(jobsPage)) {
      throw new Error('Salesken verified missing jobs route changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createSaleskenScraper().run(options)

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
