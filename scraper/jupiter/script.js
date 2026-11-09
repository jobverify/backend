import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserNetworkFallback } from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { JUPITER_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = JUPITER_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOBS_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const CAREER_PORTAL_INFO_URL = PROVIDER_METADATA.careerPortalInfoUrl
export const ACTIVE_JOBS_URL = PROVIDER_METADATA.activeJobsUrl
export const EXPECTED_KEKA_DOMAIN = PROVIDER_METADATA.expectedKekaDomain
export const EXPECTED_IDENTIFIER = PROVIDER_METADATA.expectedIdentifier

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTags = (value) => normalizeOptionalValue(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toAbsoluteUrl = (value, baseUrl = CAREERS_PAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.result)) return payload.result
  return []
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const defaultFetchText = async (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = async (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

const normalizeDate = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const isIndiaLocation = (location = {}) => {
  const countryCode = String(location.countryCode ?? location.country?.code ?? '').toUpperCase()
  const countryName = normalizeOptionalValue(location.countryName ?? location.country?.name)
  return countryCode === 'IN' || countryName?.toLowerCase() === 'india'
}

const normalizeLocation = (location = {}) => {
  const name = normalizeOptionalValue(location.name)
  const city = normalizeOptionalValue(location.city)
  const state = normalizeOptionalValue(location.state)
  const country = normalizeOptionalValue(location.countryName) || 'India'
  const locationLabel = unique([name, city, state, country]).join(', ') || 'India'

  return {
    location: locationLabel,
    city,
    state,
    country,
  }
}

const normalizeEmploymentType = (value) => {
  if (value === 2 || value === '2') return 'Full-Time'
  return null
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Jupiter scraper')
  }

  return parsed.toISOString()
}

export const extractKekaBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const hrefAttribute = match[1]?.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
    const hrefValue = hrefAttribute?.[1] || hrefAttribute?.[2] || hrefAttribute?.[3] || null
    const href = toAbsoluteUrl(hrefValue, CAREERS_PAGE_URL)
    const text = normalizeWhitespace(match[2])?.toLowerCase() || ''

    if (href === JOBS_BOARD_URL) return href
    if (text === 'view all openings' && /jupiter\.keka\.com\/careers\/?$/i.test(href || '')) {
      return JOBS_BOARD_URL
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Trusted by 30 Lakh+ Indians')
    && normalized.includes('Join us as we improve financial wellness for millions')
    && normalized.includes('Explore open roles')
    && extractKekaBoardUrl(page) === JOBS_BOARD_URL
}

export const hasCareerPortalInfoSignal = (payload) => {
  const name = normalizeOptionalValue(payload?.name)
  const shortName = normalizeOptionalValue(payload?.shortName)
  const portalDomain = normalizeOptionalValue(payload?.careersPortalDomain)

  return (name === OFFICIAL_BRAND_NAME || shortName === OFFICIAL_BRAND_NAME)
    && portalDomain === 'jupiter.keka.com'
}

export const extractIndiaJobsFromActivePayload = (payload) =>
  unwrapList(payload)
    .map((job) => {
      const indiaLocation = (Array.isArray(job?.jobLocations) ? job.jobLocations : []).find(isIndiaLocation)
      const jobId = normalizeOptionalValue(job?.id)
      const title = normalizeOptionalValue(job?.title)
      if (!indiaLocation || !jobId || !title) return null

      const locationBits = normalizeLocation(indiaLocation)

      return {
        title,
        company: COMPANY,
        department: normalizeOptionalValue(job.departmentName),
        location: locationBits.location,
        city: locationBits.city,
        state: locationBits.state,
        country: locationBits.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: `${EXPECTED_KEKA_DOMAIN}jobdetails/${jobId}`,
        applyUrl: `${EXPECTED_KEKA_DOMAIN}applyjob/${jobId}`,
        employmentType: normalizeEmploymentType(job.jobType),
        experienceRequired: normalizeOptionalValue(job.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: Array.isArray(job.skillNames)
          ? job.skillNames.map(normalizeOptionalValue).filter(Boolean)
          : [],
        postingDate: normalizeDate(job.publishedOn),
        closingDate: null,
        jobDescription: stripTags(job.description),
        remoteStatus: null,
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftDate = left.postingDate || ''
      const rightDate = right.postingDate || ''
      if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
      return left.title.localeCompare(right.title)
    })

export const createJupiterScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchBrowserText,
    fetchBrowserJson,
    maxJobs: overrideMaxJobs,
    now: overrideNow,
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchJson,
      fetchBrowserText,
      fetchBrowserJson,
      userAgent: USER_AGENT,
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 12000,
        ignoreHTTPSErrors: false,
      },
    })

    try {
      let careersPageHtml
      try {
        careersPageHtml = await fetchText(CAREERS_PAGE_URL)
      } catch {
        careersPageHtml = await browserFallback.fetchTextInBrowser(CAREERS_PAGE_URL)
      }

      if (!hasOfficialCareersSignal(careersPageHtml)) {
        careersPageHtml = await browserFallback.fetchTextInBrowser(CAREERS_PAGE_URL)
      }

      if (!hasOfficialCareersSignal(careersPageHtml)) {
        throw new Error('Jupiter verified first-party careers page no longer matches the known handoff surface')
      }

      const [careerPortalInfo, activeJobsPayload] = await Promise.all([
        browserFallback.fetchJson(CAREER_PORTAL_INFO_URL),
        browserFallback.fetchJson(ACTIVE_JOBS_URL),
      ])

      if (!hasCareerPortalInfoSignal(careerPortalInfo)) {
        throw new Error('Jupiter verified Keka career portal info no longer matches the known public surface')
      }

      const jobs = extractIndiaJobsFromActivePayload(activeJobsPayload)
      const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
      const selectedJobs = limit ? jobs.slice(0, limit) : jobs
      const scrapedAt = normalizeScrapedAt((overrideNow || now)())

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt,
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createJupiterScraper().run(options)

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
