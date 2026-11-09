import http from 'http'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_ROOT = 'https://careers.indegene.com/'
export const SEARCH_PAGE_URL = 'https://careers.indegene.com/search/?createNewAlert=false&q=&optionsFacetsDD_country=IN&optionsFacetsDD_customfield1=&locale=en_GB'
export const SEARCH_API_URL = 'https://careers.indegene.com/services/recruiting/v1/jobs'
export const COMPANY_NAME = 'Indegene'

const DEFAULT_LOCALE = 'en_GB'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 20000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

const INDIA_STATE_CODES = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DD: 'Daman and Diu',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Indegene scraper')
  }

  return parsed.toISOString()
}

const normalizeUrlTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'untitled'
  return encodeURI(normalized)
}

const getStateCode = (record = {}) => {
  const locationShort = Array.isArray(record.jobLocationShort) ? record.jobLocationShort[0] : null
  const stateCode = normalizeWhitespace(locationShort)?.split(',')[0]?.trim()?.toUpperCase() || null
  return /^[A-Z]{2,3}$/.test(stateCode || '') ? stateCode : null
}

const getState = (record = {}) => {
  const stateCode = getStateCode(record)
  if (!stateCode) return null
  return INDIA_STATE_CODES[stateCode] || stateCode
}

const isIndiaRecord = (record = {}) => {
  const indiaHints = [
    ...(Array.isArray(record.filter1) ? record.filter1 : []),
    ...(Array.isArray(record.jobLocationShort) ? record.jobLocationShort : []),
    ...(Array.isArray(record.Cust_Joblocation) ? record.Cust_Joblocation : []),
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(' ')

  return /india|\bIND\b/i.test(indiaHints)
}

const buildLocation = (state) => state ? `${state}, India` : 'India'

// On August 4, 2026 the public careers host served an expired certificate
// in this worker, so keep a source-local transport for the official search
// shell and jobs API.
const requestIndegeneText = (
  url,
  {
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = REQUEST_TIMEOUT_MS,
    redirectsRemaining = 5,
  } = {},
) => new Promise((resolve, reject) => {
  let urlObject

  try {
    urlObject = new URL(url)
  } catch (error) {
    reject(error)
    return
  }

  const requestHeaders = {
    'Accept-Encoding': 'identity',
    ...headers,
  }
  const bodyText = body == null ? null : String(body)
  if (bodyText != null && requestHeaders['Content-Length'] == null && requestHeaders['content-length'] == null) {
    requestHeaders['Content-Length'] = Buffer.byteLength(bodyText)
  }

  const transport = urlObject.protocol === 'http:' ? http : https
  const request = transport.request(urlObject, {
    method,
    headers: requestHeaders,
    rejectUnauthorized: urlObject.protocol === 'https:' ? true : undefined,
  }, (response) => {
    const status = Number(response.statusCode || 0)
    const location = response.headers.location

    if (location && REDIRECT_STATUSES.has(status)) {
      response.resume()

      if (redirectsRemaining <= 0) {
        reject(new Error(`Too many redirects for ${urlObject}`))
        return
      }

      const nextMethod = status === 303 ? 'GET' : method
      const nextBody = status === 303 ? null : bodyText
      const nextUrl = new URL(location, urlObject).toString()
      requestIndegeneText(nextUrl, {
        method: nextMethod,
        headers,
        body: nextBody,
        timeoutMs,
        redirectsRemaining: redirectsRemaining - 1,
      }).then(resolve, reject)
      return
    }

    const chunks = []
    response.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    response.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (status < 200 || status >= 300) {
        reject(new Error(`HTTP ${status} for ${urlObject}`))
        return
      }

      resolve({
        status,
        text,
        headers: response.headers,
      })
    })
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error(`HTTP timeout after ${timeoutMs}ms for ${urlObject}`))
  })
  request.on('error', reject)
  if (bodyText != null) {
    request.write(bodyText)
  }
  request.end()
})

export const buildSearchRequestPayload = (pageNumber = 0) => ({
  keywords: '',
  locale: DEFAULT_LOCALE,
  pageNumber,
  sortBy: 'recent',
})

export const buildDetailUrl = (urlTitle, jobId, locale = DEFAULT_LOCALE) =>
  new URL(`job/${normalizeUrlTitle(urlTitle)}/${encodeURIComponent(String(jobId))}/?locale=${locale}`, CAREERS_ROOT).toString()

export const extractSearchSummary = (payload) => ({
  totalJobCount: Number.isFinite(payload?.totalJobs) ? payload.totalJobs : null,
  pageSize: Array.isArray(payload?.jobSearchResult) ? payload.jobSearchResult.length : 0,
})

export const extractSearchResults = (payload) => {
  if (!Array.isArray(payload?.jobSearchResult)) return []

  return payload.jobSearchResult
    .map((entry) => entry?.response || null)
    .filter(Boolean)
    .filter(isIndiaRecord)
    .map((record) => {
      const title = normalizeWhitespace(record.unifiedStandardTitle)
      const jobId = normalizeWhitespace(record.id)
      const state = getState(record)
      const urlTitle = normalizeWhitespace(record.unifiedUrlTitle || record.urlTitle || title)

      if (!title || !jobId || !urlTitle) return null

      const detailUrl = buildDetailUrl(urlTitle, jobId)

      return {
        title,
        company: COMPANY_NAME,
        department: null,
        location: buildLocation(state),
        city: null,
        state,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.unifiedStandardStart),
        closingDate: normalizeWhitespace(record.unifiedStandardEnd),
        jobDescription: null,
        publicExperienceChecked: true,
      }
    })
    .filter(Boolean)
}

const fetchJson = async (url, options = {}) => JSON.parse(
  (
    await requestIndegeneText(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json,text/plain,*/*',
        ...(options.headers || {}),
      },
      body: options.body,
    })
  ).text,
)

export const extractCsrfToken = (html) => normalizeWhitespace(
  extractFirst(/"X-CSRF-Token"\s*:\s*"([^"]+)"/i, html),
)

const fetchSearchPageSession = async () => {
  const response = await requestIndegeneText(SEARCH_PAGE_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  const html = response.text
  const csrfToken = extractCsrfToken(html)
  const setCookieHeader = response.headers['set-cookie']
  const cookieHeader = (Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader])
    .filter(Boolean)
    .map((value) => String(value).split(';', 1)[0])
    .join('; ') || null

  if (!csrfToken) {
    throw new Error('Missing Indegene search CSRF token')
  }

  return {
    csrfToken,
    cookieHeader,
  }
}

export const createIndegeneScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  now = () => new Date(),
  fetchSearchPageSession: fetchSearchPageSessionImpl = fetchSearchPageSession,
  fetchJson: fetchJsonImpl = fetchJson,
} = {}) => ({
  async run(options = {}) {
    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    const pageLimit = Number.isInteger(options.maxPages) ? options.maxPages : maxPages
    const getSession = options.fetchSearchPageSession || fetchSearchPageSessionImpl
    const requestJson = options.fetchJson || fetchJsonImpl
    const scrapedAt = normalizeScrapedAt((options.now || now)())
    const session = await getSession()
    const jobs = []
    const seenJobIds = new Set()

    for (let pageNumber = 0; pageNumber < pageLimit; pageNumber += 1) {
      const payload = await requestJson(SEARCH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': session.csrfToken,
          ...(session.cookieHeader ? { Cookie: session.cookieHeader } : {}),
        },
        body: JSON.stringify(buildSearchRequestPayload(pageNumber)),
      })
      const listings = extractSearchResults(payload)
      const summary = extractSearchSummary(payload)

      if (listings.length === 0 && summary.pageSize === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        jobs.push({
          ...listing,
          source: 'indegene',
          link: listing.applyUrl || listing.sourceUrl,
          scrapedAt,
        })

        if (limit && jobs.length >= limit) {
          return jobs.slice(0, limit)
        }
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || 0
      if (pageSize === 0 || (pageNumber + 1) * pageSize >= totalJobCount) break
    }

    return limit ? jobs.slice(0, limit) : jobs
  },
})

export const run = async (options = {}) => createIndegeneScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Indegene scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const states = [...new Set(jobs.map((job) => job.state).filter(Boolean))].sort()
  console.log(`States found: ${states.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'indegene')
    console.log('DB result:', result)
    process.exit(0)
  }
}
