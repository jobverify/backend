import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { SUMO_LOGIC_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SUMO_LOGIC_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_MARKDOWN_URL = PROVIDER_METADATA.careersMarkdownUrl
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

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

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ officeRequirement, location, officeLocations, description }) => {
  const preferredValue = normalizeWhitespace(officeRequirement)
  if (/^hybrid$/i.test(preferredValue)) return 'Hybrid'
  if (/^remote$/i.test(preferredValue)) return 'Remote'
  if (/^(on-site|onsite)$/i.test(preferredValue)) return 'On-site'

  const haystack = [location, ...officeLocations, description]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  return 'On-site'
}

const toDateOnly = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] || null
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Searching for a genuine career opportunity\?\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.sumologic\.com\/company\/careers["']/i.test(page)
    && /Find openings and internship opportunities\./i.test(page)
    && normalized.includes('Work With Us')
    && normalized.includes('Help make the digital world faster, reliable, and secure')
}

export const hasOfficialCareersMarkdownSignal = (markdown = '') => {
  const page = String(markdown ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /url:\s*"https:\/\/www\.sumologic\.com\/company\/careers"/i.test(page)
    && /canonical:\s*"https:\/\/www\.sumologic\.com\/company\/careers"/i.test(page)
    && /markdown_url:\s*"https:\/\/www\.sumologic\.com\/company\/careers\.md"/i.test(page)
    && /Find openings and internship opportunities\./i.test(page)
    && normalized.includes('Work With Us')
    && normalized.includes('Help make the digital world faster, reliable, and secure')
    && /\[View openings\]\(#openings\)/i.test(page)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPath = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPath !== `/sumologic/jobs/${canonicalJobId}`) return null

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
    throw new Error('Sumo Logic Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const description = stripTags(decodeRepeatedHtmlEntities(job?.content))
      const officeRequirement = extractMetadataValue(job, 'Office Requirement')

      if (!companyName || companyName.toLowerCase() !== COMPANY.toLowerCase()) {
        throw new Error('Sumo Logic Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !link || !title) {
        throw new Error('Sumo Logic Greenhouse payload no longer exposes the verified India job detail contract')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        sourceUrl: link,
        applyUrl: link,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toDateOnly(job?.first_published || job?.updated_at),
        closingDate: null,
        jobDescription: description || null,
        remoteStatus: inferRemoteStatus({
          officeRequirement,
          location,
          officeLocations,
          description,
        }),
        source: SOURCE,
        link,
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

export const createSumoLogicScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Sumo Logic careers page no longer matches the trusted first-party surface')
    }

    const careersMarkdown = await fetchText(CAREERS_MARKDOWN_URL)
    if (!hasOfficialCareersMarkdownSignal(careersMarkdown)) {
      throw new Error('The verified Sumo Logic careers markdown no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    ).map((job) => ({
      ...job,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createSumoLogicScraper(options).run(options)

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
