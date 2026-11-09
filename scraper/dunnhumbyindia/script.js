import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { DUNNHUMBY_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DUNNHUMBY_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const WORK_WITH_US_URL = PROVIDER_METADATA.companyCareerPage
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
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
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

const normalizeText = (value) => normalizeWhitespace(decodeRepeatedHtmlEntities(value))

const stripTags = (value) =>
  normalizeWhitespace(
    decodeRepeatedHtmlEntities(value)
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

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
    Referer: WORK_WITH_US_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeText(office?.location))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => Boolean(
  getValidIndiaCityForJob({
    location: normalizeText(value),
    locations: officeLocations,
  }),
)

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeText(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  return officeLocations.find((value) => looksLikeIndiaLocation(value, officeLocations)) || null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeText(location)?.split(',')[0]?.trim()
  return normalizeCity(firstToken || location)
}

const inferRemoteStatus = ({ location, officeLocations, description }) => {
  const haystack = [location, ...officeLocations, description].filter(Boolean).join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeText(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(String(value ?? ''))
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/dunnhumby/jobs/${canonicalJobId}`

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const buildGreenhouseApplyUrl = (value, jobId) => {
  const sourceUrl = normalizeGreenhouseJobUrl(value, jobId)
  return sourceUrl ? `${sourceUrl}#application` : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at dunnhumby\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.dunnhumby\.com\/careers\/["']/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.dunnhumby\.com\/careers\/["']/i.test(page)
    && /Careers at dunnhumby/i.test(page)
    && /See open positions/i.test(page)
    && /href=["']\/work-with-us\/["']/i.test(page)
}

export const hasWorkWithUsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Work With Us\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.dunnhumby\.com\/work-with-us\/["']/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.dunnhumby\.com\/work-with-us\/["']/i.test(page)
    && /Latest roles/i.test(page)
    && /See open positions/i.test(page)
    && new RegExp(`href=["']${GREENHOUSE_BOARD_URL}["']`, 'i').test(page)
}

export const hasVerifiedGreenhouseBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at dunnhumby\s*<\/title>/i.test(page)
    && /Shape your future, discover new opportunities at dunnhumby/i.test(page)
    && /Powered by/i.test(page)
    && /Greenhouse/i.test(page)
    && /Office/i.test(page)
    && /"name":"dunnhumby"/i.test(page)
    && /"public_url":"https:\/\/job-boards\.greenhouse\.io\/dunnhumby"/i.test(page)
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Dunnhumby India Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const applyUrl = buildGreenhouseApplyUrl(job?.absolute_url, job?.id)
      const title = normalizeText(job?.title)
      const companyName = normalizeText(job?.company_name)
      const department = normalizeText(job?.departments?.[0]?.name)
      const jobDescription = stripTags(job?.content)

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Dunnhumby India Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !link || !applyUrl || !title) {
        throw new Error('Dunnhumby India Greenhouse payload no longer exposes the verified India job detail URLs')
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
        requisitionId: normalizeText(job?.requisition_id),
        department,
        employmentType: null,
        experienceRequired: null,
        jobDescription: jobDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeText(job?.updated_at || job?.first_published),
        remoteStatus: inferRemoteStatus({
          location,
          officeLocations,
          description: jobDescription,
        }),
        scrapedAt,
      }
    })
}

export const createDunnhumbyIndiaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasOfficialCareersSignal(careersLandingHtml)) {
      throw new Error('Dunnhumby India verified Dunnhumby careers landing page no longer matches the official first-party surface')
    }

    const workWithUsHtml = await fetchText(WORK_WITH_US_URL)
    if (!hasWorkWithUsSignal(workWithUsHtml)) {
      throw new Error('Dunnhumby India verified Dunnhumby work-with-us page no longer matches the official first-party surface')
    }

    const greenhouseBoardHtml = await fetchText(GREENHOUSE_BOARD_URL)
    if (!hasVerifiedGreenhouseBoardSignal(greenhouseBoardHtml)) {
      throw new Error('Dunnhumby India verified Dunnhumby Greenhouse board no longer matches the trusted ATS surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createDunnhumbyIndiaScraper(options).run(options)

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
