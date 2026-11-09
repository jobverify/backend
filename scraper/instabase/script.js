import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { INSTABASE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = INSTABASE_CATALOG.source
export const COMPANY = INSTABASE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = INSTABASE_CATALOG.officialBrandName
export const CAREERS_URL = INSTABASE_CATALOG.officialCareersLandingUrl
export const JOBS_PAGE_URL = INSTABASE_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_URL = INSTABASE_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = INSTABASE_CATALOG.greenhouseJobsApiUrl
export const PROVIDER_METADATA = INSTABASE_CATALOG

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
  if (/(?:^|,\s*)India(?:$|[\s,)(-])/i.test(normalized)) return true

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
  if (countryMetadata?.toLowerCase() === 'india') return primaryLocation || 'India'

  return null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [location, ...officeLocations, stripTags(decodedDescription)]
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

  return /Empowering AI for all/i.test(page)
    && /View Open Positions/i.test(page)
    && /href=["']\/careers\/jobs["']/i.test(page)
    && /(?:Why Instabase|Benefits and perks|Urgency of now)/i.test(page)
    && /Bengaluru/i.test(page)
}

export const hasVerifiedJobsPageSignal = (html) => {
  const page = String(html ?? '')

  return /Open positions/i.test(page)
    && /job-boards\.greenhouse\.io\/instabase\/jobs\/\d+/i.test(page)
    && /Apply Now/i.test(page)
    && /Load More/i.test(page)
  }

const inferExperienceRequired = (decodedDescription) => {
  const { experienceProfile } = extractJobFilterSignals({
    jobDescription: decodedDescription,
  })

  if (experienceProfile?.confidence !== 'high' || !normalizeWhitespace(experienceProfile.evidence)) {
    return null
  }

  return normalizeWhitespace(experienceProfile.evidence)?.replace(/\s*-\s*/g, '-')
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== `/instabase/jobs/${canonicalJobId}`) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

const normalizeGreenhouseApplyUrl = (value, jobId) => {
  const canonicalUrl = normalizeGreenhouseJobUrl(value, jobId)
  return canonicalUrl ? `${canonicalUrl}#application` : null
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Instabase Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
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
      const experienceRequired = inferExperienceRequired(decodedDescription)

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Instabase Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !link || !applyUrl || !title) {
        throw new Error('Instabase Greenhouse payload no longer exposes the verified Greenhouse detail and apply URLs')
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
        experienceRequired,
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
    Referer: JOBS_PAGE_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInstabaseScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Instabase verified first-party careers landing page no longer matches the official surface')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasVerifiedJobsPageSignal(jobsPageHtml)) {
      throw new Error('Instabase verified first-party jobs page no longer matches the official surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createInstabaseScraper(options).run(options)

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
