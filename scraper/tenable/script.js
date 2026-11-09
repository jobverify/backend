import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import TENABLE_CATALOG from './catalog.js'
import {run as runCurrentNative} from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TENABLE_CATALOG
export const SOURCE = TENABLE_CATALOG.source
export const COMPANY = TENABLE_CATALOG.companyName
export const CAREERS_URL = TENABLE_CATALOG.companyCareerPage
export const JOB_SEARCH_URL = TENABLE_CATALOG.firstPartyJobSearchUrl
export const FIRST_PARTY_JOBS_API_URL = TENABLE_CATALOG.firstPartyJobsApiUrl
export const GREENHOUSE_BOARD_ID = TENABLE_CATALOG.greenhouseBoardId
export const GREENHOUSE_BOARD_URL = TENABLE_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL =
  `https://boards-api.greenhouse.io/v1/boards/${GREENHOUSE_BOARD_ID}/jobs`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;/gi, '-')
  .replace(/&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toMetadataValues = (value) => (Array.isArray(value) ? value : [value])
  .map(normalizeWhitespace)
  .filter(Boolean)

const extractMetadataValues = (job, fieldNamePattern) => (
  Array.isArray(job?.metadata) ? job.metadata : []
)
  .filter((entry) => fieldNamePattern.test(normalizeWhitespace(entry?.name) || ''))
  .flatMap((entry) => toMetadataValues(entry?.value))

const extractMetadataValue = (job, fieldNamePattern) =>
  extractMetadataValues(job, fieldNamePattern)[0] || null

const extractOfficeLocations = (job = {}) => (Array.isArray(job?.offices) ? job.offices : [])
  .flatMap((office) => [office?.location, office?.name])
  .map(normalizeWhitespace)
  .filter(Boolean)

const INDIA_LOCATION_PATTERN = /(?:^|[\s,;/|(\[-])India(?=$|[\s,;/|)\]-])/i
const INDIA_COUNTRY_PATTERN = /^(?:India|IN|IND)$/i
const INDIA_CITY_ALIASES = new Set(
  Object.keys(CANONICAL_CITIES).filter((value) => !/^(?:remote|none)$/i.test(value)),
)
const INDIA_REGION_PATTERN = /^(?:Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi|Chandigarh|Puducherry|Ladakh|Jammu and Kashmir)$/i

const hasIndiaLocationMarker = (value) => INDIA_LOCATION_PATTERN.test(String(value ?? ''))
const isRecognizedIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return false
  if (hasIndiaLocationMarker(location) || /^IND-/i.test(location)) return true
  if (/^(?:remote|offsite|apac remote)$/i.test(location)) return true
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
  const city = parts[0]?.toLowerCase()
  if (!INDIA_CITY_ALIASES.has(city)) return parts.length === 1 && INDIA_REGION_PATTERN.test(parts[0])
  return parts.length === 1 || parts.slice(1).some((part) => INDIA_REGION_PATTERN.test(part))
}

const extractJobPostingLocations = (job = {}) =>
  extractMetadataValues(job, /^(?:job posting )?locations?$/i)

const extractCountryValues = (job = {}) =>
  extractMetadataValues(job, /^country(?:\s*\(for website only\))?$/i)

export const isIndiaJob = (job = {}) => {
  const locationEvidence = [
    job?.location?.name,
    ...extractJobPostingLocations(job),
    ...extractOfficeLocations(job),
  ].map(normalizeWhitespace).filter(Boolean)

  if (locationEvidence.some(hasIndiaLocationMarker)) return true
  if (!extractCountryValues(job).some((value) => INDIA_COUNTRY_PATTERN.test(value))) return false
  return locationEvidence.length === 0 || locationEvidence.some(isRecognizedIndiaLocation)
}

const chooseIndiaLocation = (job = {}) => {
  if (!isIndiaJob(job)) return null

  const primaryLocation = normalizeWhitespace(job?.location?.name)
  if (hasIndiaLocationMarker(primaryLocation)) return primaryLocation

  const postingLocations = extractJobPostingLocations(job).filter(hasIndiaLocationMarker)
  if (postingLocations.length > 0) return postingLocations.join(' , ')

  const officeLocation = extractOfficeLocations(job).find(hasIndiaLocationMarker)
  if (officeLocation) return officeLocation

  const recognizedLocation = [
    primaryLocation,
    ...extractJobPostingLocations(job),
    ...extractOfficeLocations(job),
  ].find(isRecognizedIndiaLocation)
  if (recognizedLocation) {
    return /\bremote\b|\boffsite\b/i.test(recognizedLocation)
      ? `${recognizedLocation}, India`
      : recognizedLocation
  }

  return 'India'
}

const deriveCity = (job, location) => {
  if (/^(?:India|Remote, India)$/i.test(location)) return null

  return getValidIndiaCityForJob({
    country: 'India',
    location,
    locations: [
      ...extractJobPostingLocations(job),
      ...extractOfficeLocations(job),
    ],
  }) || null
}

const inferRemoteStatus = ({ location, originalLocation, officeLocations, description }) => {
  const haystack = [location, originalLocation, ...officeLocations, description]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b|\boffsite\b/i.test(haystack)) return 'Remote'
  if (/\boffice\b|\bheadquarters\b|\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return null
}

const extractExperienceRequired = (job, description) => {
  const metadataExperience = extractMetadataValue(job, /^experience(?: required)?$/i)
  if (metadataExperience) return metadataExperience

  return normalizeWhitespace(
    description?.match(/\b\d+(?:\s*[-–]\s*\d+)?\+?\s+years?\b/i)?.[0],
  )
}

const hasVerifiedCompanyIdentity = (companyName) => {
  const normalized = normalizeWhitespace(companyName)
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  return !normalized || normalized === 'tenable' || normalized === 'tenableinc'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const extractOfficialJobSearchUrl = (html) => {
  const match = String(html ?? '').match(/href=["']([^"']*\/careers\/search(?:\?[^"']*)?)["']/i)
  if (!match) return null

  try {
    const url = new URL(match[1], CAREERS_URL)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export const extractGreenhouseBoardId = (html) => {
  const match = String(html ?? '').match(
    /https:\/\/(?:job-boards|boards)\.greenhouse\.io\/([^/"'?]+)(?:\/jobs\/\d+)?/i,
  )

  return normalizeWhitespace(match?.[1])?.toLowerCase() || null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const pageText = stripTags(page) || ''

  return /<title[^>]*>[^<]*Careers[^<]*Tenable[^<]*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.tenable\.com\/careers["']/i.test(page)
    && /Do work/i.test(pageText)
    && /that matters/i.test(pageText)
    && /Search jobs/i.test(pageText)
    && extractOfficialJobSearchUrl(page) === JOB_SEARCH_URL
    && extractGreenhouseBoardId(page) === GREENHOUSE_BOARD_ID
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(String(value ?? ''))
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/${GREENHOUSE_BOARD_ID}/jobs/${canonicalJobId}`

    if (!['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(host)) return null
    if (pathname.toLowerCase() !== expectedPathname.toLowerCase()) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  if (!Array.isArray(payload?.jobs)) {
    throw new Error('Tenable Greenhouse jobs API response no longer exposes the expected jobs array')
  }

  const seenJobIds = new Set()
  return payload.jobs
    .filter(isIndiaJob)
    .filter((job) => {
      const jobId = normalizeWhitespace(job?.id)
      if (!jobId || !seenJobIds.has(jobId)) {
        if (jobId) seenJobIds.add(jobId)
        return true
      }
      return false
    })
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const jobId = normalizeWhitespace(job?.id)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, jobId)
      const description = stripTags(decodeRepeatedHtmlEntities(job?.content))
      const officeLocations = extractOfficeLocations(job)

      if (!hasVerifiedCompanyIdentity(job?.company_name)) {
        throw new Error('Tenable Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!title || !jobId || !location || !sourceUrl) {
        throw new Error('Tenable Greenhouse payload no longer exposes the verified job detail URL contract')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(job, location),
        country: 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeWhitespace(job?.departments?.[0]?.name)
          || extractMetadataValue(job, /^category(?:\s*\(for website only\))?$/i),
        employmentType: extractMetadataValue(job, /^employment type$/i),
        experienceRequired: extractExperienceRequired(job, description),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.first_published || job?.updated_at),
        closingDate: normalizeWhitespace(job?.application_deadline),
        remoteStatus: inferRemoteStatus({
          location,
          originalLocation: normalizeWhitespace(job?.location?.name),
          officeLocations,
          description,
        }),
        jobDescription: description,
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
    Referer: JOB_SEARCH_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTenableScraper = (options = {}) => ({
  run: runOptions => runCurrentNative({ ...options, ...runOptions }),
})

export const run = async (options = {}) => runCurrentNative(options)

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
