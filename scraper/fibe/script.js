import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FIBE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FIBE_CATALOG.source
export const COMPANY = FIBE_CATALOG.companyName
export const HOMEPAGE_URL = FIBE_CATALOG.homepageUrl
export const CAREERS_URL = FIBE_CATALOG.companyCareerPage
export const JOBS_URL = FIBE_CATALOG.checkedJobsRouteUrl
export const COUNTRY_FILTER = FIBE_CATALOG.countryFilter
export const VERIFIED_ON = FIBE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FIBE_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = FIBE_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bopen jobs\b/i,
  /\bopen roles?\b/i,
  /\/careers\/[^"'`\s<>]+/i,
  /"currentjobopeningsdepts"\s*:\s*\[/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&#x27;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
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

export const extractHomepageCareersUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href="([^"]*\/careers\/?[^"]*)"/i)
  return toAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes("india's largest lending platform")
    && normalized.includes('fibe')
    && normalized.includes('explore jobs at fibe')
    && extractHomepageCareersUrl(html) === CAREERS_URL
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return normalized.includes('career - join our team | fibe')
    && normalized.includes('join us in building digital financial solutions')
    && normalized.includes('be a part of fibe')
    && /rel="canonical"[^>]+href="https:\/\/www\.fibe\.in\/careers\/"/i.test(rawHtml)
}

export const hasEmptyJobsStateSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('join us in building digital financial solutions')
    && normalized.includes('be a part of fibe')
    && normalized.includes('no jobs found')
    && normalized.includes('rewards and recognition keep us going')
}

export const pageExposesPublicJobListings = (html) => {
  const rawHtml = String(html ?? '')
  if (hasEmptyJobsStateSignal(rawHtml)) return false
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawHtml))
}

export const isVerifiedMissingJobsRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page.html).toLowerCase()

  return Number(page.status) === 404
    && normalized.includes('page not found')
    && !pageExposesPublicJobListings(page.html)
}

export const createFibeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeUrl(homepage.url) !== HOMEPAGE_URL
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Fibe homepage changed materially or no longer matches the verified official homepage')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || normalizeUrl(careersPage.url) !== CAREERS_URL
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Fibe careers page changed materially or no longer matches the verified first-party careers surface')
    }

    if (pageExposesPublicJobListings(careersPage.html) || !hasEmptyJobsStateSignal(careersPage.html)) {
      throw new Error('Fibe careers page changed materially or now exposes a public jobs surface')
    }

    const jobsRoute = await fetchPage(JOBS_URL)
    if (!isVerifiedMissingJobsRoute(jobsRoute)) {
      throw new Error('Fibe jobs route changed materially or now exposes a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFibeScraper().run(options)

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
