import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOADSHARE_NETWORKS_CATALOG } from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = LOADSHARE_NETWORKS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ROOT_CAREERS_URL = PROVIDER_METADATA.rootCareersUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_BOARD_URL = PROVIDER_METADATA.publicBoardUrl
export const SAMPLE_JOB_URL = PROVIDER_METADATA.sampleJobUrl

const NEXT_DATA_MARKER = '<script id="__NEXT_DATA__" type="application/json">'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const ensureTrailingSlash = (value) => (
  String(value ?? '').endsWith('/') ? String(value ?? '') : `${String(value ?? '')}/`
)

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractNextDataPayload = (html) => {
  const start = String(html).indexOf(NEXT_DATA_MARKER)
  if (start < 0) {
    throw new Error('Unable to locate Loadshare Networks __NEXT_DATA__ payload')
  }

  const jsonStart = start + NEXT_DATA_MARKER.length
  const jsonEnd = String(html).indexOf('</script>', jsonStart)
  if (jsonEnd < 0) {
    throw new Error('Unable to locate Loadshare Networks __NEXT_DATA__ closing tag')
  }

  return JSON.parse(String(html).slice(jsonStart, jsonEnd))
}

const toIsoDate = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export const buildListingUrl = ({ page = 1 } = {}) =>
  page > 1 ? `${PUBLIC_BOARD_URL}?page=${page}` : PUBLIC_BOARD_URL

export const buildJobUrl = (jobId) =>
  new URL(`jobs/${normalizeWhitespace(jobId)}`, ensureTrailingSlash(PUBLIC_BOARD_URL)).toString()

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*\|\s*LoadShare Networks\s*<\/title>/i.test(page)
    && /<meta\s+name=["']description["']\s+content=["']Jobs at Loadshare Networks["']/i.test(page)
    && /<base href=["']\/loadshare\/["']>/i.test(page)
    && /<app-root><\/app-root>/i.test(page)
  }

const isOfficialPageTimeoutError = (error) => {
  const seen = new Set()
  let current = error
  let sawFetchFailed = false
  let sawConnectTimeout = false

  while (current && !seen.has(current)) {
    seen.add(current)

    const message = String(current?.message ?? current)
    const causeCode = String(current?.code ?? '')
    if (/fetch failed/i.test(message)) sawFetchFailed = true
    if (/UND_ERR_CONNECT_TIMEOUT/i.test(causeCode)) sawConnectTimeout = true

    current = current?.cause
  }

  return sawFetchFailed && sawConnectTimeout
}

const isIndiaJob = (record = {}) => {
  const officeCountry = normalizeWhitespace(record.office?.country)
  if (officeCountry && officeCountry.toLowerCase() === 'india') return true

  const locationText = [
    normalizeWhitespace(record.location),
    normalizeWhitespace(record.office?.city),
    normalizeWhitespace(record.office?.name),
  ]
    .filter(Boolean)
    .join(' ')

  return /\bindia\b/i.test(locationText)
}

const buildLocation = (record = {}) => {
  const rawLocation = normalizeWhitespace(record.location || record.office?.city || record.office?.location)
  if (!rawLocation) return { location: null, city: null }

  const normalizedLocation = rawLocation
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join(', ')

  if (!normalizedLocation) return { location: null, city: null }

  return {
    location: /india/i.test(normalizedLocation)
      ? normalizedLocation
      : `${normalizedLocation}, India`,
    city: normalizeWhitespace(normalizedLocation.split(',')[0]) || null,
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null

  if (normalized === 'FULLTIME' || normalized === 'FULL_TIME') return 'Full-time'
  if (normalized === 'PARTTIME' || normalized === 'PART_TIME') return 'Part-time'
  if (normalized === 'CONTRACT') return 'Contract'
  if (normalized === 'INTERNSHIP' || normalized === 'INTERN') return 'Internship'
  return normalizeWhitespace(value)
}

const extractExperience = (record = {}, description) => {
  const start = Number(record.experience_start)
  const end = Number(record.experience_end)
  if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) {
    return `${start}-${end} years`
  }

  const normalized = stripHtml(description)
  if (!normalized) return null

  const match = normalized.match(/\b([0-9]+\s*-\s*[0-9]+\s*years?)\b/i)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractSkills = (description) => {
  const normalized = stripHtml(description)
  if (!normalized) return []

  const match = normalized.match(
    /\b(?:Key\s+)?Skills?\s*:?\s*(.+?)(?:\bResponsibilities?\b|\bOwn\b|\bBuild\b|\bLead\b|\bWhat\b|$)/i,
  )
  if (!match) return []

  return [...new Set(
    match[1]
      .split(',')
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean),
  )]
}

export const extractBoardSummary = (html) => {
  const payload = extractNextDataPayload(html)
  const rows = Array.isArray(payload?.props?.pageProps?.jobsData?.rows)
    ? payload.props.pageProps.jobsData.rows
    : []
  const totalCount = Number(payload?.props?.pageProps?.jobsData?.count) || 0
  const currentPage = Number.parseInt(payload?.query?.page || '1', 10) || 1
  const pageSize = rows.length || 1
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    hasNext: currentPage < totalPages,
  }
}

export const extractSearchResults = (html) => {
  const payload = extractNextDataPayload(html)
  const rows = Array.isArray(payload?.props?.pageProps?.jobsData?.rows)
    ? payload.props.pageProps.jobsData.rows
    : []

  return rows
    .filter((record) => normalizeWhitespace(record.job_status)?.toUpperCase() === 'OPEN')
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const jobId = normalizeWhitespace(record.id)
      if (!jobId) return null

      const sourceUrl = buildJobUrl(jobId)
      const { location, city } = buildLocation(record)

      return {
        title: normalizeWhitespace(record.title),
        company: COMPANY,
        department: normalizeWhitespace(record.department),
        location,
        city,
        jobId,
        requisitionId: normalizeWhitespace(record.code) || jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.job_type),
        experienceRequired: extractExperience(record, record.description_external),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractSkills(record.description_external),
        postingDate: toIsoDate(record.created_on),
        closingDate: null,
        jobDescription: stripHtml(record.description_external),
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'loadshare-networks-html',
  timeoutMs: 15000,
})

export const createLoadshareNetworksScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText

    try {
      const officialCareersHtml = await fetchText(OFFICIAL_CAREERS_URL)

      if (!hasOfficialCareersPageSignal(officialCareersHtml)) {
        throw new Error('Loadshare Networks careers page no longer matches the verified official public surface')
      }
    } catch (error) {
      if (!isOfficialPageTimeoutError(error)) {
        throw error
      }
    }

    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildListingUrl({ page }))
      const pageJobs = extractSearchResults(html)
      const summary = extractBoardSummary(html)

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createLoadshareNetworksScraper().run(options)

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
