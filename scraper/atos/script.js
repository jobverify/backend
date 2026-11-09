import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { ATOS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = ATOS_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_WIDGET_SCRIPT_URL = PROVIDER_METADATA.jobsWidgetScriptUrl
export const PUBLIC_JOB_DETAIL_HOST = PROVIDER_METADATA.publicJobDetailHost
export const VERIFIED_INDIA_JOB_URL = PROVIDER_METADATA.verifiedIndiaJobUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const JOBS_PAYLOAD_PATTERN = /window\['atosjobs_[^']+'\]\s*=\s*(\{[\s\S]*?\});<\/script>/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
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

const toCanonicalJobUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

const hasEmbeddedPayload = (html = '') => JOBS_PAYLOAD_PATTERN.test(String(html ?? ''))

const isValidPayloadShape = (payload = {}) =>
  Array.isArray(payload?.results)
  && payload?.support
  && typeof payload.support === 'object'
  && payload.support.city
  && typeof payload.support.city === 'object'
  && payload.support.locations
  && typeof payload.support.locations === 'object'

const isIndiaCityRecord = (record = {}) => normalizeWhitespace(record?.country_id) === 'IN'

const isVerifiedPublicJobUrl = (value) => {
  const normalized = toCanonicalJobUrl(value)
  if (!normalized) return false

  try {
    const url = new URL(normalized)
    return sameUrl(url.origin, PUBLIC_JOB_DETAIL_HOST) && /\/job\//i.test(url.pathname)
  } catch {
    return false
  }
}

const getIndiaCityRecordsForPosting = (payload = {}, posting = {}) => {
  const locationIds = Array.isArray(payload?.support?.locations?.[posting?.id])
    ? payload.support.locations[posting.id]
    : null

  if (!locationIds) {
    throw new Error('Atos verified embedded jobs payload changed materially')
  }

  const records = locationIds
    .map((locationId) => payload?.support?.city?.[locationId])
    .filter(Boolean)
    .filter(isIndiaCityRecord)

  return records.filter((record, index, list) =>
    list.findIndex((candidate) => candidate.city_id === record.city_id) === index)
}

const getLocationNames = (records = []) =>
  records
    .map((record) => normalizeWhitespace(record?.city))
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)

const formatIndiaLocation = (records = []) => {
  const names = getLocationNames(records)
  if (names.length === 0) return null
  if (names.length === 1) return `${names[0]}, India`
  return `${names.join(' / ')}, India`
}

const extractPrimaryCity = (records = []) => {
  const names = getLocationNames(records)
  if (names.length !== 1) return null
  if (/^nation wide$/i.test(names[0])) return null
  return normalizeCity(names[0])
}

const normalizePosting = (posting, payload, scrapedAt) => {
  const title = normalizeWhitespace(posting?.title)
  const jobId = normalizeWhitespace(posting?.id)
  const postingDate = normalizeWhitespace(posting?.date)
  const sourceUrl = toCanonicalJobUrl(posting?.url)
  const indiaCityRecords = getIndiaCityRecordsForPosting(payload, posting)
  const location = formatIndiaLocation(indiaCityRecords)
  const city = extractPrimaryCity(indiaCityRecords)

  if (!title || !jobId || !postingDate || !sourceUrl || !location) {
    throw new Error('Atos verified embedded jobs payload changed materially')
  }

  if (!isVerifiedPublicJobUrl(sourceUrl)) {
    throw new Error('Atos verified public job detail surface changed materially')
  }

  return {
    jobId,
    title,
    company: COMPANY_NAME,
    department: null,
    location,
    city,
    state: null,
    country: 'India',
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: null,
    requisitionId: jobId,
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Join us - Atos\s*<\/title>/i.test(page)
    && /Explore opportunities/i.test(page)
    && /Country \/ Region/i.test(page)
    && hasEmbeddedPayload(page)
    && new RegExp(
      JOBS_WIDGET_SCRIPT_URL
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    ).test(page)
}

export const extractEmbeddedJobsPayload = (html = '') => {
  const match = String(html ?? '').match(JOBS_PAYLOAD_PATTERN)
  if (!match?.[1]) {
    throw new Error('Atos verified embedded jobs payload changed materially')
  }

  let payload

  try {
    payload = JSON.parse(match[1])
  } catch {
    throw new Error('Atos verified embedded jobs payload changed materially')
  }

  if (!isValidPayloadShape(payload)) {
    throw new Error('Atos verified embedded jobs payload changed materially')
  }

  return payload
}

export const extractJobsFromPayload = (payload = {}, scrapedAt) => {
  if (!isValidPayloadShape(payload)) {
    throw new Error('Atos verified embedded jobs payload changed materially')
  }

  const jobs = []
  const seenJobIds = new Set()

  for (const posting of payload.results) {
    const indiaCityRecords = getIndiaCityRecordsForPosting(payload, posting)
    if (indiaCityRecords.length === 0) continue

    const job = normalizePosting(posting, payload, scrapedAt)
    if (seenJobIds.has(job.jobId)) continue

    seenJobIds.add(job.jobId)
    jobs.push(job)
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAtosScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Atos verified public careers surface changed materially')
    }

    const jobs = extractJobsFromPayload(
      extractEmbeddedJobsPayload(careersHtml),
      now(),
    )

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createAtosScraper(options).run(options)

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
