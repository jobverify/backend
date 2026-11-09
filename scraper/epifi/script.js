import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import EPIFI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EPIFI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const RESOLVED_HOMEPAGE_URL = PROVIDER_METADATA.resolvedHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEVER_BOARD_URL = PROVIDER_METADATA.officialLeverBoardUrl
export const LEVER_API_URL = PROVIDER_METADATA.leverApiUrl
export const VERIFIED_INDIA_COUNTRY_CODE = PROVIDER_METADATA.verifiedIndiaCountryCode

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&'),
)?.toLowerCase() || ''

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

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
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_JSON_HEADERS,
  label: SOURCE,
})

const extractCity = (location) => {
  const firstSegment = normalizeWhitespace(location)?.split(/\s*,\s*/)[0] || null
  return firstSegment ? (normalizeCity(firstSegment) || firstSegment) : null
}

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const buildIndiaLocation = (rawLocation) => {
  const city = extractCity(rawLocation)
  if (city) return `${city}, India`

  const normalized = normalizeWhitespace(rawLocation)
  if (normalized && /india/i.test(normalized)) return normalized

  return 'India'
}

const isIndiaJob = (job = {}) => {
  const country = normalizeWhitespace(job?.country)?.toUpperCase()
  const locations = [
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]

  return country === VERIFIED_INDIA_COUNTRY_CODE
    || locations.some((location) => /(?:^|[\s,-])india\b/i.test(normalizeWhitespace(location) || ''))
}

const extractJobDescription = (job = {}) => normalizeWhitespace(
  stripHtml(
    job?.descriptionPlain
      || job?.descriptionBodyPlain
      || job?.descriptionBody
      || job?.description
      || job?.openingPlain
      || job?.opening
      || job?.additionalPlain
      || job?.additional,
  ),
)

export const buildPublicJobUrl = (jobId) =>
  `https://jobs.lever.co/epifi/${encodeURIComponent(String(jobId ?? ''))}`

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Fi Money(?:\s*[\u2013-]\s*|\s*-\s*)Savings Account, Credit Cards &amp; Loans App\s*<\/title>/i.test(page)
    && text.includes('one app for all things money')
    && text.includes('loved by 35 lakh+ indians')
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Fi Money \| Careers \| Join us to build the future of fintech\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/fi\.money\/careers["']/i.test(page)
    && />\s*VIEW OPEN ROLES\s*</i.test(page)
    && text.includes('help banking time travel')
    && text.includes("our creed isn't relentless disruption")
}

export const extractLeverBoardUrl = (html = '') => {
  const match = String(html ?? '').match(/href=["'](https:\/\/jobs\.lever\.co\/epifi\/?)["']/i)
  return match?.[1] ? match[1].replace(/\/$/, '') : null
}

export const hasOfficialLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const hasLeverFooterBranding =
    text.includes('jobs powered by')
    && /alt=["']Lever logo["']|lever-logo-/i.test(page)

  return text.includes('location type')
    && text.includes('location')
    && text.includes('team')
    && text.includes('work type')
    && hasLeverFooterBranding
    && /https:\/\/jobs\.lever\.co\/epifi\/[a-z0-9-]+/i.test(page)
}

export const extractIndiaLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Epifi Lever postings payload no longer returns an array')
  }

  return leverJobs
    .filter((job) => isIndiaJob(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const city = extractCity(location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl) || buildPublicJobUrl(job?.id)
      const id = normalizeWhitespace(job?.id)

      if (!title || !id || !sourceUrl || !city) {
        throw new Error('Epifi Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location: buildIndiaLocation(location),
        city,
        country: 'India',
        jobId: id,
        requisitionId: id,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: extractJobDescription(job),
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
    .sort((left, right) => String(right.postingDate || '').localeCompare(String(left.postingDate || '')))
}

export const createEpifiScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, RESOLVED_HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Epifi verified official homepage redirect changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Epifi verified official careers surface changed materially')
    }

    const leverBoardUrl = extractLeverBoardUrl(careersPage.html)
    if (!sameUrl(leverBoardUrl, LEVER_BOARD_URL)) {
      throw new Error('Epifi verified public Lever board handoff changed materially')
    }

    const leverBoardPage = await fetchPage(LEVER_BOARD_URL)
    if (
      leverBoardPage.status !== 200
      || !sameUrl(leverBoardPage.url, LEVER_BOARD_URL)
      || !hasOfficialLeverBoardSignal(leverBoardPage.html)
    ) {
      throw new Error('Epifi verified public Lever board changed materially')
    }

    const scrapedAt = now()

    return extractIndiaLeverJobs(await fetchJson(LEVER_API_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createEpifiScraper(options).run(options)

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
