import { createNativeRouteScraper, NATIVE_ROUTE_PROFILES } from '../../scraper-support/native-sources/declaredGreenhouseRoutes/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { PATH_AI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PATH_AI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl

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

const stripTags = (value) => normalizeWhitespace(
  decodeRepeatedHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const collectMetadataValues = (job = {}) =>
  (Array.isArray(job?.metadata) ? job.metadata : [])
    .flatMap((entry) => {
      const value = entry?.value
      if (Array.isArray(value)) return value
      return [value]
    })
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

const collectLocationValues = (job = {}) => [
  normalizeWhitespace(job?.location?.name),
  ...(Array.isArray(job?.offices)
    ? job.offices.map((office) => normalizeWhitespace(office?.location || office?.name))
    : []),
  ...collectMetadataValues(job),
].filter(Boolean)

const hasIndiaMarker = (value) => /\bindia\b/i.test(String(value ?? ''))

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const normalizePathAiJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (normalizedHost !== 'pathai.com') return null
    if (normalizedPathname !== `/careers/${canonicalJobId}`) return null
    if (ghJid !== canonicalJobId) return null

    return `https://www.pathai.com/careers/${canonicalJobId}?gh_jid=${canonicalJobId}`
  } catch {
    return null
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && /href=["']#OpenPositions["']/i.test(page)
    && /id=["']OpenPositions["']/i.test(page)
    && /id=["']resourceGrid["']/i.test(page)
    && normalized.includes('Open Positions')
    && normalized.includes('All Locations')
    && normalized.includes('All Departments')
    && /Copyright\s+©\s+2026\s+PathAI,\s+Inc\./i.test(page)
}

const isIndiaJob = (job = {}) => collectLocationValues(job).some((value) => hasIndiaMarker(value))

const deriveCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = (job = {}) => {
  const values = collectLocationValues(job).join(' ')
  if (/\bremote\b/i.test(values)) return 'Remote'
  if (/\bhybrid\b/i.test(values)) return 'Hybrid'
  return 'On-site'
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('PathAI Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs.flatMap((job) => {
    const title = normalizeWhitespace(job?.title)
    const companyName = normalizeWhitespace(job?.company_name)
    const sourceUrl = normalizePathAiJobUrl(job?.absolute_url, job?.id)

    if (companyName && companyName.toLowerCase() !== COMPANY_NAME.toLowerCase()) {
      throw new Error('PathAI Greenhouse payload no longer maps to the verified company identity')
    }

    if (!title || !sourceUrl) {
      throw new Error('PathAI Greenhouse payload no longer exposes the verified first-party detail route')
    }

    if (!isIndiaJob(job)) return []

    const location = collectLocationValues(job).find((value) => hasIndiaMarker(value)) || 'India'

    return [{
      title,
      company: COMPANY_NAME,
      location,
      city: deriveCity(location),
      country: 'India',
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: String(job?.id),
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: null,
      jobDescription: stripTags(job?.content) || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
      remoteStatus: inferRemoteStatus(job),
      scrapedAt,
    }]
  })
}

export const createPathAiScraper = (options = {}) => createNativeRouteScraper(NATIVE_ROUTE_PROFILES.pathai, options)

export const run = async (options = {}) => createPathAiScraper(options).run(options)

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
