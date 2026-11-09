import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EARLYSALARY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EARLYSALARY_CATALOG.source
export const COMPANY = EARLYSALARY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EARLYSALARY_CATALOG.officialBrandName
export const HOMEPAGE_URL = EARLYSALARY_CATALOG.homepageUrl
export const REDIRECTED_HOMEPAGE_URL = EARLYSALARY_CATALOG.redirectedHomepageUrl
export const CAREERS_URL = EARLYSALARY_CATALOG.companyCareerPage
export const LEGACY_CAREERS_URL = EARLYSALARY_CATALOG.legacyCareersUrl
export const JOBS_URL = EARLYSALARY_CATALOG.checkedJobsRouteUrl
export const COUNTRY_FILTER = EARLYSALARY_CATALOG.countryFilter
export const VERIFIED_ON = EARLYSALARY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EARLYSALARY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EARLYSALARY_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bopen jobs\b/i,
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

const toAbsoluteUrl = (value, baseUrl = REDIRECTED_HOMEPAGE_URL) => {
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
  return toAbsoluteUrl(match?.[1], REDIRECTED_HOMEPAGE_URL)
}

export const hasOfficialRedirectedHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes("india's largest lending platform")
    && normalized.includes('fibe')
    && normalized.includes('careers')
    && normalized.includes('explore jobs at fibe')
    && extractHomepageCareersUrl(html) === CAREERS_URL
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return normalized.includes('career - join our team | fibe')
    && normalized.includes('be a part of fibe')
    && normalized.includes('rewards and recognition keep us going')
    && /rel="canonical"[^>]+href="https:\/\/www\.fibe\.in\/careers\/"/i.test(rawHtml)
}

export const hasEmptyJobsStateSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const unescapedJson = decodeHtmlEntities(rawHtml).replace(/\\"/g, '"')

  return normalized.includes('no jobs found')
    && normalized.includes('rewards and recognition keep us going')
    && /"currentjobopeningsdepts"\s*:\s*null/i.test(unescapedJson)
}

export const pageExposesPublicJobListings = (html) => {
  const rawHtml = String(html ?? '')
  if (hasEmptyJobsStateSignal(rawHtml)) return false
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(rawHtml))
}

export const isVerifiedMissingJobsRoute = (page = {}) =>
  Number(page.status) === 404 && !pageExposesPublicJobListings(page.html)

export const createEarlySalaryScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeUrl(homepage.url) !== REDIRECTED_HOMEPAGE_URL
      || !hasOfficialRedirectedHomepageSignal(homepage.html)
    ) {
      throw new Error('EarlySalary redirected homepage no longer matches the verified official redirect to Fibe')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || normalizeUrl(careersPage.url) !== CAREERS_URL
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('EarlySalary careers page changed materially or no longer matches the verified first-party Fibe careers surface')
    }

    if (pageExposesPublicJobListings(careersPage.html) || !hasEmptyJobsStateSignal(careersPage.html)) {
      throw new Error('EarlySalary careers page changed materially or now exposes a public jobs surface')
    }

    const jobsRoute = await fetchPage(JOBS_URL)
    if (!isVerifiedMissingJobsRoute(jobsRoute)) {
      throw new Error('EarlySalary jobs route changed materially or now exposes a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEarlySalaryScraper().run(options)

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
