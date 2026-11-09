import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'quantboxresearch'
export const COMPANY = 'Quantbox Research'
export const OFFICIAL_BRAND_NAME = 'Quantbox'
export const VERIFIED_ON = '2026-08-04'
export const CAREERS_URL = 'https://www.quantboxresearch.com/careers'
export const APEX_CAREERS_URL = 'https://quantboxresearch.com/careers'
export const GREENHOUSE_BOARD_URL = 'https://job-boards.eu.greenhouse.io/quantboxresearchpte'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/quantboxresearchpte/jobs'
export const GREENHOUSE_JOBS_API_WITH_CONTENT_URL = `${GREENHOUSE_JOBS_API_URL}?content=true`
export const GREENHOUSE_JOB_BASE_URL = `${GREENHOUSE_BOARD_URL}/jobs`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
  .replace(/&mdash;|&#8212;|&#x2014;/gi, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtml(current)
    if (decoded === current) break
    current = decoded
  }

  return current
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeRepeatedHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section)>/gi, ' ')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeVisibleText = (value) => stripTags(value)?.toLowerCase() || ''

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? '')
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoPrefixMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefixMatch) {
    return isoPrefixMatch[1]
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalizeCity(normalized.split(',')[0] || normalized)
}

const extractIndiaLocationSegment = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const segments = normalized
    .split(';')
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)

  if (segments.length === 0) {
    return /\bindia\b/i.test(normalized) ? normalized : null
  }

  return segments.find((segment) => /\bindia\b/i.test(segment)) || null
}

const extractIndiaOfficeLocation = (job = {}) => {
  const officeLocations = Array.isArray(job?.offices)
    ? job.offices
      .map((office) => extractIndiaLocationSegment(office?.location))
      .filter(Boolean)
    : []

  return officeLocations[0] || extractIndiaLocationSegment(job?.location?.name)
}

const extractListItems = (value) => [...decodeRepeatedHtmlEntities(String(value ?? '')).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const isIndiaJob = (job = {}) => Boolean(extractIndiaOfficeLocation(job))

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  if (!normalizedJobId) return null

  try {
    const url = new URL(String(value ?? ''))
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/quantboxresearchpte/jobs/${normalizedJobId}`

    if (normalizedHost !== 'job-boards.eu.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_JOB_BASE_URL}/${normalizedJobId}`
  } catch {
    return null
  }
}

const hasActiveGreenhouseHandoff = (html) => readNativeDocument(html)
  .nodes((node) => node.tag === 'a' && node.attrs.href)
  .some((node) => {
    try {
      const target = new URL(node.attrs.href, APEX_CAREERS_URL)
      return !target.username && !target.password && !target.search && !target.hash
        && target.href === GREENHOUSE_BOARD_URL
    } catch {
      return false
    }
  })

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeVisibleText(page)
  const title = extractTitle(page)

  return title === 'Careers - Quantbox'
    && normalized.includes('build what markets need next.')
    && normalized.includes('see open roles')
    && normalized.includes('current openings are listed below.')
    && normalized.includes("stay connected for what's next")
    && normalized.includes('quantbox recruiting messages will come through our official channels.')
    && hasActiveGreenhouseHandoff(page)
}

export const extractJobsFromGreenhousePayload = (payload = {}) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Quantbox Research Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter(isIndiaJob)
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const location = extractIndiaOfficeLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const companyName = normalizeWhitespace(job?.company_name)
      const jobDescription = stripTags(decodeRepeatedHtmlEntities(job?.content))

      if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
        throw new Error('Quantbox Research Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!title || !location || !sourceUrl) {
        throw new Error('Quantbox Research Greenhouse payload no longer exposes the verified public job detail URLs')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: String(job?.id ?? ''),
        requisitionId: normalizeWhitespace(job?.requisition_id),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractListItems(job?.content),
        postingDate: normalizeDate(job?.first_published || job?.updated_at),
        closingDate: normalizeDate(job?.application_deadline),
        jobDescription,
      }
    })
}

const defaultFetchText = (url, { redirect } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  ...(redirect ? { redirect } : {}),
})

const isExpiredCertificateError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current.code === 'CERT_HAS_EXPIRED') return true
    current = current.cause
  }

  return false
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: GREENHOUSE_BOARD_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createQuantboxResearchScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!isExpiredCertificateError(error)) throw error
      careersHtml = await fetchText(APEX_CAREERS_URL, { redirect: 'error' })
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Quantbox Research careers page no longer matches the verified first-party public jobs surface')
    }

    const jobs = extractJobsFromGreenhousePayload(await fetchJson(GREENHOUSE_JOBS_API_WITH_CONTENT_URL))

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createQuantboxResearchScraper().run(options)

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
