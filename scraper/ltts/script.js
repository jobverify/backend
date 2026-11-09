import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const API_BASE_URL = 'https://ltts.sensehq.com/careers/iframe'
export const CAREER_PAGE_URL = 'https://www.ltts.com/careers/India'

const INDIA_CITIES = new Set([
  'bangalore',
  'bengaluru',
  'chennai',
  'delhi',
  'hyderabad',
  'mumbai',
  'mysore',
  'pune',
  'vadodara',
])

const NEXT_DATA_MARKER = '<script id="__NEXT_DATA__" type="application/json">'

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
    throw new Error('Unable to locate LTTS __NEXT_DATA__ payload')
  }

  const jsonStart = start + NEXT_DATA_MARKER.length
  const jsonEnd = String(html).indexOf('</script>', jsonStart)
  if (jsonEnd < 0) {
    throw new Error('Unable to locate LTTS __NEXT_DATA__ closing tag')
  }

  return JSON.parse(String(html).slice(jsonStart, jsonEnd))
}

const toIsoDate = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const buildLocation = (record = {}) => {
  const city = normalizeWhitespace(record.office?.city || record.location)
  if (!city) return { location: null, city: null }

  if (/india/i.test(city)) {
    return { location: city, city: null }
  }

  const cleanCity = normalizeWhitespace(city.split(',')[0])
  if (!cleanCity) return { location: null, city: null }

  return {
    location: `${cleanCity}, India`,
    city: cleanCity,
  }
}

const isIndiaJob = (record = {}) => {
  const department = normalizeWhitespace(record.department)?.toLowerCase()
  if (department === 'ltts india') return true

  const locationValues = [
    normalizeWhitespace(record.location),
    normalizeWhitespace(record.office?.city),
    normalizeWhitespace(record.office?.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return [...INDIA_CITIES].some((city) => locationValues.includes(city))
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toUpperCase()
  if (!normalized) return null

  if (normalized === 'FULLTIME') return 'Full-time'
  if (normalized === 'PARTTIME') return null
  if (normalized === 'CONTRACT') return 'Contract'
  if (normalized === 'INTERNSHIP' || normalized === 'INTERN') return 'Internship'
  return normalizeWhitespace(value)
}

const extractExperience = (description) => {
  const normalized = stripHtml(description)
  if (!normalized) return null

  const match = normalized.match(/\bExperience\s*:?\s*([0-9]+\s*-\s*[0-9]+\s*Years?)\b/i)
  if (match) return normalizeWhitespace(match[1])

  const yearsMatch = normalized.match(/\b([0-9]+\s*-\s*[0-9]+\s*years?)\b/i)
  return yearsMatch ? normalizeWhitespace(yearsMatch[1]) : null
}

const extractSkills = (description) => {
  const normalized = stripHtml(description)
  if (!normalized) return []

  const match = normalized.match(/\bKey Skills\s*:?\s*([^:]+?)(?:Responsibilities|Qualification|$)/i)
  if (!match) return []

  return [...new Set(
    match[1]
      .split(',')
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean),
  )]
}

export const buildListingUrl = ({ page = 1 } = {}) =>
  `${API_BASE_URL}/jobs?page=${page}&isIframe=true`

export const buildJobUrl = (jobId) =>
  `${API_BASE_URL}/jobs/${normalizeWhitespace(jobId)}?isIframe=true`

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

export const extractSearchResults = (html) => {
  const payload = extractNextDataPayload(html)
  const rows = Array.isArray(payload?.props?.pageProps?.jobsData?.rows)
    ? payload.props.pageProps.jobsData.rows
    : []

  return rows
    .filter((record) => normalizeWhitespace(record.job_status)?.toUpperCase() === 'OPEN')
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const jobDescription = stripHtml(record.description_external)
      const { location, city } = buildLocation(record)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = buildJobUrl(jobId)

      if (!jobId || !sourceUrl) return null

      return {
        title: normalizeWhitespace(record.title),
        company: 'LTTS',
        department: normalizeWhitespace(record.department),
        location,
        city,
        jobId,
        requisitionId: normalizeWhitespace(record.code) || jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.job_type),
        experienceRequired: extractExperience(record.description_external),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractSkills(record.description_external),
        postingDate: toIsoDate(record.created_on),
        closingDate: null,
        jobDescription,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createLttsScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildListingUrl({ page }))
      const pageJobs = extractSearchResults(html)
      const summary = extractPaginationSummary(html)

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)

        jobs.push({
          ...job,
          source: 'ltts',
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext) {
        break
      }
    }

    return jobs
  },
})

export const run = async () => createLttsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running LTTS scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'ltts')
    console.log('DB result:', result)
    process.exit(0)
  }
}
