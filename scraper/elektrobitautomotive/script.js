import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { hasNativeIndiaCountry, projectElektrobitNativeQuality } from './nativeQuality20261108.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.elektrobit.com/careers/'
export const JOBS_BROWSE_URL = 'https://jobs.elektrobit.com/jobs'
export const INDIA_JOBS_URL = 'https://jobs.elektrobit.com/jobs/locations/country/India'
export const JOBS_API_URL = 'https://jobs.elektrobit.com/api/jobs'
export const API_PAGE_LIMIT = 50

export const SOURCE = 'elektrobitautomotive'
export const COMPANY = 'Elektrobit Automotive'
export const VERIFIED_ON = '2026-08-14'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&bull;/gi, '•')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const uniqueStrings = (values) => {
  const seen = new Set()
  const output = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

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

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  switch (normalized.toUpperCase()) {
    case 'FULL_TIME':
      return 'Full-time'
    case 'PART_TIME':
      return 'Part-time'
    case 'CONTRACTOR':
      return 'Contract'
    case 'TEMPORARY':
      return 'Temporary'
    default:
      return normalized
        .toLowerCase()
        .split(/[_\s]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-')
    }
}

const parseDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) return directMatch[1]

  const parsed = Date.parse(normalized)
  if (!Number.isFinite(parsed)) return null

  return new Date(parsed).toISOString().slice(0, 10)
}

const extractCategory = (job) => {
  const categories = Array.isArray(job?.categories)
    ? job.categories.map((category) => normalizeWhitespace(category?.name)).filter(Boolean)
    : []
  if (categories.length > 0) return categories[0]

  const categoryEntries = Array.isArray(job?.category)
    ? job.category.map((category) => normalizeWhitespace(category)).filter(Boolean)
    : []
  if (categoryEntries.length > 0) {
    return categoryEntries[0].replace(/^[-\s]+/, '')
  }

  return normalizeWhitespace(job?.department)
}

const buildLocation = (job) => normalizeWhitespace(
  job?.full_location
  || job?.short_location
  || [job?.city, job?.state, job?.country].filter(Boolean).join(', '),
)

const extractBullets = (html) => {
  const listItems = [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTagsToText(match[1]))
    .filter(Boolean)

  if (listItems.length > 0) {
    return uniqueStrings(listItems)
  }

  return uniqueStrings(
    decodeHtml(String(html ?? ''))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .split(/\r?\n+/)
      .map((line) => normalizeWhitespace(line)?.replace(/^[•*-]\s*/, ''))
      .filter((line) => line && !/^(Overview|Responsibilities|Qualifications|Experience|Technical Skills|Success Factors)$/i.test(line)),
  )
}

const extractExperienceRequired = (job) => {
  const haystack = normalizeWhitespace(
    `${stripTagsToText(job?.qualifications)} ${stripTagsToText(job?.description)}`,
  )
  if (!haystack) return null

  return haystack.match(/\b\d+\+?\s*(?:to|-)\s*\d+\s*years? of experience\b|\b\d+\+?\s*years? of experience\b/i)?.[0]
    || null
}

const isIndiaJobData = (job) => hasNativeIndiaCountry(job)

const buildSourceUrl = (job) => {
  const jobId = normalizeWhitespace(job?.slug || job?.req_id)
  if (!jobId) return null

  try {
    return new URL(`/jobs/${jobId}`, JOBS_BROWSE_URL).toString()
  } catch {
    return null
  }
}

export const buildIndiaJobsApiUrl = ({
  page = 1,
  limit = API_PAGE_LIMIT,
} = {}) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('country', 'India')
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Move the world with us!/i.test(page)
    && /Careers at Elektrobit/i.test(page)
    && /Open Elektrobit Jobs/i.test(page)
    && /jobs\.elektrobit\.com/i.test(page)
}

export const hasOfficialJobsPortalSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Elektrobit Automotive GmbH\s*<\/title>/i.test(page)
    && /Find Jobs/i.test(page)
    && /See jobs by:\s*Categories\s*Brands\s*Locations/i.test(stripTagsToText(page))
    && /<search-app>/i.test(page)
    && /app\.jibecdn\.com\/prod\/search\//i.test(page)
}

export const hasOfficialIndiaJobsSignal = (html) => {
  const page = String(html ?? '')
  return hasOfficialJobsPortalSignal(page)
    && /canonical"\s+href="https:\/\/jobs\.elektrobit\.com\/jobs\/locations\/country\/India"/i.test(page)
    && /page_type:\s*'\/jobs\/locations\/country\/India'/i.test(page)
}

const buildJob = (job) => {
  const quality = projectElektrobitNativeQuality(job)
  const location = buildLocation(job)
  const sourceUrl = buildSourceUrl(job)
  const applyUrl = normalizeWhitespace(job?.apply_url)
  const requisitionId = normalizeWhitespace(job?.req_id || job?.slug)
  const category = extractCategory(job)

  if (!sourceUrl || !requisitionId || !location) {
    throw new Error('Elektrobit India jobs API no longer exposes the verified first-party job identifiers')
  }

  return {
    title: normalizeWhitespace(job?.title),
    company: COMPANY,
    department: category || null,
    location,
    city: quality.city,
    country: quality.country,
    jobId: requisitionId,
    requisitionId,
    sourceUrl,
    applyUrl: applyUrl || sourceUrl,
    employmentType: normalizeEmploymentType(job?.employment_type),
    experienceRequired: extractExperienceRequired(job),
    minimumQualification: quality.minimumQualification,
    preferredQualification: quality.preferredQualification,
    requiredSkills: quality.requiredSkills,
    postingDate: parseDate(job?.posted_date),
    closingDate: parseDate(job?.posting_expiry_date),
    jobDescription: quality.jobDescription,
    sourceDescription: quality.sourceDescription,
    sourceNativeCriteriaEvidence: quality.sourceNativeCriteriaEvidence,
    sourceNativeGeographyEvidence: quality.sourceNativeGeographyEvidence,
  }
}

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const fetchIndiaJobs = async ({
  fetchJson = defaultFetchJson,
  maxJobs = null,
  pageLimit = API_PAGE_LIMIT,
} = {}) => {
  const jobs = []
  const seenJobIds = new Set()
  let totalCount = null

  for (let page = 1; page <= 25; page += 1) {
    const payload = await fetchJson(buildIndiaJobsApiUrl({ page, limit: pageLimit }))
    if (!payload || !Array.isArray(payload.jobs)) {
      throw new Error('Elektrobit India jobs API no longer returns the verified public jobs payload')
    }

    if (totalCount == null) {
      totalCount = Number.parseInt(String(payload.totalCount ?? payload.count ?? payload.jobs.length), 10)
      if (!Number.isFinite(totalCount) || totalCount < 0) {
        throw new Error('Elektrobit India jobs API no longer returns the verified public jobs count')
      }
    }

    const pageJobs = payload.jobs.map((entry) => entry?.data).filter(Boolean)

    if (pageJobs.some((job) => !isIndiaJobData(job))) {
      throw new Error('Elektrobit India jobs API no longer honors the verified India country filter')
    }

    if (pageJobs.length === 0) {
      if (page === 1 || jobs.length >= totalCount) break
      throw new Error('Elektrobit India jobs API pagination no longer matches the verified public feed')
    }

    for (const job of pageJobs) {
      const requisitionId = normalizeWhitespace(job?.req_id || job?.slug)
      if (!requisitionId || seenJobIds.has(requisitionId)) continue

      seenJobIds.add(requisitionId)
      jobs.push(buildJob(job))

      if (Number.isInteger(maxJobs) && maxJobs > 0 && jobs.length >= maxJobs) {
        return jobs
      }
    }

    if (jobs.length >= totalCount) break
  }

  return jobs
}

export const createElektrobitAutomotiveScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
  pageLimit = API_PAGE_LIMIT,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Elektrobit careers page no longer matches the verified official public careers surface')
    }

    const jobsBrowsePage = await fetchPage(JOBS_BROWSE_URL)
    if (
      jobsBrowsePage.status !== 200
      || !sameUrl(jobsBrowsePage.url, JOBS_BROWSE_URL)
      || !hasOfficialJobsPortalSignal(jobsBrowsePage.html)
    ) {
      throw new Error('Elektrobit jobs portal no longer matches the verified official public jobs surface')
    }

    const indiaJobsPage = await fetchPage(INDIA_JOBS_URL)
    if (
      indiaJobsPage.status !== 200
      || !sameUrl(indiaJobsPage.url, INDIA_JOBS_URL)
      || !hasOfficialIndiaJobsSignal(indiaJobsPage.html)
    ) {
      throw new Error('Elektrobit India jobs location page no longer matches the verified official public jobs surface')
    }

    const jobs = await fetchIndiaJobs({
      fetchJson,
      maxJobs,
      pageLimit,
    })

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createElektrobitAutomotiveScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Elektrobit Automotive scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
