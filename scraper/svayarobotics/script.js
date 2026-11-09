import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EXPECTED_JOB_TITLES as BASE_EXPECTED_JOB_TITLES,
  extractApplyEmail as baseExtractApplyEmail,
  extractPublicJobs as baseExtractPublicJobs,
  hasOfficialCareersSignal as baseHasOfficialCareersSignal,
  hasOfficialHomepageSignal as baseHasOfficialHomepageSignal,
  hasOfficialOpenPositionsSignal as baseHasOfficialOpenPositionsSignal,
  hasVerifiedCareersLink as baseHasVerifiedCareersLink,
  hasVerifiedOpenPositionsLink as baseHasVerifiedOpenPositionsLink,
  isVerifiedMissingRoute as baseIsVerifiedMissingRoute,
} from '../paninianindia/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'svayarobotics'
export const COMPANY = 'Svaya Robotics'
export const COMPANY_DOMAIN = 'svayatt.co.in'
export const HOMEPAGE_URL = 'https://www.svayatt.co.in/'
export const HOMEPAGE_ALIAS_URLS = [
  'https://www.paninian.com/',
]
export const CAREERS_URL = 'https://www.svayatt.co.in/blank-19'
export const OPEN_POSITIONS_URL = 'https://www.svayatt.co.in/blank-24'
export const SHARED_APPLY_EMAIL = 'careers_india@paninian.com'
export const SHARED_APPLY_URL = `mailto:${SHARED_APPLY_EMAIL}`
export const MISSING_ROUTE_URLS = [
  'https://www.svayatt.co.in/careers',
  'https://www.svayatt.co.in/career',
  'https://www.svayatt.co.in/jobs',
  'https://www.svayatt.co.in/join-us',
]
export const EXPECTED_JOB_TITLES = [...BASE_EXPECTED_JOB_TITLES]
export const ATS_PLATFORM = 'official-company-careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return null
  }
}

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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to the Svaya Robotics scraper')
  }

  return parsed.toISOString()
}

const remapJobIdentifiers = (job) => {
  const slug = slugify(job?.title)

  if (!slug) {
    throw new Error(`Svaya Robotics could not normalize a stable job identifier for ${job?.title || 'an untitled role'}`)
  }

  const jobId = `${SOURCE}-${slug}`

  return {
    ...job,
    jobId,
    requisitionId: jobId,
  }
}

// Svaya Robotics' public openings are currently exposed on the Paninian/Svayatt first-party careers surface.
export const extractApplyEmail = baseExtractApplyEmail
export const hasOfficialHomepageSignal = baseHasOfficialHomepageSignal
export const hasVerifiedCareersLink = baseHasVerifiedCareersLink
export const hasOfficialCareersSignal = baseHasOfficialCareersSignal
export const hasVerifiedOpenPositionsLink = baseHasVerifiedOpenPositionsLink
export const hasOfficialOpenPositionsSignal = baseHasOfficialOpenPositionsSignal
export const isVerifiedMissingRoute = baseIsVerifiedMissingRoute
export const extractPublicJobs = (html) => baseExtractPublicJobs(html).map(remapJobIdentifiers)

export const isVerifiedHomepageAlias = ({ status, url, html }) =>
  status === 200
  && normalizeUrl(url) === HOMEPAGE_URL
  && hasOfficialHomepageSignal(html)
  && hasVerifiedCareersLink(html)

export const createSvayaRoboticsScraper = ({ now = () => new Date() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Svaya Robotics verified official homepage no longer matches the trusted first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Svaya Robotics homepage no longer links to the verified first-party careers landing page')
    }

    for (const aliasUrl of HOMEPAGE_ALIAS_URLS) {
      const aliasPage = await fetchPage(aliasUrl)

      if (!isVerifiedHomepageAlias(aliasPage)) {
        throw new Error('Svaya Robotics official company domain aliases changed materially')
      }
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Svaya Robotics verified first-party careers landing page no longer matches the trusted surface')
    }

    if (!hasVerifiedOpenPositionsLink(careersPage.html)) {
      throw new Error('Svaya Robotics careers landing page no longer links to the verified first-party open positions page')
    }

    if (extractApplyEmail(careersPage.html) !== SHARED_APPLY_EMAIL) {
      throw new Error('Svaya Robotics careers landing page no longer exposes the verified shared apply email')
    }

    const openPositionsPage = await fetchPage(OPEN_POSITIONS_URL)

    if (openPositionsPage.status !== 200 || !hasOfficialOpenPositionsSignal(openPositionsPage.html)) {
      throw new Error('Svaya Robotics verified open positions page no longer matches the trusted first-party surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('Svaya Robotics missing canonical careers routes changed materially')
      }
    }

    const scrapedAt = normalizeScrapedAt((overrideNow || now)())
    const jobs = extractPublicJobs(openPositionsPage.html)

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: OPEN_POSITIONS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
    }))
  },
})

export const run = async (options = {}) => createSvayaRoboticsScraper().run(options)

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
