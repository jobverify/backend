import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inferWorkdayJobsApiConfig, runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'spheraindia'
export const COMPANY = 'Sphera India'
export const CAREERS_URL = 'https://sphera.com/company/join-our-team/'
export const WORKDAY_BOARD_URL = 'https://sphera.wd1.myworkdayjobs.com/careers'
export const INDIA_LOCATION_COUNTRY_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const EXPECTED_HEADLINE = 'Come work with us!'
export const EXPECTED_COPY = 'Worldwide opportunities'
export const EXPECTED_CTA = 'See all jobs'
export const EXPECTED_CATEGORY_PREFIX = 'See jobs in'

const SCRAPER_DIR = path.resolve(currentDir, '../spheraindia')

const normalizeText = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (html = '') => String(html)
  .replace(/<(?:br|\/p|\/div|\/li|\/section|\/article|\/main|\/header|\/footer|\/h[1-6])[^>]*>/gi, '\n')
  .split('\n')
  .map(normalizeText)
  .filter(Boolean)

const extractAnchors = (html = '') => Array.from(
  String(html).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, innerHtml]) => ({
    href,
    label: normalizeText(innerHtml),
  }),
)

const dedupe = (values) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

const toComparableUrl = (value) => String(value || '').replace(/\/+$/, '')

const resolveSafeUrl = (href, baseUrl) => {
  try {
    const url = new URL(href, baseUrl)
    return /^https?:$/i.test(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const matchesExpectedBoardUrl = (candidateUrl, workdayBoardUrl) =>
  toComparableUrl(candidateUrl) === toComparableUrl(workdayBoardUrl)

const isSameWorkdayHost = (candidateUrl, workdayBoardUrl) => {
  try {
    return new URL(candidateUrl).origin === new URL(workdayBoardUrl).origin
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayBoardUrl = (
  html = '',
  {
    careersUrl = CAREERS_URL,
    workdayBoardUrl = WORKDAY_BOARD_URL,
  } = {},
) => {
  const seeAllJobsLink = extractAnchors(html).find(({ label }) => (
    String(label || '').toLowerCase() === EXPECTED_CTA.toLowerCase()
  ))
  if (!seeAllJobsLink) return null

  const resolvedUrl = resolveSafeUrl(seeAllJobsLink.href, careersUrl)
  if (!resolvedUrl || !matchesExpectedBoardUrl(resolvedUrl, workdayBoardUrl)) {
    return null
  }

  return workdayBoardUrl
}

export const extractVerifiedWorkdayCategoryLinks = (
  html = '',
  {
    careersUrl = CAREERS_URL,
    workdayBoardUrl = WORKDAY_BOARD_URL,
  } = {},
) => dedupe(
  extractAnchors(html)
    .filter(({ label }) => new RegExp(`^${EXPECTED_CATEGORY_PREFIX}\\b`, 'i').test(label || ''))
    .map(({ href }) => resolveSafeUrl(href, careersUrl))
    .filter((url) => url && isSameWorkdayHost(url, workdayBoardUrl)),
)

export const hasOfficialCareersSignal = (
  html = '',
  options = {},
) => {
  const lines = htmlToLines(html)
  const boardUrl = extractVerifiedWorkdayBoardUrl(html, options)
  const categoryLinks = extractVerifiedWorkdayCategoryLinks(html, options)

  return lines.some((line) => line.toLowerCase() === EXPECTED_HEADLINE.toLowerCase())
    && lines.some((line) => line.toLowerCase() === EXPECTED_COPY.toLowerCase())
    && boardUrl === (options.workdayBoardUrl || WORKDAY_BOARD_URL)
    && categoryLinks.length > 0
}

const fetchText = async (url, fetchImpl) => {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response?.ok) {
    throw new Error(`HTTP ${response?.status ?? 'unknown'} for ${url}`)
  }

  return response.text()
}

const withInjectedGlobalFetch = async (fetchImpl, callback) => {
  if (typeof fetchImpl !== 'function' || fetchImpl === globalThis.fetch) {
    return callback()
  }

  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl

  try {
    return await callback()
  } finally {
    globalThis.fetch = originalFetch
  }
}

const normalizeCity = (city, location) => {
  const candidate = normalizeText(city || location)
  if (!candidate || /^india$/i.test(candidate)) return null
  if (/^(?:india offsite|remote)\b/i.test(candidate)) return 'Remote'

  const withoutIndiaSuffix = normalizeText(candidate.replace(/,\s*India$/i, ''))
  return withoutIndiaSuffix || null
}

const normalizeWorkdayJob = (job = {}) => ({
  ...job,
  company: job.company || COMPANY,
  source: job.source || SOURCE,
  country: job.country || 'India',
  city: normalizeCity(job.city, job.location),
  sourceUrl: job.sourceUrl || job.link,
  applyUrl: job.applyUrl || job.link,
  requisitionId: job.requisitionId || job.jobId || null,
})

export const createSpheraIndiaScraper = ({
  careersUrl = CAREERS_URL,
  workdayBoardUrl = WORKDAY_BOARD_URL,
  locationCountry = INDIA_LOCATION_COUNTRY_ID,
  company = COMPANY,
  source = SOURCE,
  scraperDir = SCRAPER_DIR,
} = {}) => ({
  async run({
    fetchImpl = globalThis.fetch,
    requestTimeoutMs,
    retryBaseDelayMs,
  } = {}) {
    const resolvedFetch = fetchImpl || globalThis.fetch
    if (typeof resolvedFetch !== 'function') {
      throw new Error(`[${source}] fetch implementation is required`)
    }

    const careersHtml = await fetchText(careersUrl, resolvedFetch)
    if (!hasOfficialCareersSignal(careersHtml, { careersUrl, workdayBoardUrl })) {
      return []
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(careersHtml, {
      careersUrl,
      workdayBoardUrl,
    })
    if (!verifiedBoardUrl) return []

    const jobs = await withInjectedGlobalFetch(resolvedFetch, () => runWorkdayScraper({
      company,
      baseUrl: verifiedBoardUrl,
      locationCountry,
      source,
      scraperDir,
      requestTimeoutMs,
      retryBaseDelayMs,
    }))

    const decorated = jobs.map(normalizeWorkdayJob)
    const inventory = readInventoryEvidence(jobs)
    if (!inventory || inventory.surface !== inferWorkdayJobsApiConfig(verifiedBoardUrl)?.jobsApiUrl
      || jobs.some(job => job?.source !== source || job?.company !== company)) return decorated
    // These are returned role observations, not the reported parent-board total.
    attachSourceObservationEvidence(decorated, {
      source: source, recordKind: 'vacancy-rows',
      observedRecordCount: jobs.length, observedVacancyCount: jobs.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
    })
    return attachInventoryEvidence(decorated, {
      ...inventory,
      status: ['unverified', 'discovery-only', 'coverage-gap'].includes(inventory.status) ? inventory.status : 'coverage-gap',
      listingComplete: false, reportedTotal: null, indiaFacetCount: null,
      reason: 'The shared Workday board does not establish exact company or India inventory completeness.'
        + (inventory.reason ? ' Board diagnostic: ' + inventory.reason : ''),
    })
  },
})

export const run = (options) => createSpheraIndiaScraper().run(options)
