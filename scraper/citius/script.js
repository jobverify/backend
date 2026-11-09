import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCitiusTechScraper } from '../citiustech/script.js'
import { CITIUS_CATALOG } from './catalog.js'

export {
  buildApplyUrl,
  buildDetailUrl,
  buildSearchRequestPayload,
  extractJobDetail,
  extractSearchResults,
  extractSearchSummary,
  isIndiaListing,
} from '../citiustech/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const HOMEPAGE_TITLE = 'CitiusTech | Healthcare Technology Solutions & Service Provider in US'
const CAREERS_PAGE_TITLE = 'CitiusTech Careers | Build Real Impact. Join Our Team.'
const JOB_BOARD_TITLE = 'CitiusTech Careers | Latest jobs at CitiusTech - Ripplehire.com'

export const PROVIDER_METADATA = CITIUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const COMPANY_CAREER_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const JOB_BOARD_URL = PROVIDER_METADATA.jobBoardUrl
export const JOB_SEARCH_API_URL = PROVIDER_METADATA.jobsApiUrl

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractCareersHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/citiustech\.ripplehire\.com\/candidate\/\?token=bCKlfz3OO8vQIgiM2vuI(?:&amp;|&)source=CAREERSITE#list/i,
  )

  return match ? decodeHtmlEntities(match[0]) : null
}

export const hasVerifiedHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /<title\b[^>]*>/i.test(String(html ?? ''))
    && normalized.includes(HOMEPAGE_TITLE)
    && normalized.includes('CitiusTech')
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /<title\b[^>]*>/i.test(String(html ?? ''))
    && normalized.includes(CAREERS_PAGE_TITLE)
    && />\s*Open Roles\s*</i.test(String(html ?? ''))
    && extractCareersHandoffUrl(html) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const hasVerifiedJobBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /<title\b[^>]*>/i.test(String(html ?? ''))
    && normalized.includes(JOB_BOARD_TITLE)
    && normalized.includes('Latest jobs at CitiusTech')
}

const decorateJobs = (jobs, scrapedAt) => jobs.map((job) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  scrapedAt,
}))

export const createCitiusScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson,
    maxPages,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('Citius verified homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(COMPANY_CAREER_PAGE_URL)
    if (careersPage.status !== 200 || !hasVerifiedCareersPageSignal(careersPage.html)) {
      throw new Error('Citius verified careers page no longer exposes the known RippleHire handoff')
    }

    const jobBoardPage = await fetchPage(JOB_BOARD_URL)
    if (jobBoardPage.status !== 200 || !hasVerifiedJobBoardSignal(jobBoardPage.html)) {
      throw new Error('Citius verified public RippleHire board no longer matches the known surface')
    }

    const jobs = await createCitiusTechScraper().run({
      fetchJson,
      maxPages,
    })

    return decorateJobs(jobs, now())
  },
})

export const run = async (options = {}) => createCitiusScraper().run(options)

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
