import path from 'node:path'
import { fileURLToPath } from 'node:url'

import REPLICON_CATALOG from './catalog.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = REPLICON_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECT_CAREERS_URL = PROVIDER_METADATA.redirectCareersUrl
export const SEARCH_PAGE_URL = PROVIDER_METADATA.genericSearchJobsUrl
export const SEARCH_API_URL = PROVIDER_METADATA.searchApiUrl
export const DEFAULT_COMPANY_QUERY_VALUE = PROVIDER_METADATA.searchApiCompanyName
export const PAGE_SIZE = 20

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeComparableUrl = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return normalized.replace(/\/$/, '')
  }
}

const extractTitle = (html = '') =>
  normalizeString(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const normalizePageText = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeCountry = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null

  const uppercase = normalized.toUpperCase()
  if (uppercase === 'IN' || uppercase === 'IND' || uppercase === 'INDIA') return 'India'

  return normalized
}

const joinLocation = ({ city, state, country }) =>
  [city, state, country].filter(Boolean).join(', ') || null

const slugify = (value) => normalizeString(value)
  ?.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

export const inferExperienceFromDescription = (description) => {
  const normalizedDescription = normalizePageText(description)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeString(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const extractSearchJobsUrl = (html = '', baseUrl = REDIRECT_CAREERS_URL) => {
  for (const match of String(html).matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const text = normalizePageText(match[2])
    if (!/^(?:Search Jobs|Apply Now)$/i.test(text || '')) continue

    try {
      return new URL(match[1], baseUrl).toString()
    } catch {
      continue
    }
  }

  return null
}

export const extractSearchApiCompanyName = (html = '') => {
  for (const pattern of [
    /\borg_id\s*:\s*"(companies\/[^"]+)"/i,
    /"org"\s*:\s*"(companies\\\/[^"]+)"/i,
  ]) {
    const match = String(html).match(pattern)
    const extracted = normalizeString(match?.[1])?.replace(/\\\//g, '/')
    if (extracted) return extracted
  }

  return null
}

export const buildDetailUrl = ({ jobId, slug }) => {
  if (!jobId || !slug) return null
  return new URL(`job/${encodeURIComponent(jobId)}/${encodeURIComponent(slug)}/`, SEARCH_PAGE_URL).toString()
}

export const buildSearchUrl = ({
  companyQueryValue = DEFAULT_COMPANY_QUERY_VALUE,
  pageToken = null,
  limit = PAGE_SIZE,
} = {}) => {
  if (!companyQueryValue) {
    throw new Error('Replicon search API company identifier is required')
  }

  const url = new URL(SEARCH_API_URL)
  url.searchParams.set('CompanyName', companyQueryValue)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('sortfield', 'open_date')
  url.searchParams.set('sortorder', 'descending')

  if (pageToken) url.searchParams.set('pageToken', pageToken)

  return url.toString()
}

export const hasRedirectedDeltekCareersSignal = (page = {}) => {
  const finalUrl = normalizeComparableUrl(page?.url)
  const title = extractTitle(page?.html)
  const normalized = normalizePageText(page?.html)
  const searchJobsUrl = extractSearchJobsUrl(page?.html, page?.url || REDIRECT_CAREERS_URL)

  return page?.status === 200
    && finalUrl === normalizeComparableUrl(REDIRECT_CAREERS_URL)
    && /Drive Your Career with #TeamDeltek \| Search Jobs \| Deltek/i.test(title || '')
    && normalized.includes('Drive Your Career with #TeamDeltek')
    && normalized.includes('Replicon')
    && normalizeComparableUrl(searchJobsUrl) === normalizeComparableUrl(SEARCH_PAGE_URL)
}

export const hasDeltekSearchPageSignal = (page = {}) => {
  const finalUrl = normalizeComparableUrl(page?.url)
  const title = extractTitle(page?.html)
  const normalized = normalizePageText(page?.html)
  const companyQueryValue = extractSearchApiCompanyName(page?.html)

  return page?.status === 200
    && finalUrl === normalizeComparableUrl(SEARCH_PAGE_URL)
    && /Find Open Job Opportunities Near You/i.test(title || '')
    && /^companies\//i.test(companyQueryValue || '')
    && normalized.includes('Job Search Results')
    && normalized.includes('India (')
}

const extractSlugFromUrl = (value) => {
  const match = normalizeString(value)?.match(/\/job\/[^/]+\/([^/]+)\/?$/i)
  return match?.[1] || null
}

const buildFallbackSlug = (job = {}) => {
  const slugParts = [
    slugify(job.title),
    slugify(job.primary_city || job.google_locations?.[0]?.city),
    slugify(job.primary_state || job.google_locations?.[0]?.state),
  ].filter(Boolean)

  return slugParts.length > 0 ? slugParts.join('-') : null
}

const normalizeListing = (entry = {}) => {
  const job = entry?.job || {}
  const jobId = normalizeString(job.id)
  const title = normalizeString(job.title)
  const city = normalizeString(job.primary_city || job.google_locations?.[0]?.city)
  const state = normalizeString(job.primary_state || job.google_locations?.[0]?.state)
  const country = normalizeCountry(job.primary_country || job.google_locations?.[0]?.country)
  const location = joinLocation({ city, state, country })
  const slug = extractSlugFromUrl(job.url) || buildFallbackSlug(job)
  const sourceUrl = normalizeString(job.url) || buildDetailUrl({ jobId, slug })
  const applyUrl = normalizeString(job.seo_url) || sourceUrl
  const jobDescription = normalizeString(job.description) || normalizeString(entry?.summary?.job_summary)

  if (!jobId || !title || !location || !sourceUrl || !applyUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeString(job.primary_category || job.department),
    location,
    city,
    state,
    country,
    locations: [
      normalizeString(job.primary_address),
      normalizeString(job.location_type),
      ...((Array.isArray(job.google_locations) ? job.google_locations : [])
        .map((item) => normalizeString(item?.address))),
    ].filter(Boolean),
    jobId,
    requisitionId: normalizeString(job.ref) || jobId,
    sourceUrl,
    applyUrl,
    employmentType: normalizeString(job.employment_type),
    experienceRequired: inferExperienceFromDescription(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeString(job.open_date),
    closingDate: normalizeString(job.close_date),
    jobDescription,
    publicExperienceChecked: Boolean(jobDescription),
  }
}

export const extractSearchSummary = (payload = {}) => ({
  totalJobCount: Number.isFinite(payload?.totalHits) ? payload.totalHits : null,
  nextPageToken: normalizeString(payload?.nextPageToken),
  pageSize: Array.isArray(payload?.searchResults) ? payload.searchResults.length : 0,
})

export const extractSearchResults = (payload = {}) =>
  filterIndiaJobs(
    (Array.isArray(payload?.searchResults) ? payload.searchResults : [])
      .map(normalizeListing)
      .filter(Boolean),
  ).map(({ locations, ...job }) => job)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  },
  label: 'replicon',
  timeoutMs: 15000,
})

export const createRepliconScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (!hasRedirectedDeltekCareersSignal(careersPage)) {
      throw new Error('Replicon careers redirect no longer matches the verified Deltek careers handoff')
    }

    const searchPageUrl = extractSearchJobsUrl(careersPage.html, careersPage.url || REDIRECT_CAREERS_URL)
    if (normalizeComparableUrl(searchPageUrl) !== normalizeComparableUrl(SEARCH_PAGE_URL)) {
      throw new Error('Replicon careers redirect no longer points to the verified Deltek jobs surface')
    }

    const searchPage = await fetchPage(searchPageUrl)
    if (!hasDeltekSearchPageSignal(searchPage)) {
      throw new Error('Replicon Deltek jobs surface no longer matches the verified public search page')
    }

    const companyQueryValue = extractSearchApiCompanyName(searchPage.html)
    if (!companyQueryValue) {
      throw new Error('Replicon Deltek jobs surface no longer exposes a public company search identifier')
    }

    const jobs = []
    const seenJobIds = new Set()
    let pageToken = null

    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ companyQueryValue, pageToken }))
      const listings = extractSearchResults(payload)
      const summary = extractSearchSummary(payload)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        jobs.push({
          ...listing,
          source: SOURCE,
          link: listing.applyUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      if (!summary.nextPageToken || summary.pageSize === 0) break
      pageToken = summary.nextPageToken
    }

    return jobs
  },
})

export const run = async (options = {}) => createRepliconScraper().run(options)

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
