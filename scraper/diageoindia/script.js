import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { DIAGEO_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DIAGEO_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const INDIA_HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const INDIA_CAREERS_URL = PROVIDER_METADATA.indiaCareersUrl
export const INDIA_OPPORTUNITIES_URL = PROVIDER_METADATA.indiaOpportunitiesUrl
export const GLOBAL_SEARCH_AND_APPLY_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_BASE_URL = PROVIDER_METADATA.jobsApiUrl
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const resolveNowIso = (now = () => new Date().toISOString()) => {
  const value = typeof now === 'function' ? now() : now
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''

  if (normalized.includes('part')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return 'Full-time'
}

const normalizeLocation = (parts, country) => {
  const normalizedParts = Array.isArray(parts)
    ? parts.map((part) => normalizeWhitespace(part)).filter(Boolean)
    : []
  const normalizedCountry = normalizeWhitespace(country) || COUNTRY_FILTER
  const locationParts = [...normalizedParts]

  if (locationParts.length === 0) {
    return {
      location: normalizedCountry,
      city: null,
    }
  }

  if (locationParts.at(-1)?.toLowerCase() !== normalizedCountry.toLowerCase()) {
    locationParts.push(normalizedCountry)
  }

  return {
    location: locationParts.join(', '),
    city: normalizeCity(locationParts[0]) || null,
  }
}

const extractExperienceRequired = (jobDescription) => {
  const normalized = normalizeWhitespace(jobDescription)
  if (!normalized) return null

  const rangeMatch = normalized.match(/\b(\d+\s*-\s*\d+)\s+years?\b/i)
  if (rangeMatch) {
    return `${rangeMatch[1].replace(/\s*-\s*/g, ' - ')} Years`
  }

  const plusMatch = normalized.match(/\b(\d+\+)\s+years?\b/i)
  if (plusMatch) {
    return `${plusMatch[1]} Years`
  }

  return null
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const buildJobsApiUrl = ({
  page = 1,
  country = COUNTRY_FILTER,
} = {}) => {
  const url = new URL(JOBS_API_BASE_URL)
  url.searchParams.set('page', String(page))
  url.searchParams.set('country', country)
  return url.toString()
}

export const buildDetailPageUrl = (jobTitle, referenceId) => (
  `${GLOBAL_SEARCH_AND_APPLY_URL}/${slugify(jobTitle)}/${encodeURIComponent(String(referenceId))}`
)

export const hasIndiaHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return title === 'Discover Diageo India | Diageo India'
    && /href=["']\/en\/careers["']/i.test(page)
    && text.includes('Diageo India is among the country')
}

export const hasIndiaCareersHubSignal = (html = '') => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return title === 'Careers | Diageo India'
    && text.includes('Bring your passion, creativity, and determination')
    && /href=["']\/en\/careers\/opportunities-at-diageo["']/i.test(page)
    && /href=["']\/en\/careers\/life-at-diageo["']/i.test(page)
    && /href=["']\/en\/careers\/why-diageo["']/i.test(page)
}

export const hasIndiaOpportunitiesSignal = (html = '') => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return title === 'Opportunities at Diageo | Diageo India'
    && text.includes('Find your role at Diageo')
    && /linkedin\.com\/company\/diageo-india\/jobs/i.test(page)
}

export const hasGlobalSearchAndApplySignal = (html = '') => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return title === 'Search and Apply for Jobs With Us | Diageo'
    && /id="ip3-search-and-apply"/i.test(page)
    && /jobs-landing-api\.js/i.test(page)
    && /Job_Posting_Title/i.test(page)
    && text.includes('Search and apply for jobs with us directly through the search function above.')
}

const ensureValidJobsPayload = (payload = {}) => {
  const data = payload?.data
  const meta = payload?.meta

  if (!Array.isArray(data) || typeof meta !== 'object' || meta == null) {
    throw new Error('Diageo India jobs api payload no longer matches the verified public surface')
  }
}

export const extractPaginationSummary = (payload = {}) => {
  ensureValidJobsPayload(payload)

  return {
    currentPage: Number.parseInt(String(payload.meta.currentPage ?? 1), 10) || 1,
    nextPage: payload.meta.nextPage == null ? null : Number.parseInt(String(payload.meta.nextPage), 10),
    totalPages: Number.parseInt(String(payload.meta.totalPages ?? 1), 10) || 1,
    totalItems: Number.parseInt(String(payload.meta.totalItems ?? 0), 10) || 0,
  }
}

export const extractJobsFromPayload = (payload = {}) => {
  ensureValidJobsPayload(payload)

  return payload.data
    .filter((job) => normalizeWhitespace(job?.Country) === COUNTRY_FILTER)
    .filter((job) => String(job?.External_Posting ?? '') === '1')
    .filter((job) => normalizeWhitespace(job?.referenceID) && normalizeWhitespace(job?.Job_Posting_Title))
    .map((job) => {
      const title = normalizeWhitespace(job.Job_Posting_Title)
      const referenceId = normalizeWhitespace(job.referenceID)
      const jobDescription = stripTags(job.Job_Description)
      const { location, city } = normalizeLocation(job.Primary_Job_Posting_Location, job.Country)

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job.Job_Family)
          || normalizeWhitespace(job.Function_Subtype)
          || normalizeWhitespace(job.Job_Family_Group)
          || null,
        location,
        city,
        country: COUNTRY_FILTER,
        jobId: referenceId,
        requisitionId: referenceId,
        sourceUrl: buildDetailPageUrl(title, referenceId),
        applyUrl: normalizeWhitespace(job.External_Posting_URL) || buildDetailPageUrl(title, referenceId),
        employmentType: normalizeEmploymentType(job.Time_Type || job.Worker_type),
        experienceRequired: extractExperienceRequired(jobDescription),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job.Job_Posting_Start_Date)
          || normalizeWhitespace(job.Recruiting_Start_Date)
          || null,
        closingDate: null,
        jobDescription,
        remoteStatus: null,
      }
    })
}

export const createDiageoIndiaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    maxPages = 10,
  } = {}) {
    const homepageHtml = await fetchText(INDIA_HOMEPAGE_URL)
    if (!hasIndiaHomepageSignal(homepageHtml)) {
      throw new Error('Diageo India homepage no longer matches the verified official surface')
    }

    const careersHubHtml = await fetchText(INDIA_CAREERS_URL)
    if (!hasIndiaCareersHubSignal(careersHubHtml)) {
      throw new Error('Diageo India careers hub no longer matches the verified official surface')
    }

    const opportunitiesHtml = await fetchText(INDIA_OPPORTUNITIES_URL)
    if (!hasIndiaOpportunitiesSignal(opportunitiesHtml)) {
      throw new Error('Diageo India opportunities page no longer matches the verified official surface')
    }

    const searchAndApplyHtml = await fetchText(GLOBAL_SEARCH_AND_APPLY_URL)
    if (!hasGlobalSearchAndApplySignal(searchAndApplyHtml)) {
      throw new Error('Diageo India search-and-apply page no longer matches the verified public surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    const scrapedAt = resolveNowIso(now)

    for (let page = 1; page <= maxPages; page += 1) {
      const payload = await fetchJson(buildJobsApiUrl({ page }))
      const summary = extractPaginationSummary(payload)
      const pageJobs = extractJobsFromPayload(payload)

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
          scrapedAt,
        })
      }

      if (!summary.nextPage || page >= summary.totalPages) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createDiageoIndiaScraper().run(options)

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
