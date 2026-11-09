import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HIGHRADIUS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HIGHRADIUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const VERIFIED_SAMPLE_JOB_ID = '7611164003'
const VERIFIED_CURRENT_INDIA_SAMPLE_JOB_IDS = ['7701514003', '7701519003']
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

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

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const hasIndiaMarker = (value) => /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(String(value ?? ''))

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location || office?.name))
    .filter(Boolean)

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  if (hasIndiaMarker(primaryLocation)) return primaryLocation

  return extractOfficeLocations(job).find((location) => hasIndiaMarker(location)) || null
}

const deriveCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = (job = {}) => {
  const remotePosition = extractMetadataValue(job, 'Remote Position')
  if (remotePosition === true) return 'Remote'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const normalizeHighRadiusJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (normalizedHost !== 'highradius.com') return null
    if (normalizedPathname !== '/about/careers-list') return null
    if (ghJid !== canonicalJobId) return null

    return `https://www.highradius.com/about/careers-list/?gh_jid=${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractFirstPartyJobIdsFromCareersPage = (html = '') => {
  const seen = new Set()
  const ids = []

  for (const match of String(html ?? '').matchAll(/gh_jid=(\d+)/gi)) {
    const jobId = match[1]
    if (seen.has(jobId)) continue
    seen.add(jobId)
    ids.push(jobId)
  }

  return ids
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const jobIds = extractFirstPartyJobIdsFromCareersPage(page)

  return /<title>\s*Careers at HighRadius \| Get a Career High!\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.highradius\.com\/about\/career\/["']/i.test(page)
    && normalized.includes('Explore Opportunities')
    && normalized.includes('Find Your Best Fit')
    && normalized.includes('Agent Developer Test III')
    && /Analyst\s+[-–]\s+Strategic Alliances/i.test(page)
    && normalized.includes('Hyderabad, Telangana, India')
    && jobIds.includes(VERIFIED_SAMPLE_JOB_ID)
    && VERIFIED_CURRENT_INDIA_SAMPLE_JOB_IDS.some((jobId) => jobIds.includes(jobId))
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    allowedJobIds = null,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('HighRadius Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => {
      const location = chooseIndiaLocation(job)
      if (!location) return false
      if (!allowedJobIds) return true
      return allowedJobIds.has(String(job?.id))
    })
    .map((job) => {
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeHighRadiusJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)

      if (companyName && companyName.toLowerCase() !== COMPANY_NAME.toLowerCase()) {
        throw new Error('HighRadius Greenhouse payload no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('HighRadius Greenhouse payload no longer exposes the verified first-party gh_jid detail route')
      }

      return {
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
        experienceRequired: extractMetadataValue(job, 'Experience Range'),
        jobDescription: stripTags(job?.content) || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        remoteStatus: inferRemoteStatus(job),
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

export const createHighRadiusScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('HighRadius verified first-party careers page no longer matches the trusted public surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      {
        allowedJobIds: new Set(extractFirstPartyJobIdsFromCareersPage(careersHtml)),
        scrapedAt: now(),
      },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createHighRadiusScraper(options).run(options)

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
