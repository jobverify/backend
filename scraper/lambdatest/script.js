import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LAMBDATEST_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LAMBDATEST_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LEGACY_CAREERS_PAGE_URL = PROVIDER_METADATA.legacyCareersPageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ACTIVE_JOBS_API_URL = PROVIDER_METADATA.activeJobsApiUrl
export const DEPARTMENTS_API_URL = PROVIDER_METADATA.departmentsApiUrl
export const JOB_DETAIL_BASE_URL = PROVIDER_METADATA.externalJobDetailBaseUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
)
  || null

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

const isIndiaLocation = (location = {}) => {
  if (String(location.countryCode ?? '').toUpperCase() === 'IN') return true
  if (/india/i.test(String(location.countryName ?? ''))) return true

  return /india/i.test(
    [location.name, location.city, location.state]
      .filter(Boolean)
      .join(' '),
  )
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const toEmploymentType = (jobType) => (jobType === 2 || jobType === '2' ? 'Full Time' : null)

const resolveIndiaLocation = (job = {}) => {
  const locations = Array.isArray(job?.jobLocations) ? job.jobLocations : []
  const indiaLocation = locations.find(isIndiaLocation) || null

  if (!indiaLocation) {
    const introduction = normalizeWhitespace(job?.description || job?.excerpt)?.slice(0, 300) || ''
    if (/(?:📍|location\s*[:\-])\s*Noida\b/i.test(introduction)) {
      return { location: 'Noida, India', city: 'Noida', country: 'India' }
    }
    return null
  }

  const city = normalizeWhitespace(indiaLocation.city) || normalizeWhitespace(indiaLocation.name)
  const state = normalizeWhitespace(indiaLocation.state)
  const location = [city, state, 'India']
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ')

  return {
    location: location || 'India',
    city,
    country: 'India',
  }
}

export const buildJobDetailUrl = ({ jobId } = {}) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  return normalizedJobId ? `${JOB_DETAIL_BASE_URL}${normalizedJobId}` : null
}

export const hasOfficialLambdaTestCareersSignals = (html = '') => {
  const source = String(html ?? '')
  const text = (normalizeWhitespace(source) || '').toLowerCase()

  return /careers at testmu ai/i.test(text)
    && /formerly lambdatest/i.test(text)
    && text.includes('open positions')
    && text.includes('apply here')
}

export const hasExpectedDepartmentPayload = (payload = []) => {
  if (!Array.isArray(payload) || payload.length < 3) return false

  const normalizedNames = payload
    .map((item) => normalizeWhitespace(item?.departmentName || item?.name)?.toLowerCase())
    .filter(Boolean)

  return normalizedNames.some((name) => name.startsWith('application support'))
    && normalizedNames.some((name) => [
      'engineering',
      'sales',
      'solution engineer',
      'business development representative',
    ].includes(name))
}

const mapJob = (job = {}) => {
  const location = resolveIndiaLocation(job)
  if (!location) return null

  const jobId = normalizeWhitespace(job?.id)
  const title = normalizeWhitespace(job?.title)
  const sourceUrl = buildJobDetailUrl({ jobId })

  if (!jobId || !title || !sourceUrl) return null

  return {
    title,
    company: COMPANY_NAME,
    department: normalizeWhitespace(job?.departmentName),
    location: location.location,
    city: location.city,
    country: location.country,
    jobId,
    requisitionId: normalizeWhitespace(job?.jobNumber) || jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: toEmploymentType(job?.jobType),
    experienceRequired: normalizeWhitespace(job?.experience),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(job?.skillNames)
      ? job.skillNames.map((skill) => normalizeWhitespace(skill)).filter(Boolean)
      : [],
    postingDate: normalizePostingDate(job?.publishedOn),
    closingDate: null,
    jobDescription: normalizeWhitespace(job?.description),
  }
}

export const extractSearchResults = (payload = []) => (
  (Array.isArray(payload) ? payload : [])
    .map((job) => mapJob(job))
    .filter(Boolean)
)

export const createLambdaTestScraper = ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    fetchJson: overrideFetchJson,
    maxJobs: overrideMaxJobs = maxJobs,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const fetchJsonImpl = overrideFetchJson || fetchJson

    const careersHtml = await fetchTextImpl(OFFICIAL_CAREERS_URL)
    if (!hasOfficialLambdaTestCareersSignals(careersHtml)) {
      throw new Error('LambdaTest verified official careers page no longer matches the verified public surface')
    }

    const departments = await fetchJsonImpl(DEPARTMENTS_API_URL)
    if (!hasExpectedDepartmentPayload(departments)) {
      throw new Error('LambdaTest verified departments surface no longer matches the pinned public contract')
    }

    const jobs = extractSearchResults(await fetchJsonImpl(ACTIVE_JOBS_API_URL))
    const selectedJobs = overrideMaxJobs ? jobs.slice(0, overrideMaxJobs) : jobs
    const scrapedAt = now()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createLambdaTestScraper().run(options)

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
