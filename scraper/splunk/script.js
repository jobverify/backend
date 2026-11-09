import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SPLUNK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = SPLUNK_CATALOG.source
export const COMPANY = SPLUNK_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SPLUNK_CATALOG.officialBrandName
export const CAREERS_ENTRY_URL = SPLUNK_CATALOG.companyCareerPage
export const CANONICAL_CAREERS_LANDING_URL = SPLUNK_CATALOG.canonicalCareersLandingUrl
export const SEARCH_PAGE_URL = SPLUNK_CATALOG.officialSearchPageUrl
export const INDIA_PAGE_URL = SPLUNK_CATALOG.indiaJobsPageUrl
export const VERIFIED_ON = SPLUNK_CATALOG.verifiedOn
export const PROVIDER_METADATA = SPLUNK_CATALOG

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractJsonBlock = (html = '', key, trailingKey) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedTrailingKey = trailingKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`"${escapedKey}"\\s*:\\s*(\\{[\\s\\S]*?\\})\\s*,\\s*"${escapedTrailingKey}"\\s*:`),
  )

  if (!match?.[1]) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const getAggregationValue = (state, field) =>
  state?.data?.aggregations?.find((item) => item?.field === field)?.value ?? null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  return normalizeWhitespace(value)
}

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /^india$/i.test(normalized) ? 'India' : normalized
}

const extractLocationCandidates = (job = {}) => {
  const values = [
    job.location,
    job.cityStateCountry,
    job.cityState,
    job.address,
    ...(Array.isArray(job.multi_location) ? job.multi_location : []),
    ...(Array.isArray(job.multi_location_array)
      ? job.multi_location_array.map((item) => item?.location)
      : []),
  ]

  return [...new Set(
    values
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean),
  )]
}

const extractPrimaryLocation = (job = {}) => {
  const locations = extractLocationCandidates(job)
  return locations[0] || null
}

const extractCityFromLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalizeWhitespace(normalized.split(',')[0])
}

const extractRequiredSkills = (job = {}) => [...new Set(
  (Array.isArray(job?.ml_skills) ? job.ml_skills : [])
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean),
)]

export const buildCiscoJobDetailUrl = ({ jobId, title } = {}) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  if (!normalizedJobId) return null

  const normalizedTitle = normalizeWhitespace(title) || normalizedJobId
  const slug = normalizedTitle
    .normalize('NFKC')
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug
    ? `https://careers.cisco.com/global/en/job/${encodeURIComponent(normalizedJobId)}/${encodeURIComponent(slug)}`
    : `https://careers.cisco.com/global/en/job/${encodeURIComponent(normalizedJobId)}`
}

const isIndiaJob = (job = {}) => {
  if (normalizeCountry(job?.country) === 'India') return true
  return extractLocationCandidates(job).some((value) => /\bIndia\b/i.test(value))
}

export const extractRefineSearchState = (html = '') =>
  extractJsonBlock(html, 'eagerLoadRefineSearch', 'jobwidgetsettings')

export const hasLegacyCareersEntrySignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Working at Splunk - Cisco Careers\s*<\/title>/i.test(page)
    && /build a more resilient digital world with us/i.test(normalized)
    && page.includes(CANONICAL_CAREERS_LANDING_URL)
    && page.includes(SEARCH_PAGE_URL)
  }

export const hasSearchPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Splunk Job Openings - Cisco Careers\s*<\/title>/i.test(page)
    && (page.includes('"rk":"l-splunk-search-page"') || page.includes('data-rk="l-splunk-search-page"'))
    && page.includes('"query":"(title.title_phenom:(\\"Splunk\\"))"')
    && page.includes('data-widget-type="phw-search-results"')
  }

export const hasIndiaPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Splunk India Jobs - Cisco Careers\s*<\/title>/i.test(page)
    && (page.includes('"rk":"l-splunkindia"') || page.includes('data-rk="l-splunkindia"'))
    && page.includes('"query":"(title.title_phenom:(\\"Splunk\\") AND country.country_sort:(\\"India\\"))"')
    && page.includes('data-widget-type="phw-search-results"')
  }

export const searchPageShowsLiveGlobalResults = (state = {}) => {
  const countryAggregation = getAggregationValue(state, 'country') || {}
  const totalHits = Number(state?.totalHits ?? -1)
  const jobs = Array.isArray(state?.data?.jobs) ? state.data.jobs : []
  const query = String(state?.eid?.query ?? '')

  return totalHits > 0
    && jobs.length > 0
    && Number(countryAggregation.India ?? 0) > 0
    && /title\.title_phenom:\("Splunk"\)/i.test(query)
}

export const indiaPageShowsLiveIndiaResults = (state = {}) => {
  const countryAggregation = getAggregationValue(state, 'country') || {}
  const totalHits = Number(state?.totalHits ?? -1)
  const jobs = Array.isArray(state?.data?.jobs) ? state.data.jobs : []
  const selectedCountries = state?.data?.ui_selections?.country || []
  const query = String(state?.eid?.query ?? '')

  return totalHits > 0
    && jobs.length > 0
    && Number(countryAggregation.India ?? 0) >= jobs.length
    && Array.isArray(selectedCountries)
    && selectedCountries.length === 1
    && selectedCountries[0] === 'India'
    && jobs.every((job) => isIndiaJob(job))
    && /country\.country_sort:\("India"\)/i.test(query)
}

export const extractIndiaJobs = (state = {}) => {
  const jobs = Array.isArray(state?.data?.jobs) ? state.data.jobs : []

  return jobs
    .filter((job) => isIndiaJob(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const requisitionId = normalizeWhitespace(job?.reqId || job?.jobId || job?.jobSeqNo)
      const location = extractPrimaryLocation(job)
      const sourceUrl = buildCiscoJobDetailUrl({ jobId: requisitionId, title })
        || normalizeWhitespace(job?.applyUrl)
      const applyUrl = normalizeWhitespace(job?.applyUrl) || sourceUrl
      const jobDescription = normalizeWhitespace(
        job?.ml_job_parser?.descriptionTeaser_ats
        || job?.ml_job_parser?.descriptionTeaser_first200
        || job?.descriptionTeaser,
      )

      if (!title || !requisitionId || !location || !sourceUrl) return null

      const jobEntry = {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.department) || normalizeWhitespace(job?.category),
        location,
        city: normalizeWhitespace(job?.city) || extractCityFromLocation(location),
        country: 'India',
        jobId: requisitionId,
        requisitionId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractRequiredSkills(job),
        postingDate: normalizeWhitespace(job?.postedDate || job?.dateCreated)?.slice(0, 10) || null,
        closingDate: null,
        jobDescription,
      }

      const locations = extractLocationCandidates(job)
      if (locations.length > 0) {
        jobEntry.locations = locations
      }

      return jobEntry
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createSplunkScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const entryHtml = await fetchText(CAREERS_ENTRY_URL)
    if (!hasLegacyCareersEntrySignal(entryHtml)) {
      throw new Error('Verified Splunk first-party careers entry no longer matches the trusted public surface')
    }

    const searchHtml = await fetchText(SEARCH_PAGE_URL)
    if (!hasSearchPageSignal(searchHtml)) {
      throw new Error('Verified Splunk Cisco search page no longer matches the trusted public surface')
    }

    const searchState = extractRefineSearchState(searchHtml)
    if (!searchPageShowsLiveGlobalResults(searchState)) {
      throw new Error('Verified Splunk global search payload changed materially')
    }

    const indiaHtml = await fetchText(INDIA_PAGE_URL)
    if (!hasIndiaPageSignal(indiaHtml)) {
      throw new Error('Verified Splunk India page no longer matches the trusted public surface')
    }

    const indiaState = extractRefineSearchState(indiaHtml)
    if (!indiaPageShowsLiveIndiaResults(indiaState)) {
      throw new Error('Verified Splunk India results changed materially')
    }

    const jobs = extractIndiaJobs(indiaState)
    if (!jobs.length) {
      throw new Error('Verified Splunk India results changed materially')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSplunkScraper().run(options)

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
