import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { PLANFUL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PLANFUL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const JOB_LISTING_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PLANFUL_LEGACY_CAREERS_TITLE_PATTERN =
  /<title[^>]*>\s*Join the Planful Team \| Planful Jobs\s*<\/title>/i
const PLANFUL_CURRENT_CAREERS_TITLE_PATTERN =
  /<title[^>]*>\s*Open Roles at Planful \| Planful Careers\s*<\/title>/i
const PLANFUL_LEGACY_LIST_TITLE_PATTERN =
  /<title[^>]*>\s*Careers List - Planful\s*<\/title>/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const toComparableBrand = (value) => String(value ?? '')
  .replace(/[^a-z0-9]+/gi, '')
  .toLowerCase()

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location || office?.name))
    .filter(Boolean)

const containsIndia = (value) => /\bindia\b/i.test(normalizeWhitespace(value) || '')

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((location) => containsIndia(location))

  if (officeIndiaLocation) return officeIndiaLocation
  if (primaryLocation && containsIndia(primaryLocation)) return primaryLocation
  return null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })
  if (scopedCity) return scopedCity

  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const firstToken = normalized.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [location, ...officeLocations, decodedDescription]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  const hasVerifiedTitle =
    PLANFUL_LEGACY_CAREERS_TITLE_PATTERN.test(page)
    || PLANFUL_CURRENT_CAREERS_TITLE_PATTERN.test(page)
  const hasCareersListLink = /\/jobs\/careers-list\//i.test(page)
  const hasLegacyShell = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/planful\.com\/jobs\/["']/i.test(page)
    && /Planful is hiring!/i.test(page)
    && /Join Our Team/i.test(page)
  const hasCurrentShell = /Join Our Team/i.test(page)
    && /Your ideas\.\s*Your actions\.\s*Your spirit\./i.test(page)
    && /We Take Care of Our People/i.test(page)
    && /Learn About Life at Planful/i.test(page)

  return hasVerifiedTitle
    && hasCareersListLink
    && (hasLegacyShell || hasCurrentShell)
}

export const hasVerifiedJobListingSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  const hasVerifiedTitle =
    PLANFUL_LEGACY_LIST_TITLE_PATTERN.test(page)
    || PLANFUL_CURRENT_CAREERS_TITLE_PATTERN.test(page)
  const hasGreenhouseMount = /id=["']grnhse_app["']/i.test(page)
  const hasLegacyShell = /Join Our Journey/i.test(page)
  const hasCurrentShell = /Your Planful Journey Begins Today/i.test(page)
    && /\bTeam\b/i.test(normalized)
    && /\bLocation\b/i.test(normalized)
    && /\bReset\b/i.test(normalized)
    && /greenhouse/i.test(page)

  return hasVerifiedTitle
    && ((hasGreenhouseMount && hasLegacyShell) || hasCurrentShell)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(String(value ?? ''))
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'planful.com') return null
    if (normalizedPathname !== '/jobs/careers-list') return null
    if (url.searchParams.get('gh_jid') !== canonicalJobId) return null

    return `https://planful.com/jobs/careers-list/?gh_jid=${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Planful Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

      if (toComparableBrand(job?.company_name) !== 'planful') {
        throw new Error('Planful Greenhouse payload no longer matches the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Planful Greenhouse payload no longer exposes the verified first-party detail URL and India location fields')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        employmentType: null,
        experienceRequired: null,
        jobDescription: decodedDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        remoteStatus,
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: JOB_LISTING_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPlanfulScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Planful verified Planful careers landing page no longer matches the official first-party surface')
    }

    const jobListingHtml = await fetchText(JOB_LISTING_URL)
    if (!hasVerifiedJobListingSignal(jobListingHtml)) {
      throw new Error('Planful verified Planful careers list page no longer matches the official first-party surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createPlanfulScraper(options).run(options)

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
