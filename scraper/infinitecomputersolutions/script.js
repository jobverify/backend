import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { saveToDB, saveToFile } from '../../scraper-support/utils/saveToDB.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'infinitecomputersolutions'
export const COMPANY = 'Infinite Computer Solutions'
export const CAREERS_URL = 'https://www.infinite.com/careers'
export const BRASSRING_URL =
  'https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&siteid=5008'
export const INDIA_BRASSRING_SEARCH_URL = `${BRASSRING_URL}#keyWordSearch=&locationSearch=India`
export const SEARCH_API_URL = 'https://sjobs.brassring.com/TgNewUI/Search/Ajax/ProcessSortAndShowMoreJobs'
export const COMPANY_DOMAIN = 'infinite.com'
export const ATS_PLATFORM = 'brassring-public-search-api-location-filter'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_SORT_TYPE = ''

const MONTH_INDEX = Object.freeze({
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
})

const createTimeoutSignal = (timeoutMs = DEFAULT_TIMEOUT_MS) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined
  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeTextContent = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, digits) => {
    const parsed = Number.parseInt(digits, 10)
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _
  })
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const parsed = Number.parseInt(hex, 16)
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _
  })
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, '\'')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ')

const extractHiddenInputValue = (html, inputId) => {
  const tagPattern = new RegExp(`<input[^>]*id=["']${escapeRegex(inputId)}["'][^>]*>`, 'i')
  const tag = String(html ?? '').match(tagPattern)?.[0]
  if (!tag) return null

  const valueMatch = tag.match(/\bvalue=(["'])([\s\S]*?)\1/i)
  return valueMatch ? valueMatch[2] : null
}

const readHeaderValue = (headers, name) => {
  if (!headers) return null

  if (typeof headers.get === 'function') {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? null
  }

  const lowerName = String(name).toLowerCase()
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (String(headerName).toLowerCase() === lowerName) {
      return headerValue
    }
  }

  return null
}

const extractSetCookieValue = (headers) => {
  const rawSetCookie = normalizeWhitespace(readHeaderValue(headers, 'set-cookie'))
  if (!rawSetCookie) return null

  return rawSetCookie.split(';')[0]?.trim() || null
}

const extractEmbeddedSearchConfig = (html) => {
  const encodedPayload = extractHiddenInputValue(html, 'searchResults')
  if (!encodedPayload) return null

  try {
    const payload = JSON.parse(decodeHtmlEntities(encodedPayload))
    return {
      keywordCustomSolrFields: normalizeWhitespace(payload?.KeywordCustomSolrFields),
      locationCustomSolrFields: normalizeWhitespace(payload?.LocationCustomSolrFields),
    }
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const normalizedLower = normalizeTextContent(html)?.toLowerCase() || ''

  return normalizedLower.includes('careers at infinite')
    && normalizedLower.includes('the work we do impacts the world, and the future!')
    && normalizedLower.includes('explore current openings')
    && normalizedLower.includes('submit your resume')
}

export const extractBrassringUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const rawUrl = normalizeWhitespace(decodeHtmlEntities(match[1]))
    if (!rawUrl) continue

    try {
      const absoluteUrl = new URL(rawUrl, CAREERS_URL)
      absoluteUrl.hash = ''
      if (absoluteUrl.toString() === BRASSRING_URL) return absoluteUrl.toString()
    } catch {
      continue
    }
  }

  return null
}

export const extractLandingSearchConfig = (html, { headers } = {}) => {
  const requestVerificationToken = normalizeWhitespace(
    String(html ?? '').match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i)?.[1],
  )
  const encryptedSessionValue = normalizeWhitespace(extractHiddenInputValue(html, 'CookieValue'))
  const linkId = normalizeWhitespace(extractHiddenInputValue(html, 'linkId')) || '0'
  const embeddedSearchConfig = extractEmbeddedSearchConfig(html)

  if (
    !requestVerificationToken
    || !encryptedSessionValue
    || !embeddedSearchConfig?.keywordCustomSolrFields
    || !embeddedSearchConfig?.locationCustomSolrFields
  ) {
    return null
  }

  return {
    requestVerificationToken,
    encryptedSessionValue,
    sessionCookie: extractSetCookieValue(headers),
    linkId,
    keywordCustomSolrFields: embeddedSearchConfig.keywordCustomSolrFields,
    locationCustomSolrFields: embeddedSearchConfig.locationCustomSolrFields,
  }
}

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: options.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    ...(options.body != null ? { body: options.body } : {}),
    signal: options.signal || createTimeoutSignal(options.timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
    headers: response.headers,
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      ...(options.body != null ? { 'Content-Type': 'application/json;charset=UTF-8' } : {}),
      ...(options.headers || {}),
    },
    ...(options.body != null ? { body: options.body } : {}),
    signal: options.signal || createTimeoutSignal(options.timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Expected JSON from ${url} but received an invalid API payload`, {
      cause: error,
    })
  }
}

const extractQuestionMap = (questions = []) => Object.fromEntries(
  (Array.isArray(questions) ? questions : [])
    .map((question) => [
      String(question?.QuestionName ?? '').toLowerCase(),
      normalizeWhitespace(question?.Value),
    ]),
)

const parseBrassringDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null

  const day = Number.parseInt(match[1], 10)
  const month = MONTH_INDEX[match[2].toLowerCase()]
  const year = Number.parseInt(match[3], 10)
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null
  }

  return new Date(Date.UTC(year, month, day)).toISOString()
}

const hasSearchPayloadShape = (payload) => Array.isArray(payload?.Jobs?.Job)
  && Number.isFinite(Number(payload?.JobsCount))

export const extractSearchResults = (payload) => {
  if (!hasSearchPayloadShape(payload)) return []

  return payload.Jobs.Job.flatMap((job) => {
    const questionMap = extractQuestionMap(job?.Questions)
    const title = questionMap.jobtitle
    const link = normalizeWhitespace(job?.Link)
    const location = questionMap.formtext4
    const city = getValidIndiaCityForJob({ location, country: null })

    if (!title || !link || !location || !city) {
      return []
    }

    return [{
      title,
      company: COMPANY,
      location,
      city,
      country: 'India',
      jobId: questionMap.reqid || null,
      requisitionId: questionMap.autoreq || null,
      sourceUrl: link,
      applyUrl: link,
      jobDescription: questionMap.jobdescription || null,
      postingDate: parseBrassringDate(questionMap.lastupdated),
      source: SOURCE,
      link,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
    }]
  })
}

const buildSearchRequestPayload = (config, pageNumber) => ({
  partnerId: '26656',
  siteId: '5008',
  keyword: '',
  location: '',
  keywordCustomSolrFields: config.keywordCustomSolrFields,
  locationCustomSolrFields: config.locationCustomSolrFields,
  facetfilterfields: { Facet: [] },
  powersearchoptions: { PowerSearchOption: [] },
  linkId: config.linkId,
  Latitude: 0,
  Longitude: 0,
  SortType: DEFAULT_SORT_TYPE,
  pageNumber,
  encryptedSessionValue: config.encryptedSessionValue,
})

export const createInfiniteComputerSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Infinite Computer Solutions careers page no longer matches the verified official careers surface')
    }

    const brassringUrl = extractBrassringUrl(careersPage.html)
    if (brassringUrl !== BRASSRING_URL) {
      throw new Error('Infinite Computer Solutions careers page no longer links to the verified public BrassRing surface')
    }

    const landingPage = await fetchPage(INDIA_BRASSRING_SEARCH_URL)
    if (landingPage.status !== 200) {
      throw new Error('Infinite Computer Solutions public BrassRing landing page is no longer reachable')
    }

    const searchConfig = extractLandingSearchConfig(landingPage.html, { headers: landingPage.headers })
    if (!searchConfig) {
      throw new Error('Infinite Computer Solutions public BrassRing search session config no longer matches the verified public BrassRing search session config')
    }

    const requestHeaders = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(searchConfig.requestVerificationToken ? { RFT: searchConfig.requestVerificationToken } : {}),
      ...(searchConfig.sessionCookie ? { cookie: searchConfig.sessionCookie } : {}),
    }

    const firstPagePayload = await fetchJson(SEARCH_API_URL, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(buildSearchRequestPayload(searchConfig, 1)),
    })

    if (!hasSearchPayloadShape(firstPagePayload)) {
      throw new Error('Infinite Computer Solutions public BrassRing search API no longer returns the verified job payload shape')
    }

    const firstPageJobs = Array.isArray(firstPagePayload?.Jobs?.Job) ? firstPagePayload.Jobs.Job : []
    const totalJobs = Number(firstPagePayload?.JobsCount) || 0
    if (totalJobs === 0 || firstPageJobs.length === 0) {
      return []
    }

    const pageSize = firstPageJobs.length
    const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize))
    const jobs = [
      ...extractSearchResults(firstPagePayload),
    ]

    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
      const payload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(buildSearchRequestPayload(searchConfig, pageNumber)),
      })

      if (!hasSearchPayloadShape(payload)) {
        throw new Error(`Infinite Computer Solutions public BrassRing search API page ${pageNumber} no longer returns the verified job payload shape`)
      }

      jobs.push(...extractSearchResults(payload))
    }

    return jobs
  },
})

export const run = async (options = {}) => createInfiniteComputerSolutionsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
