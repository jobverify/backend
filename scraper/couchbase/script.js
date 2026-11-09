import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'couchbase'
export const COMPANY = 'Couchbase'
export const CAREERS_URL = 'https://www.couchbase.com/careers/'
export const GREENHOUSE_BOARD_URL = 'https://job-boards.greenhouse.io/couchbaseinc'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs'
export const OPEN_POSITIONS_BUCKET_ID = '4488138006'

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

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeLocationLabel = (value) => normalizeWhitespace(value)

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeLocationLabel(office?.location))
    .filter(Boolean)

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return false

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeLocationLabel(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value)) || null

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return officeIndiaLocation || primaryLocation
  }

  return officeIndiaLocation
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeLocationLabel(location)?.split(',')[0]?.trim()
  return normalizeCity(firstToken || location)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription, department }) => {
  const haystack = [
    location,
    ...officeLocations,
    department,
    stripTags(decodedDescription),
  ]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

const normalizeCompanyIdentity = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const matchesVerifiedCompanyIdentity = (value) => {
  const normalized = normalizeCompanyIdentity(value)
  return normalized === 'couchbase' || normalized === 'couchbaseinc'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.couchbase\.com\/careers\/["']/i.test(page)
    && /Join the Couchbase Team - Careers/i.test(page)
    && /Explore Open Roles/i.test(page)
    && /aria-label=["']Open Positions["']/i.test(page)
    && extractGreenhouseJobsApiUrl(page) === GREENHOUSE_JOBS_API_URL
}

export const hasOfficialGreenhouseBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Jobs at Couchbase,\s*Inc\.\s*<\/title>/i.test(page)
    && /meta[^>]+property=["']og:title["'][^>]+content=["']Couchbase,\s*Inc\.["']/i.test(page)
    && /job-boards\.greenhouse\.io\/couchbaseinc/i.test(page)
    && /Current openings at Couchbase,\s*Inc\./i.test(text)
}

export const extractGreenhouseJobsApiUrl = (html) => {
  const match = String(html ?? '').match(
    /data-api-url=["'](https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/couchbaseinc\/jobs)["']/i,
  )

  return match?.[1] || null
}

export const extractOpenPositionsBucketId = (html) => {
  const match = String(html ?? '').match(/data-bucket-id=["'](\d+)["']/i)
  return match?.[1] || null
}

const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/couchbaseinc/jobs/${canonicalJobId}`

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
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
    throw new Error('Couchbase Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const department = normalizeWhitespace(job?.departments?.[0]?.name)
        || extractMetadataValue(job, 'Job Site Team')
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
        department,
      })

      if (companyName && !matchesVerifiedCompanyIdentity(companyName)) {
        throw new Error('Couchbase Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Couchbase Greenhouse payload no longer exposes the verified public Greenhouse job detail URLs')
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
        department,
        employmentType: extractMetadataValue(job, 'Employment Type'),
        experienceRequired: extractMetadataValue(job, 'Experience'),
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
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCouchbaseScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    let careersHtml = null

    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch {
      careersHtml = null
    }

    if (hasOfficialCareersSignal(careersHtml)) {
      if (extractGreenhouseJobsApiUrl(careersHtml) !== GREENHOUSE_JOBS_API_URL) {
        throw new Error('Couchbase careers page no longer exposes the verified inline Greenhouse jobs API')
      }

      if (extractOpenPositionsBucketId(careersHtml) !== OPEN_POSITIONS_BUCKET_ID) {
        throw new Error('Couchbase careers page no longer exposes the verified open-positions widget contract')
      }
    } else {
      const greenhouseBoardHtml = await fetchText(GREENHOUSE_BOARD_URL)

      if (!hasOfficialGreenhouseBoardSignal(greenhouseBoardHtml)) {
        throw new Error('Couchbase public Greenhouse board no longer matches the verified company hiring surface')
      }
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createCouchbaseScraper(options).run(options)

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
