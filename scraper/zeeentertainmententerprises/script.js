import path from 'path'
import { fileURLToPath } from 'url'

import { runZeeNative } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zeeentertainmententerprises'
export const COMPANY = 'Zee Entertainment Enterprises Limited'
export const ABOUT_URL = 'https://www.zee.com/about-us/'
export const CAREERS_URL = 'https://www.zee.com/careers/'
export const API_BASE_URL = 'https://zee.sensehq.com/careers'

const NEXT_DATA_MARKER = '<script id="__NEXT_DATA__" type="application/json">'
const OFFICIAL_ABOUT_SIGNAL = /global content and technology powerhouse|forefront of innovation|zee entertainment enterprises limited/i
const OFFICIAL_CAREERS_SIGNAL = /being the sky to a thousand stars|search by function|search by location|zee entertainment enterprises limited/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

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
    throw new Error('Unable to locate Zee __NEXT_DATA__ payload')
  }

  const jsonStart = start + NEXT_DATA_MARKER.length
  const jsonEnd = String(html).indexOf('</script>', jsonStart)
  if (jsonEnd < 0) {
    throw new Error('Unable to locate Zee __NEXT_DATA__ closing tag')
  }

  return JSON.parse(String(html).slice(jsonStart, jsonEnd))
}

const toIsoDate = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export const hasOfficialAboutPageSignal = (html) => OFFICIAL_ABOUT_SIGNAL.test(String(html ?? ''))

export const hasOfficialCareersPageSignal = (html) => OFFICIAL_CAREERS_SIGNAL.test(String(html ?? ''))

export const extractSenseHqCareersUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/zee\.sensehq\.com\/careers)["']/i)
  return normalizeWhitespace(match?.[1] || null)
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
    normalizeWhitespace(record.office?.location),
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
  const html = String(description ?? '')
  const blockMatch = html.match(
    /<(?:p|div)[^>]*>\s*<(?:strong|b)[^>]*>\s*Skills\s*:?\s*<\/(?:strong|b)>\s*([^<]+?)\s*<\/(?:p|div)>/i,
  )
  const rawSkills = normalizeWhitespace(blockMatch?.[1])

  if (!rawSkills) return []

  return [...new Set(
    rawSkills
      .split(',')
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean),
  )]
}

export const buildListingUrl = ({ page = 1 } = {}) =>
  page > 1 ? `${API_BASE_URL}/jobs?page=${page}` : `${API_BASE_URL}/jobs`

export const buildJobUrl = (jobId) =>
  `${API_BASE_URL}/jobs/${normalizeWhitespace(jobId)}`

export const extractPaginationSummary = (html) => {
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

export const mapZeeRecord = (record) => {
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
        publicExperienceChecked: true,
      }
}

export const extractSearchResults = (html) => {
  const payload = extractNextDataPayload(html)
  const rows = Array.isArray(payload?.props?.pageProps?.jobsData?.rows)
    ? payload.props.pageProps.jobsData.rows : []
  return rows.filter(record => normalizeWhitespace(record.job_status)?.toUpperCase() === 'OPEN')
    .filter(isIndiaJob).map(mapZeeRecord).filter(Boolean)
}

export const createZeeEntertainmentEnterprisesScraper = ({
  maxPages = 50,
  maxJobs = 500,
} = {}) => ({
  async run(options = {}) {
    return runZeeNative({ maxPages, maxJobs, mapRecord: mapZeeRecord }, options)
  },
})

export const run = async (options = {}) => createZeeEntertainmentEnterprisesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Zee Entertainment Enterprises scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
