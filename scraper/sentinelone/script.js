import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { SENTINELONE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SENTINELONE_CATALOG
export const SOURCE = SENTINELONE_CATALOG.source
export const COMPANY = SENTINELONE_CATALOG.companyName
export const CAREERS_URL = SENTINELONE_CATALOG.companyCareerPage
export const JOBS_URL = SENTINELONE_CATALOG.officialJobsPage
export const GREENHOUSE_BOARD_TOKEN = SENTINELONE_CATALOG.greenhouseBoardToken
export const GREENHOUSE_JOBS_API_URL = SENTINELONE_CATALOG.greenhouseJobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
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

  return current
}

const stripTags = (value) => normalizeWhitespace(
  decodeRepeatedHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const uniqueValues = (values) => [...new Set(values.filter(Boolean))]

const isIndiaLocation = (value) => /\bindia\b/i.test(normalizeWhitespace(value) || '')

const valuesFrom = (value) => (Array.isArray(value) ? value : [value])

const extractLocationCandidates = (job) => uniqueValues([
  normalizeWhitespace(job?.location?.name),
  ...(Array.isArray(job?.offices) ? job.offices.flatMap((office) => [
    normalizeWhitespace(office?.location),
    normalizeWhitespace(office?.name),
  ]) : []),
  ...(Array.isArray(job?.metadata) ? job.metadata
    .filter((item) => /location|office/i.test(normalizeWhitespace(item?.name) || ''))
    .flatMap((item) => valuesFrom(item?.value).map((value) => normalizeWhitespace(value))) : []),
])

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalizeWhitespace(normalized.split(',')[0])
}

const metadataValue = (job, name) => normalizeWhitespace(
  (Array.isArray(job?.metadata) ? job.metadata : [])
    .find((item) => normalizeWhitespace(item?.name)?.toLowerCase() === name.toLowerCase())
    ?.value,
)

const normalizeFirstPartyJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (url.protocol !== 'https:' || hostname !== 'sentinelone.com') return null
    if (pathname !== '/jobs') return null
    if (normalizeWhitespace(url.searchParams.get('gh_jid')) !== canonicalJobId) return null

    return `${JOBS_URL}?gh_jid=${encodeURIComponent(canonicalJobId)}`
  } catch {
    return null
  }
}

const inferRemoteStatus = ({ location, content }) => {
  const haystack = `${normalizeWhitespace(location) || ''} ${stripTags(content) || ''}`
  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(normalizeWhitespace(location) || '') || /#LI-Remote\b/i.test(haystack)) {
    return 'Remote'
  }
  return null
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  if (!Array.isArray(payload?.jobs) || !Number.isInteger(payload?.meta?.total)) {
    throw new Error('SentinelOne Greenhouse jobs API no longer exposes the expected payload')
  }

  if (payload.meta.total !== payload.jobs.length) {
    throw new Error('SentinelOne Greenhouse jobs API total no longer matches the returned jobs')
  }

  const jobsById = new Map()

  for (const job of payload.jobs) {
      const locationCandidates = extractLocationCandidates(job)
      const primaryLocation = normalizeWhitespace(job?.location?.name)
      const location = isIndiaLocation(primaryLocation)
        ? primaryLocation
        : locationCandidates.find((candidate) => isIndiaLocation(candidate))

      if (!location) continue

      const jobId = normalizeWhitespace(job?.id)
      if (jobsById.has(jobId)) continue

      const title = normalizeWhitespace(job?.title)
      const sourceUrl = normalizeFirstPartyJobUrl(job?.absolute_url, jobId)
      const companyName = normalizeWhitespace(job?.company_name)

      if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
        throw new Error('SentinelOne Greenhouse payload no longer maps to the verified company identity')
      }
      if (!jobId || !title || !location || !sourceUrl) {
        throw new Error('SentinelOne Greenhouse India job no longer exposes a verified first-party job URL')
      }

      const content = decodeRepeatedHtmlEntities(job?.content)

      jobsById.set(jobId, {
        title,
        company: COMPANY,
        department: metadataValue(job, 'Job Posting Department')
          || normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        locations: locationCandidates,
        city: deriveCity(location),
        country: 'India',
        jobId,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        sourceUrl,
        applyUrl: sourceUrl,
        link: sourceUrl,
        source: SOURCE,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.first_published),
        closingDate: null,
        jobDescription: stripTags(content),
        remoteStatus: inferRemoteStatus({ location: primaryLocation || location, content }),
        scrapedAt,
        companyCareerPage: CAREERS_URL,
        companyDomain: SENTINELONE_CATALOG.companyDomain,
        atsPlatform: SENTINELONE_CATALOG.atsPlatform,
      })
  }

  return [...jobsById.values()]
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    Referer: JOBS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSentinelOneScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(GREENHOUSE_JOBS_API_URL),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createSentinelOneScraper(options).run(options)

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
