import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { XOXODAY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const KEKA_CAREERS_URL = PROVIDER_METADATA.kekaCareerPageUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const KEKA_IDENTIFIER = PROVIDER_METADATA.kekaIdentifier

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeComparableUrl = (value) => String(value ?? '').replace(/\/$/, '')

const buildJobDetailUrl = (jobId) => `${normalizeComparableUrl(KEKA_CAREERS_URL)}/jobdetails/${jobId}`
const buildApplyUrl = (jobId) => `${normalizeComparableUrl(KEKA_CAREERS_URL)}/applyjob/${jobId}`

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const mapJobType = (value) => {
  const numeric = Number(value)
  if (numeric === 1) return 'Part Time'
  if (numeric === 2) return 'Full Time'
  if (numeric === 3) return 'Contract'
  return normalizeText(value)
}

const buildLocation = (location = {}) => {
  const parts = [
    normalizeText(location.city),
    normalizeText(location.state),
    normalizeText(location.countryName),
  ].filter(Boolean)

  if (parts.length === 0) {
    return normalizeText(location.name)
  }

  return [...new Set(parts)].join(', ')
}

const inferCountry = (location = {}) =>
  normalizeText(location.countryName)
  || normalizeText(location.name)?.split(',').pop()?.trim()
  || null

const inferCity = (location = {}) => {
  const cityValue = normalizeText(location.city) || normalizeText(location.name)
  if (!cityValue) return null
  return normalizeCity(cityValue) || cityValue
}

const normalizePostingDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes("See who we're hiring right now.")
    && normalized.includes('Live listings, straight from our applicant tracking system.')
    && normalized.includes('Explore roles shaping the future of rewards')
}

export const hasVercelSecurityCheckpointSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Vercel Security Checkpoint\s*<\/title>/i.test(page)
    && normalized.includes('Vercel Security Checkpoint')
}

export const hasKekaShellSignal = (html = '') =>
  new RegExp(`/ats/documents/${KEKA_IDENTIFIER}/careerportal/`, 'i').test(String(html ?? ''))

export const extractJobsFromKekaPayload = (payload = []) => (Array.isArray(payload) ? payload : [])
  .map((job) => {
    const title = normalizeText(job.title)
    const jobId = normalizeText(job.id)
    const primaryLocation = Array.isArray(job.jobLocations) ? job.jobLocations[0] : null
    if (!title || !jobId || !primaryLocation) return null

    const location = buildLocation(primaryLocation)
    const country = inferCountry(primaryLocation)

    return {
      title,
      jobId: `${SOURCE}-${jobId}`,
      requisitionId: jobId,
      sourceUrl: buildJobDetailUrl(jobId),
      applyUrl: buildApplyUrl(jobId),
      location,
      city: inferCity(primaryLocation),
      country,
      department: normalizeText(job.departmentName),
      employmentType: mapJobType(job.jobType),
      workplaceType: /remote/i.test(location || '') ? 'Remote' : null,
      experienceRequired: normalizeText(job.experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: Array.isArray(job.skillNames)
        ? job.skillNames.map((skill) => normalizeText(skill)).filter(Boolean)
        : [],
      compensation: normalizeText(job.salaryRangeFormat),
      postingDate: normalizePostingDate(job.publishedOn),
      closingDate: null,
      openingsCount: null,
      jobDescription: stripTags(job.description || job.excerpt),
      companyCareerPage: CAREERS_URL,
    }
  })
  .filter(Boolean)
  .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createXoxodayScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage, fetchText, fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const loadPage = async (url) => {
      if (typeof fetchPage === 'function') {
        return fetchPage(url)
      }

      if (typeof fetchText === 'function') {
        return {
          status: 200,
          url,
          html: await fetchText(url),
        }
      }

      return defaultFetchPage(url)
    }

    const careersPage = await loadPage(CAREERS_URL)
    const careersHtml = String(careersPage.html ?? '')
    const careersPageBlocked =
      Number(careersPage.status) === 429
      && String(careersPage.url || CAREERS_URL) === CAREERS_URL
      && hasVercelSecurityCheckpointSignal(careersHtml)

    if (!careersPageBlocked && !hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Xoxoday verified first-party careers page changed materially')
    }

    const kekaShellHtml = String((await loadPage(KEKA_CAREERS_URL)).html ?? '')
    if (!hasKekaShellSignal(kekaShellHtml)) {
      throw new Error('Xoxoday verified public Keka shell changed materially')
    }

    const jobs = extractJobsFromKekaPayload(await fetchJson(JOBS_API_URL))
    if (jobs.length === 0) {
      throw new Error('Xoxoday verified public Keka jobs payload no longer exposes openings')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createXoxodayScraper().run(options)

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
