import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LINQ_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = LINQ_CATALOG.source
export const COMPANY = LINQ_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = LINQ_CATALOG.officialBrandName
export const VERIFIED_ON = LINQ_CATALOG.verifiedOn
export const HOMEPAGE_URL = LINQ_CATALOG.officialHomepageUrl
export const COMPANY_PAGE_URL = LINQ_CATALOG.officialCompanyPageUrl
export const JOB_BOARD_PAGE_URL = LINQ_CATALOG.officialJobBoardUrl
export const API_BASE_URL = LINQ_CATALOG.apiBaseUrl
export const JOB_SEARCH_API_URL = LINQ_CATALOG.jobSearchApiUrl
export const JOB_DETAIL_API_BASE_URL = LINQ_CATALOG.jobDetailApiBaseUrl
export const COMPANY_ID = LINQ_CATALOG.companyId

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const stripTags = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const normalizeWhitespace = (value) => stripTags(value).toLowerCase()

export const buildSearchApiUrl = ({ companyId = COMPANY_ID, page = 1, pageSize = 50 } = {}) => {
  const params = new URLSearchParams()
  params.set('companyId', String(companyId))
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  return `${JOB_SEARCH_API_URL}?${params.toString()}`
}

export const hasVerifiedHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Candidates\s*-\s*linq, where the right job offers come to you\s*<\/title>/i.test(page)
    && normalized.includes('linq')
    && page.includes('https://app.linq.co/en/job-board')
}

export const hasVerifiedCompanyPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*linq\s*-\s*Talent\. Unlocked\.\s*-\s*linq\s*<\/title>/i.test(page)
    && normalized.includes('staffing - recruitment')
    && normalized.includes('11-50')
    && normalized.includes('patsi spyrou 62, 118 55')
    && normalized.includes('open positions')
}

export const hasVerifiedJobBoardSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Jobs in Greece\s*-\s*linq\s*<\/title>/i.test(page)
    && normalized.includes('jobs in greece')
    && (/\/job-board\b/i.test(page) || normalized.includes('explore jobs'))
}

export const isClientHandoffText = (value) => /on behalf of/i.test(stripTags(value))

export const isDirectLinqRole = (detail) => {
  const companyId = detail?.company?.company_id
  const status = String(detail?.jobStatus ?? '').toLowerCase()
  const text = `${detail?.headline ?? ''} ${detail?.basicInformation ?? ''}`

  return companyId === COMPANY_ID
    && status === 'active'
    && !isClientHandoffText(text)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const buildJobUrl = (id) => `https://app.linq.co/en/job/${id}`

const buildDescription = (detail) =>
  [
    stripTags(detail?.basicInformation),
    stripTags(detail?.responsibilities),
    stripTags(detail?.requirements),
    stripTags(detail?.benefits),
  ]
    .filter(Boolean)
    .join('\n\n')

const mapJob = (detail, { now }) => ({
  title: detail.headline,
  company: COMPANY,
  source: SOURCE,
  location: detail?.location?.title ?? null,
  employmentType: detail?.statusType?.name_en ?? null,
  experienceLevel: detail?.experienceLevel?.name_en ?? null,
  description: buildDescription(detail),
  link: buildJobUrl(detail.id),
  companyCareerPage: COMPANY_PAGE_URL,
  scrapedAt: now(),
})

const readLastPage = (payload) => {
  const lastPage = Number(payload?.meta?.last_page ?? 1)
  return Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1
}

const validateSearchListing = (listing) => {
  if (listing?.company?.company_id !== COMPANY_ID) {
    throw new Error('Linq company filter drifted on the official search API')
  }
}

export const createLinqScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    pageSize = 50,
    maxPages = Infinity,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('Linq verified homepage no longer matches the official first-party surface')
    }

    const companyPage = await fetchPage(COMPANY_PAGE_URL)
    if (companyPage.status !== 200 || !hasVerifiedCompanyPageSignal(companyPage.html)) {
      throw new Error('Linq verified company page no longer matches the official first-party surface')
    }

    const jobBoardPage = await fetchPage(JOB_BOARD_PAGE_URL)
    if (jobBoardPage.status !== 200 || !hasVerifiedJobBoardSignal(jobBoardPage.html)) {
      throw new Error('Linq verified public job board no longer matches the official first-party surface')
    }

    const jobs = []
    let page = 1
    let lastPage = 1

    do {
      const payload = await fetchJson(buildSearchApiUrl({ companyId: COMPANY_ID, page, pageSize }))
      const listings = Array.isArray(payload?.data) ? payload.data : null
      if (!listings) {
        throw new Error('Linq official search API no longer returns the expected listings payload')
      }

      lastPage = readLastPage(payload)

      for (const listing of listings) {
        validateSearchListing(listing)
        const detailPayload = await fetchJson(`${JOB_DETAIL_API_BASE_URL}/${listing.id}`)
        const detail = detailPayload?.data
        if (!detail) {
          throw new Error(`Missing Linq job detail payload for ${listing.id}`)
        }

        if (isDirectLinqRole(detail)) {
          jobs.push(mapJob(detail, { now }))
        }
      }

      page += 1
    } while (page <= lastPage && page <= maxPages)

    return jobs
  },
})

export const run = async (options = {}) => createLinqScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
