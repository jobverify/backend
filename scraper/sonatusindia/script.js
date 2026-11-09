import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { SONATUS_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SONATUS_INDIA_CATALOG.source
export const COMPANY = SONATUS_INDIA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SONATUS_INDIA_CATALOG.officialBrandName
export const CAREERS_URL = SONATUS_INDIA_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_URL = SONATUS_INDIA_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = SONATUS_INDIA_CATALOG.greenhouseJobsApiUrl
export const PROVIDER_METADATA = SONATUS_INDIA_CATALOG

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

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/(?:^|,\s*|;\s*)India(?:$|[\s,);-])/i.test(normalized)) return true

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value, officeLocations))
  const countryMetadata = extractMetadataValue(job, 'Country')

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  if (officeIndiaLocation) return officeIndiaLocation
  if (countryMetadata?.toLowerCase() === 'india') return primaryLocation || officeIndiaLocation || 'India'

  return null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(/[;,]/)[0]?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [location, ...officeLocations, stripTags(decodedDescription)]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  return 'On-site'
}

const isTalentCommunityProspect = (job = {}) => (
  /\btalent community\b/i.test(normalizeWhitespace(job?.title) || '')
  || job?.internal_job_id == null
)

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

const canonicalizeGreenhouseBoardUrl = (value) => {
  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== '/sonatus') return null

    return GREENHOUSE_BOARD_URL
  } catch {
    return null
  }
}

export const extractOfficialGreenhouseBoardUrl = (html = '') => {
  const page = String(html ?? '')
  const anchors = page.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)

  for (const [, href, contents] of anchors) {
    if (!/view open positions/i.test(stripTags(contents))) continue

    const normalizedUrl = canonicalizeGreenhouseBoardUrl(decodeRepeatedHtmlEntities(href))
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers \| Sonatus\s*<\/title>/i.test(page)
    && /Build the AI/i.test(page)
    && /behind Smart Vehicles/i.test(page)
    && /India/i.test(page)
    && /New Delhi/i.test(page)
    && extractOfficialGreenhouseBoardUrl(page) === GREENHOUSE_BOARD_URL
}

export const hasVerifiedGreenhouseBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at Sonatus\s*<\/title>/i.test(page)
    && /Current openings at Sonatus/i.test(page)
    && /software-defined vehicles/i.test(page)
    && /Talent Community/i.test(page)
    && /Pune,\s*India/i.test(page)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== `/sonatus/jobs/${canonicalJobId}`) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const normalizeGreenhouseApplyUrl = (value, jobId) => {
  const canonicalUrl = normalizeGreenhouseJobUrl(value, jobId)
  if (!canonicalUrl) return null
  return `${canonicalUrl}#application`
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Sonatus India Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => !isTalentCommunityProspect(job))
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const applyUrl = normalizeGreenhouseApplyUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Sonatus India Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !link || !applyUrl || !title) {
        throw new Error('Sonatus India Greenhouse payload no longer exposes the verified Greenhouse job detail handoff')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        link,
        applyUrl,
        sourceUrl: link,
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
    Referer: GREENHOUSE_BOARD_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSonatusIndiaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Sonatus India verified Sonatus careers page no longer matches the official first-party surface')
    }

    const greenhouseBoardHtml = await fetchText(GREENHOUSE_BOARD_URL)
    if (!hasVerifiedGreenhouseBoardSignal(greenhouseBoardHtml)) {
      throw new Error('Sonatus India verified Sonatus Greenhouse board no longer matches the official public jobs surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createSonatusIndiaScraper(options).run(options)

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
