import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { AKER_SOLUTIONS_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = AKER_SOLUTIONS_INDIA_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_HOME_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_SEARCH_URL = PROVIDER_METADATA.jobSearchUrl
export const VERIFIED_INDIA_JOB_URL = PROVIDER_METADATA.verifiedIndiaJobUrl
export const SUCCESSFACTORS_HOST = PROVIDER_METADATA.successFactorsApplyHost
export const SUCCESSFACTORS_COMPANY_TOKEN = PROVIDER_METADATA.successFactorsCompanyToken
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value, baseUrl = CAREERS_HOME_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const extractJsonArray = (html, pattern) => {
  const match = String(html ?? '').match(pattern)
  if (!match?.[1]) return []

  try {
    return JSON.parse(`[${match[1]}]`)
  } catch {
    return []
  }
}

const decodeJsonStringLiteral = (value) => {
  if (!value) return null

  return String(value)
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0027/gi, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
}

const extractBetweenLabels = (text, startLabel, endLabel) => {
  const pattern = new RegExp(
    `${escapeRegex(startLabel)}\\s*([\\s\\S]*?)\\s*${escapeRegex(endLabel)}`,
    'i',
  )
  return normalizeWhitespace(String(text ?? '').match(pattern)?.[1])
}

const extractJobIdFromUrl = (value) =>
  String(value ?? '').match(/[?&]jobPostId=(\d+)/i)?.[1] || null

const extractVacancyCount = (html) => {
  const textMatch = String(html ?? '').match(/\b(\d+)\s+Vacancies\b/i)
  if (textMatch?.[1]) return Number.parseInt(textMatch[1], 10)

  const jsonMatch = String(html ?? '').match(/"title":"Vacancies","number":"(\d+)"/i)
  if (jsonMatch?.[1]) return Number.parseInt(jsonMatch[1], 10)

  return null
}

export const extractJobSearchUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]+href="([^"]+)"/gi)) {
    const url = toAbsoluteUrl(match[1], CAREERS_HOME_URL)
    if (url === JOB_SEARCH_URL) return url
  }

  return null
}

export const hasOfficialCareersLandingSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Careers | Aker Solutions'
    && extractJobSearchUrl(page) === JOB_SEARCH_URL
    && /See all available jobs/i.test(normalized)
    && /\bVacancies\b/i.test(normalized)
}

export const extractJobListPayload = (html) => {
  const page = String(html ?? '')

  return {
    jobs: extractJsonArray(page, /"jobs":\[(.*?)\],"placeholderList":/s),
    filters: extractJsonArray(page, /"filters":\[(.*?)\],"showMoreHitsLabel":/s),
    loadMoreJobsText: normalizeWhitespace(page.match(/"loadMoreJobsText":"([^"]*)"/i)?.[1]),
    vacancyCount: extractVacancyCount(page),
  }
}

export const hasOfficialJobSearchSignal = (html) => {
  const page = String(html ?? '')
  const title = extractTitle(page)
  const payload = extractJobListPayload(page)
  const filterLabels = payload.filters.map((filter) => normalizeWhitespace(filter?.label)).filter(Boolean)

  return title === 'Job Search at Aker Solutions. Find all available positions and job banks here | Aker Solutions'
    && payload.jobs.length > 0
    && payload.loadMoreJobsText === 'Load more'
    && payload.vacancyCount != null
    && filterLabels.includes('Country')
    && filterLabels.includes('Location')
    && filterLabels.includes('Position type')
}

const isIndiaListing = (listing = {}) =>
  normalizeWhitespace(listing.country)?.toLowerCase() === COUNTRY_FILTER.toLowerCase()

export const extractListingJobs = (html) =>
  extractJobListPayload(html).jobs
    .filter(isIndiaListing)
    .map((listing) => {
      const sourceUrl = toAbsoluteUrl(listing?.title?.href, JOB_SEARCH_URL)
      const jobId = extractJobIdFromUrl(sourceUrl)
      const city = normalizeWhitespace(listing.location)

      return {
        title: normalizeWhitespace(listing?.title?.linkText),
        location: city ? `${city}, ${COUNTRY_FILTER}` : COUNTRY_FILTER,
        city,
        country: COUNTRY_FILTER,
        region: normalizeWhitespace(listing.region),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: null,
        employmentType: normalizeWhitespace(listing.positionType),
        postingDate: null,
        closingDate: normalizeWhitespace(listing.deadline),
        department: null,
        jobDescription: null,
      }
    })
    .filter((listing) => listing.title && listing.jobId && listing.sourceUrl)

export const extractApplyUrl = (html) => {
  const urls = [...String(html ?? '').matchAll(/https?:\/\/[^"'\\\s]+\/sfcareer\/jobreqcareer\?jobId=\d+(?:&amp;|&)company=[^"'\\\s]+/gi)]
    .map((match) => normalizeWhitespace(match[0]))
    .filter(Boolean)

  return urls.find((url) =>
    url.startsWith(`${SUCCESSFACTORS_HOST}/sfcareer/jobreqcareer?`)
    && url.includes(`company=${SUCCESSFACTORS_COMPANY_TOKEN}`)) || null
}

const extractRichTextHtml = (html) =>
  [...String(html ?? '').matchAll(/"html":"((?:\\.|[^"])*)","blockName":"RichText"/g)]
    .map((match) => decodeJsonStringLiteral(match[1]))
    .filter(Boolean)
    .join('\n')

const hasOnlyVerifiedApplyHandoff = (html) => {
  const urls = [...String(html ?? '').matchAll(/https?:\/\/[^"'\\\s]+\/sfcareer\/jobreqcareer\?jobId=\d+(?:&amp;|&)company=[^"'\\\s]+/gi)]
    .map((match) => normalizeWhitespace(match[0]))
    .filter(Boolean)
  const verifiedApplyUrl = extractApplyUrl(html)

  return Boolean(verifiedApplyUrl)
    && urls.length > 0
    && urls.every((url) => url === verifiedApplyUrl)
}

export const hasOfficialJobDetailSignal = (html, expectedJobId = null) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const applyUrl = extractApplyUrl(page)

  return extractTitle(page)?.endsWith('| Aker Solutions')
    && normalized.includes('Location:')
    && normalized.includes('Apply by:')
    && normalized.includes('Position type:')
    && normalized.includes('Job ID #:')
    && Boolean(applyUrl)
    && hasOnlyVerifiedApplyHandoff(page)
    && (!expectedJobId || normalized.includes(`Job ID #: ${expectedJobId}`))
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const rawTitle = extractTitle(page) || listing.title || ''
  const title = normalizeWhitespace(rawTitle.replace(/\s*\|\s*Aker Solutions\s*$/i, '')) || listing.title
  const location = extractBetweenLabels(normalized, 'Location:', 'Apply by:') || listing.location
  const closingDate = extractBetweenLabels(normalized, 'Apply by:', 'Position type:') || listing.closingDate
  const employmentType =
    extractBetweenLabels(normalized, 'Position type:', 'Job ID #:') || listing.employmentType
  const jobId = normalizeWhitespace(
    extractBetweenLabels(normalized, 'Job ID #:', 'Apply')?.match(/\d+/)?.[0],
  ) || listing.jobId
  const jobDescription = normalizeWhitespace(extractRichTextHtml(page)) || listing.jobDescription

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location,
    city: normalizeWhitespace(location?.split(',')[0]),
    country: COUNTRY_FILTER,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    sourceUrl: listing.sourceUrl || VERIFIED_INDIA_JOB_URL,
    applyUrl: extractApplyUrl(page),
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate,
    jobDescription,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAkerSolutionsIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const now = options.now || (() => new Date().toISOString())

    const careersLandingHtml = await fetchText(CAREERS_HOME_URL)
    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error(
        'Aker Solutions India verified careers landing no longer matches the trusted public surface',
      )
    }

    if (extractJobSearchUrl(careersLandingHtml) !== JOB_SEARCH_URL) {
      throw new Error(
        'Aker Solutions India verified careers landing no longer points to the known job-search route',
      )
    }

    const listingHtml = await fetchText(JOB_SEARCH_URL)
    if (!hasOfficialJobSearchSignal(listingHtml)) {
      throw new Error(
        'Aker Solutions India verified public job-search surface no longer matches the trusted public surface',
      )
    }

    const listings = extractListingJobs(listingHtml)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      detailHtmlByUrl[listing.sourceUrl] = await fetchText(listing.sourceUrl)
    }))

    return selectedListings.map((listing) => {
      const detailHtml = detailHtmlByUrl[listing.sourceUrl]
      if (!hasOfficialJobDetailSignal(detailHtml, listing.jobId)) {
        throw new Error(
          'Aker Solutions India verified detail apply handoff no longer matches the trusted public surface',
        )
      }

      const job = extractJobDetail(detailHtml, listing)

      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }
    })
  },
})

export const run = async (options = {}) => createAkerSolutionsIndiaScraper().run(options)

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
