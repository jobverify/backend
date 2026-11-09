import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { HINDUSTAN_AERONAUTICS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = HINDUSTAN_AERONAUTICS_CATALOG.source
export const COMPANY = HINDUSTAN_AERONAUTICS_CATALOG.companyName
export const VERIFIED_ON = HINDUSTAN_AERONAUTICS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HINDUSTAN_AERONAUTICS_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HINDUSTAN_AERONAUTICS_CATALOG
export const CAREERS_URL = HINDUSTAN_AERONAUTICS_CATALOG.companyCareerPage
export const CAREERS_API_URL = HINDUSTAN_AERONAUTICS_CATALOG.officialCareersApiUrl
export const CAREER_DETAIL_API_URL = HINDUSTAN_AERONAUTICS_CATALOG.officialCareerDetailApiUrl
export const TODAY_POSTINGS_API_URL = HINDUSTAN_AERONAUTICS_CATALOG.officialTodayCareerApiUrl
export const CORRIGENDUM_COUNT_API_URL =
  HINDUSTAN_AERONAUTICS_CATALOG.officialCorrigendumCareerApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_LOOKUP = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|td|th|tr)>/gi, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => (normalizeWhitespace(value) || '').toLowerCase()

export const isLoopbackRedirectLocation = (value) => {
  if (!value) return false

  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  } catch {
    return false
  }
}

const createLoopbackRedirectError = (url, location) => {
  const error = new Error(`HAL careers API redirected to loopback host: ${location}`)
  error.code = 'HAL_LOOPBACK_REDIRECT'
  error.url = url
  error.location = location
  return error
}

const encodeFormBody = (body = {}) =>
  Object.entries(body)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')

const collectSetCookies = (response) => {
  if (typeof response.headers?.getSetCookie === 'function') {
    return response.headers.getSetCookie()
  }

  const header = response.headers?.get?.('set-cookie')
  return header ? [header] : []
}

const appendCookie = (jar, cookieLine) => {
  const [pair] = String(cookieLine ?? '').split(';')
  const separatorIndex = pair.indexOf('=')
  if (separatorIndex <= 0) return

  const name = pair.slice(0, separatorIndex).trim()
  const value = pair.slice(separatorIndex + 1).trim()
  if (!name) return
  jar.set(name, value)
}

const createHalSessionTransport = () => {
  const cookies = new Map()
  const MAX_REDIRECTS = 5
  const DEFAULT_TIMEOUT_MS = 30000

  const getCookieHeader = () =>
    [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ')

  const createHeaderAccess = (headers = {}) => ({
    get(name) {
      const key = String(name ?? '').toLowerCase()
      const value = headers[key]
      if (Array.isArray(value)) return value.join(', ')
      return value ?? null
    },
    getSetCookie() {
      const value = headers['set-cookie']
      if (Array.isArray(value)) return value
      return value ? [value] : []
    },
  })

  const createResponseShape = ({ statusCode, headers, bodyText }) => ({
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    headers: createHeaderAccess(headers),
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  })

  const performRequest = (url, {
    method = 'GET',
    headers = {},
    body = null,
    redirect = 'follow',
    redirectCount = 0,
  } = {}) => new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error(`Too many redirects while requesting ${url}`))
      return
    }

    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch (error) {
      reject(error)
      return
    }

    const requestBody = body == null ? null : String(body)
    const requestHeaders = {
      'Accept-Encoding': 'identity',
      ...headers,
    }

    if (requestBody != null && requestHeaders['Content-Length'] == null) {
      requestHeaders['Content-Length'] = Buffer.byteLength(requestBody)
    }

    const client = parsedUrl.protocol === 'https:' ? https : http
    const request = client.request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method,
      headers: requestHeaders,
      timeout: DEFAULT_TIMEOUT_MS,
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      response.on('end', async () => {
        for (const cookieLine of createHeaderAccess(response.headers).getSetCookie()) {
          appendCookie(cookies, cookieLine)
        }

        const location = createHeaderAccess(response.headers).get('location')
        const bodyText = Buffer.concat(chunks).toString('utf8')
        const statusCode = response.statusCode || 0

        if (statusCode >= 300 && statusCode < 400) {
          if (isLoopbackRedirectLocation(location)) {
            reject(createLoopbackRedirectError(url, location))
            return
          }

          if (redirect === 'follow' && location) {
            try {
              const redirectUrl = new URL(location, parsedUrl).toString()
              const redirected = await performRequest(redirectUrl, {
                method: 'GET',
                headers,
                body: null,
                redirect,
                redirectCount: redirectCount + 1,
              })
              resolve(redirected)
              return
            } catch (error) {
              reject(error)
              return
            }
          }
        }

        resolve(createResponseShape({
          statusCode,
          headers: response.headers,
          bodyText,
        }))
      })
      response.on('error', reject)
    })

    request.on('timeout', () => {
      request.destroy(new Error(`Request timed out for ${url}`))
    })
    request.on('error', reject)

    if (requestBody != null) {
      request.write(requestBody)
    }

    request.end()
  })

  const request = async (url, {
    method = 'GET',
    accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    body = null,
    referer = CAREERS_URL,
    redirect = 'follow',
  } = {}) => {
    const headers = {
      'User-Agent': USER_AGENT,
      Accept: accept,
      'Accept-Language': 'en-US,en;q=0.9',
    }

    const cookieHeader = getCookieHeader()
    if (cookieHeader) headers.Cookie = cookieHeader

    let requestBody = null
    if (method === 'POST') {
      headers.Origin = 'https://hal-india.co.in'
      headers.Referer = referer
      headers['X-Requested-With'] = 'XMLHttpRequest'
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
      requestBody = encodeFormBody({ lang: 'en', ...(body || {}) })
    }

    const response = await performRequest(url, {
      method,
      headers,
      body: requestBody,
      redirect,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response
  }

  return {
    fetchText: async (url) => {
      const response = await request(url)
      return response.text()
    },
    fetchJson: async (url, options = {}) => {
      const response = await request(url, {
        method: 'POST',
        accept: 'application/json, text/plain, */*',
        body: options.body || null,
        referer: CAREERS_URL,
        redirect: 'manual',
      })

      const contentType = response.headers.get('content-type') || ''
      if (!/application\/json|text\/plain/i.test(contentType)) {
        throw new Error(`Unexpected HAL careers API content type for ${url}: ${contentType}`)
      }

      return response.json()
    },
  }
}

export const normalizeHalDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  let match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`
  }

  match = normalized.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/)
  if (match) {
    const month = MONTH_LOOKUP[match[2].toLowerCase()]
    if (!month) return null
    return `${match[3]}-${month}-${match[1]}`
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*HAL(?:\s*[–-]\s*Hindustan Aeronautics Limited)?\s*<\/title>/i.test(page)
}

export const isTemporaryCareersSurfaceError = (error) => {
  const message = String(error?.message ?? error ?? '')

  return message.includes(CAREERS_URL)
    && (
      /Request timed out/i.test(message)
      || /socket hang up/i.test(message)
      || /fetch failed/i.test(message)
      || /ECONNRESET/i.test(message)
      || /ETIMEDOUT/i.test(message)
    )
}

export const extractCareerListings = (payload = {}) =>
  (Array.isArray(payload?.career) ? payload.career : []).map((item) => ({
    id: normalizeWhitespace(item?.id),
    divisionId: normalizeWhitespace(item?.division_id),
    division: normalizeWhitespace(item?.division),
    title: String(item?.title ?? '').replace(/\u00a0/g, ' ').trim() || null,
    floatedDate: normalizeHalDate(item?.floated_date),
    dueDate: normalizeHalDate(item?.activeupto),
  }))
    .filter((item) => item.id && item.title && item.division)

const CLOSED_NOTICE_PATTERN =
  /\b(provisional(?:ly)?|shortlist(?:ed)?|qualified candidates|merit list|allotment letter|admit card|document verification|results?\b|release of)\b/i

const OPEN_NOTICE_PATTERN =
  /\b(notification|engagement|recruitment|apprentice|apprenticeship|walk-?in|application)\b/i

export const isOpenRecruitmentNotice = (listing = {}, detail = {}) => {
  const combined = normalizeWhitespace([
    listing.title,
    detail.title,
    detail.description,
    detail.job_url_info,
  ].filter(Boolean).join(' '))

  if (!combined) return false
  if (CLOSED_NOTICE_PATTERN.test(combined)) return false
  return OPEN_NOTICE_PATTERN.test(combined)
}

const inferCityFromDivision = (division) => {
  const normalized = normalizeWhitespace(division)
  if (!normalized) return null

  if (normalized.includes(',')) {
    const city = normalized.split(',').pop()?.trim()
    return city || null
  }

  return normalized.replace(/\bdivision\b/i, '').trim() || null
}

const inferEmploymentType = (...values) => {
  const text = normalizeText(values.filter(Boolean).join(' '))
  if (!text) return null
  if (text.includes('apprentice')) return 'Apprenticeship'
  if (text.includes('part time') || text.includes('part-time')) return 'Part-time'
  if (text.includes('consultant')) return 'Contract'
  return null
}

const getPrimaryFileUrl = (detail = {}) =>
  normalizeWhitespace(detail?.job_url)
  || normalizeWhitespace(detail?.file?.file?.[0]?.filename)
  || null

export const extractJobFromCareerDetail = (listing = {}, payload = {}) => {
  const detail = payload?.career?.[0] || {}
  const division = normalizeWhitespace(detail?.division) || listing.division
  const city = inferCityFromDivision(division)
  const fileUrl = getPrimaryFileUrl(detail)

  return {
    title: normalizeWhitespace(detail?.title) || listing.title,
    company: COMPANY,
    department: division,
    location: division ? `${division}, India` : 'India',
    city,
    state: null,
    country: 'India',
    jobId: listing.id,
    requisitionId: listing.id,
    sourceUrl: fileUrl || CAREERS_URL,
    applyUrl: fileUrl || CAREERS_URL,
    employmentType: inferEmploymentType(detail?.title, detail?.description),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeHalDate(detail?.floated_date) || listing.floatedDate,
    closingDate: normalizeHalDate(detail?.activeupto) || listing.dueDate,
    jobDescription: normalizeWhitespace(detail?.description),
    publicExperienceChecked: true,
  }
}

export const createHindustanAeronauticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const transport = (!options.fetchText || !options.fetchJson)
      ? createHalSessionTransport()
      : null
    const fetchText = options.fetchText || transport.fetchText
    const fetchJson = options.fetchJson || transport.fetchJson

    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (isTemporaryCareersSurfaceError(error)) {
        return []
      }

      throw error
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error(
        'The verified Hindustan Aeronautics careers page no longer matches the trusted public surface',
      )
    }

    let careersPayload
    try {
      careersPayload = await fetchJson(CAREERS_API_URL)
    } catch (error) {
      if (error?.code === 'HAL_LOOPBACK_REDIRECT') {
        return []
      }

      throw error
    }
    const listings = extractCareerListings(careersPayload)
    if (!Array.isArray(careersPayload?.career) || listings.length === 0) {
      throw new Error(
        'The verified Hindustan Aeronautics careers API no longer exposes the expected career listings array',
      )
    }

    const jobs = []
    for (const listing of listings) {
      const detailPayload = await fetchJson(CAREER_DETAIL_API_URL, {
        body: { id: listing.id },
      })
      const detail = detailPayload?.career?.[0]
      if (!detail || !isOpenRecruitmentNotice(listing, detail)) continue

      jobs.push({
        ...extractJobFromCareerDetail(listing, detailPayload),
        source: SOURCE,
        link: getPrimaryFileUrl(detail) || CAREERS_URL,
        scrapedAt: now(),
      })

      if (Number.isInteger(maxJobs) && jobs.length >= maxJobs) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createHindustanAeronauticsScraper(options).run(options)

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
