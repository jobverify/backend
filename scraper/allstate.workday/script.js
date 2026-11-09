import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

const DEFAULT_CALLBACK_NAME = 'jobverifyAllstateCallback'
const DEFAULT_SORT_FIELD = 'open_date'
const DEFAULT_SORT_ORDER = 'descending'
const DEFAULT_PAGE_SIZE = 10

export const SOURCE = 'allstate'
export const COMPANY = 'Allstate'
export const JOBS_SEARCH_URL = 'https://www.allstate.jobs/job-search-results/'
export const JOBS_API_URL = 'https://jobsapi-internal.m-cloud.io/api/job'
export const DEFAULT_ORGANIZATION_ID = '2030'
export const DEFAULT_FILTERS = [
  'ats_portalid:Workday-MuleAPI-External',
  'is_internal:allstate_careers',
]
export const INDIA_FACET = 'compliment:India'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractJsonObjectAfterMarker = (value, marker) => {
  const source = String(value ?? '')
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null

  const start = source.indexOf('{', markerIndex + marker.length)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escapeNext = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escapeNext) {
        escapeNext = false
      } else if (char === '\\') {
        escapeNext = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  return null
}

const parseJson = (value) => {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJsonpText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,*/*;q=0.9',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const normalizeCountry = (record = {}) => {
  const compliment = normalizeWhitespace(record.compliment)
  if (compliment) return compliment

  const countryCode = normalizeWhitespace(record.primary_country)
  if (countryCode?.toUpperCase() === 'IN') return 'India'

  return countryCode || null
}

const normalizeLocation = (record = {}) => {
  const parts = [
    normalizeWhitespace(record.primary_city),
    normalizeWhitespace(record.primary_state),
    normalizeCountry(record),
  ].filter(Boolean)

  return parts.join(', ') || null
}

const extractExperienceRequired = (description) => {
  const text = stripTags(description)
  if (!text) return null

  const matched = text.match(
    /\b(Minimum\s+\d+\s+years?\s+of\s+experience|\d+\s+or\s+more\s+years?\s+of\s+experience)\b/i,
  )

  return matched ? normalizeWhitespace(matched[1]) : null
}

const extractMinimumQualification = (description) => {
  const text = decodeHtmlEntities(String(description ?? ''))
  if (!text) return null

  const matched = text.match(/\b(Bachelor'?s degree[^<\n\r.]*)/i)
  return matched ? normalizeWhitespace(matched[1]) : null
}

export const hasVerifiedSearchPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Allstate Job Search \| Jobs Near Me(?: &amp;| &) Remote \| Allstate Careers\s*<\/title>/i.test(page)
    && normalized.includes('Open Jobs')
    && normalized.includes('jobsapi-internal.m-cloud.io/api/')
    && normalized.includes('org_id: "2030"')
    && normalized.includes('ats_portalid:Workday-MuleAPI-External')
    && normalized.includes('is_internal:allstate_careers')
    && normalized.includes('value="India"')
}

export const extractSearchConfiguration = (html = '') => {
  const page = String(html ?? '')
  const cwsOptions = parseJson(extractJsonObjectAfterMarker(page, 'var cws_opts = '))
  const apiBaseUrl = normalizeWhitespace(
    extractFirst(/CWS\.jobs\.set_api\("([^"]+)"\)/i, page)
      || cwsOptions?.api,
  )
  const organizationId = normalizeWhitespace(
    extractFirst(/org_id:\s*"([^"]+)"/i, page)
      || cwsOptions?.org,
  ) || DEFAULT_ORGANIZATION_ID
  const limit = Number.parseInt(extractFirst(/limit:\s*(\d+)/i, page), 10) || DEFAULT_PAGE_SIZE
  const filters = [...String(page).matchAll(/"(ats_portalid:[^"]+|is_internal:[^"]+)"/g)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  return {
    apiBaseUrl: apiBaseUrl || 'https://jobsapi-internal.m-cloud.io/api/',
    organizationId,
    filters: filters.length ? filters : [...DEFAULT_FILTERS],
    limit,
  }
}

export const buildJobsApiUrl = ({
  apiBaseUrl = 'https://jobsapi-internal.m-cloud.io/api/',
  organizationId = DEFAULT_ORGANIZATION_ID,
  filters = [...DEFAULT_FILTERS, INDIA_FACET],
  limit = DEFAULT_PAGE_SIZE,
  offset = 1,
  sortField = DEFAULT_SORT_FIELD,
  sortOrder = DEFAULT_SORT_ORDER,
  callbackName = DEFAULT_CALLBACK_NAME,
} = {}) => {
  const url = new URL('job', apiBaseUrl)
  url.searchParams.append('Organization', String(organizationId))
  url.searchParams.append('Limit', String(limit))
  url.searchParams.append('offset', String(offset))
  url.searchParams.append('sortfield', sortField)
  url.searchParams.append('sortorder', sortOrder)

  for (const filter of filters) {
    url.searchParams.append('facet', filter)
  }

  url.searchParams.append('callback', callbackName)
  return url.toString()
}

export const extractJsonpPayload = (value = '') => {
  const matched = String(value ?? '').match(/^[\w$.]+\(([\s\S]*)\)\s*;?\s*$/)
  if (!matched) {
    throw new Error('Allstate jobs API returned an unexpected JSONP payload')
  }

  const payload = parseJson(matched[1])
  if (!payload || typeof payload !== 'object') {
    throw new Error('Allstate jobs API returned an unreadable JSONP payload')
  }

  return payload
}

const mapJob = (record = {}, now = () => new Date().toISOString()) => ({
  title: normalizeWhitespace(record.title),
  company: COMPANY,
  department: normalizeWhitespace(record.primary_category || record.brand),
  location: normalizeLocation(record),
  city: normalizeWhitespace(record.primary_city),
  country: normalizeCountry(record),
  jobId: normalizeWhitespace(record.ref || record.clientid),
  requisitionId: normalizeWhitespace(record.ref || record.clientid),
  link: normalizeWhitespace(record.seo_url || record.url),
  applyUrl: normalizeWhitespace(record.seo_url || record.url),
  sourceUrl: normalizeWhitespace(record.url || record.seo_url),
  source: SOURCE,
  employmentType: normalizeWhitespace(record.employment_type),
  experienceRequired: extractExperienceRequired(record.description),
  publicExperienceChecked: true,
  jobDescription: stripTags(record.description),
  minimumQualification: extractMinimumQualification(record.description),
  preferredQualification: null,
  requiredSkills: [],
  postingDate: normalizeWhitespace(record.open_date),
  scrapedAt: now(),
})

export const createAllstateScraper = ({
  now = () => new Date().toISOString(),
  pageSize = DEFAULT_PAGE_SIZE,
  callbackName = DEFAULT_CALLBACK_NAME,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJsonpText = defaultFetchJsonpText,
  } = {}) {
    const searchPageHtml = await fetchText(JOBS_SEARCH_URL)
    if (!hasVerifiedSearchPageSignal(searchPageHtml)) {
      throw new Error('Allstate verified public job-search page no longer matches the trusted first-party surface')
    }

    const config = extractSearchConfiguration(searchPageHtml)
    const effectivePageSize = Number.isInteger(pageSize) && pageSize > 0
      ? pageSize
      : (config.limit || DEFAULT_PAGE_SIZE)
    const filters = [...config.filters]
    if (!filters.includes(INDIA_FACET)) {
      filters.push(INDIA_FACET)
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 1
    let totalHits = Number.POSITIVE_INFINITY

    while (offset <= totalHits) {
      const jobsApiUrl = buildJobsApiUrl({
        apiBaseUrl: config.apiBaseUrl,
        organizationId: config.organizationId,
        filters,
        limit: effectivePageSize,
        offset,
        callbackName,
      })

      const payload = extractJsonpPayload(await fetchJsonpText(jobsApiUrl))
      const records = Array.isArray(payload.queryResult) ? payload.queryResult : []
      totalHits = Number(payload.totalHits) || 0

      if (records.length === 0) break

      for (const record of records) {
        const jobId = normalizeWhitespace(record.ref || record.clientid)
        if (!jobId || seenJobIds.has(jobId)) continue
        seenJobIds.add(jobId)
        jobs.push(mapJob(record, now))
      }

      if (records.length < effectivePageSize) break
      offset += effectivePageSize
    }

    return jobs
  },
})

export const run = async (options = {}) => createAllstateScraper(options).run(options)

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
