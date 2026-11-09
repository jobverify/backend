import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  extractSearchResults as extractExotelSearchResults,
  hasRecruiterboxSignal,
} from '../exotel/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { AMEYO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = AMEYO_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const CAREERS_HOME_URL = PROVIDER_METADATA.companyCareerPage
export const OPENINGS_API_URL = PROVIDER_METADATA.openingsApiUrl
export const VERIFIED_UPSTREAM_JOB_URL = PROVIDER_METADATA.verifiedUpstreamJobUrl
export const UPSTREAM_COMPANY_NAME = PROVIDER_METADATA.upstreamCompanyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#39;|&apos;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const extractCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]+href=['"]([^'"]+)['"]/gi)) {
    const url = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (url === OFFICIAL_CAREERS_HANDOFF_URL) {
      return url
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Call Center Software | Call Center Solution | Helpdesk Software - Ameyo'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.ameyo\.com\/["']/i.test(page)
    && normalized.includes('Ameyo XTRM by Exotel')
    && (extractCareersUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
      || (page.includes('/wp-content/uploads/2023/04/ameyo-by-exotel-logo.svg')
        && !/\bcareers\b/i.test(page)))
}

export const hasUpstreamCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Careers | Exotel'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/exotel\.com\/about-us\/careers\/["']/i.test(page)
    && normalized.includes('Build what connects the world')
    && normalized.includes('Find the job that matches your skills')
    && /rbox-loader-script/i.test(page)
    && /rbox-opening-list/i.test(page)
}

export const extractSearchResults = (payload) => extractExotelSearchResults(payload)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(30000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasExpectedHomepageOutageSignal = ({ status, url, html } = {}) =>
  Number(status) === 522
  && sameUrl(url, HOMEPAGE_URL)
  && /kinsta\.cloud\s*\|\s*522:\s*connection timed out|error code:\s*522|cf-error-details/i.test(String(html ?? ''))

export const createAmeyoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    let homepagePage, homepageTimedOut = false
    try {
      homepagePage = await fetchPage(HOMEPAGE_URL)
    } catch (error) {
      if (!['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT'].includes(error?.cause?.code || error?.code)
        && error?.name !== 'TimeoutError') throw error
      homepageTimedOut = true
    }
    const homepageHtml = homepagePage?.html

    if (!homepageTimedOut && !hasOfficialHomepageSignal(homepageHtml) && !hasExpectedHomepageOutageSignal(homepagePage)) {
      throw new Error('Ameyo verified homepage handoff no longer matches the trusted public surface')
    }

    if (hasOfficialHomepageSignal(homepageHtml)
      && extractCareersUrl(homepageHtml)
      && extractCareersUrl(homepageHtml) !== OFFICIAL_CAREERS_HANDOFF_URL) {
      throw new Error('Ameyo verified homepage handoff no longer points to the trusted Exotel careers route')
    }

    const careersHtml = await fetchText(CAREERS_HOME_URL)

    if (!hasUpstreamCareersSignal(careersHtml)) {
      throw new Error('Ameyo verified upstream careers page no longer matches the trusted public surface')
    }

    const payload = await fetchJson(OPENINGS_API_URL)
    if (!hasRecruiterboxSignal(payload)) {
      throw new Error('Ameyo verified openings feed no longer matches the trusted Recruiterbox surface')
    }

    const jobs = extractSearchResults(payload)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = now()

    return selectedJobs.map((job) => ({
      ...job,
      company: COMPANY_NAME,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createAmeyoScraper().run(options)

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
