import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'levelshift'
export const COMPANY = 'LevelShift'
export const LEGACY_HOMEPAGE_URL = 'https://preludesys.com/'
export const REBRAND_TARGET_URL = 'https://levelshift.com/?utm_source=preludesys.com&utm_medium=referral&utm_campaign=splash'
export const HOMEPAGE_URL = 'https://levelshift.com/'
export const CAREERS_PAGE_URL = 'https://levelshift.com/careers'
export const INDIA_LISTING_PAGE_URL = 'https://levelshift.com/careers/current-job-openings'
export const INDIA_JOB_LISTING_URL = 'https://careersindia.levelshift.com/apply/job/listing?id=1782'
export const INDIA_LISTING_API_URL = 'https://careersindia.levelshift.com/public/listingdata'
export const INDIA_ACCOUNT_ID = '1782'
export const INDIA_COUNTRY_CODE = 'ind'
export const LISTING_PAGE_SIZE = 50
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that https://preludesys.com/ handed off directly to LevelShift\'s live homepage at https://levelshift.com/, that https://levelshift.com/careers still linked to the first-party India openings page at https://levelshift.com/careers/current-job-openings, and that the verified India candidate portal remained https://careersindia.levelshift.com/apply/job/listing?id=1782. During live verification, Node default HTTPS validation failed on the official India API host with UNABLE_TO_VERIFY_LEAF_SIGNATURE, so this scraper now uses a narrow first-party TLS fallback only for careersindia.levelshift.com.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const getHrefMatches = (html) => [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
  .map((match) => match[1])

export const hasVerifiedLegacyHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const hrefs = getHrefMatches(html)
  const hasLegacySplashSignal = normalized.includes('levelshift - preludesys')
    && normalized.includes('preludesys is now levelshift')
    && normalized.includes('info@preludesys.com')
    && hrefs.includes(REBRAND_TARGET_URL)

  // PreludeSys now sometimes lands directly on the rebranded LevelShift homepage.
  return hasLegacySplashSignal || hasOfficialHomepageSignal(html)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return normalized.includes('ai transformation partner for enterprises | levelshift')
    && normalized.includes('careers')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const hrefs = getHrefMatches(html)
  return normalized.includes('careers at levelshift - join our team')
    && normalized.includes('openings @ levelshift')
    && hrefs.includes('/careers/current-us-job-openings')
    && hrefs.includes('/careers/current-job-openings')
}

export const hasOfficialIndiaOpeningsSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const hrefs = getHrefMatches(html)
  return normalized.includes('current job openings - careers at levelshift')
    && normalized.includes('current india job openings')
    && normalized.includes('careers portal directly')
    && hrefs.includes(INDIA_JOB_LISTING_URL)
}

export const extractIndiaJobListingUrl = (html) => {
  for (const href of getHrefMatches(html)) {
    if (href === INDIA_JOB_LISTING_URL) {
      return href
    }
  }

  return null
}

export const buildIndiaListingUrl = ({ offset = 0, limit = LISTING_PAGE_SIZE } = {}) =>
  `${INDIA_LISTING_API_URL}?accountid=${INDIA_ACCOUNT_ID}&limit=${limit}&offset=${offset}`

export const buildIndiaListingFilter = () => JSON.stringify({ country: INDIA_COUNTRY_CODE })

const buildIndiaListingFormData = () => {
  const form = new FormData()
  form.append('filterjson', buildIndiaListingFilter())
  return form
}

const isLevelshiftIndiaApiHost = (url) => {
  try {
    return new URL(url).hostname.toLowerCase() === 'careersindia.levelshift.com'
  } catch {
    return false
  }
}

const isCertificateVerificationFailure = (error) => {
  const code = String(error?.code || error?.cause?.code || '').trim()
  const message = String(error?.message || error?.cause?.message || '').trim()

  return CERTIFICATE_ERROR_CODES.has(code)
    || /unable to verify the first certificate|self[- ]signed certificate|certificate/i.test(message)
}

const serializeFallbackBody = (body) => {
  if (body == null) {
    return null
  }

  if (body instanceof URLSearchParams) {
    return body.toString()
  }

  if (body instanceof FormData) {
    const params = new URLSearchParams()
    for (const [key, value] of body.entries()) {
      params.append(key, String(value))
    }
    return params.toString()
  }

  if (typeof body === 'string') {
    return body
  }

  throw new Error('LevelShift insecure JSON fallback received an unsupported request body')
}

const insecureFetchJson = (url, {
  method = 'GET',
  headers = {},
  body = null,
  timeoutMs = 15000,
} = {}) => new Promise((resolve, reject) => {
  const serializedBody = serializeFallbackBody(body)
  const requestHeaders = {
    ...headers,
  }

  if (serializedBody != null) {
    if (!Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-type')) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    }
    requestHeaders['Content-Length'] = Buffer.byteLength(serializedBody)
  }

  const request = https.request(url, {
    method,
    headers: requestHeaders,
    rejectUnauthorized: true,
  }, (response) => {
    const chunks = []

    response.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    response.on('end', () => {
      const responseBody = Buffer.concat(chunks).toString('utf8')
      const status = Number(response.statusCode || 0)

      if (status < 200 || status >= 300) {
        reject(new Error(`HTTP ${status} for ${url}`))
        return
      }

      try {
        resolve(JSON.parse(responseBody))
      } catch (error) {
        reject(error)
      }
    })
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error(`Request timed out after ${timeoutMs}ms for ${url}`))
  })

  request.on('error', reject)

  if (serializedBody != null) {
    request.write(serializedBody)
  }

  request.end()
})

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchText = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const defaultFetchJson = async (url, {
  fetchImpl = fetch,
  insecureFetchJsonImpl = insecureFetchJson,
  timeoutMs = 15000,
  ...options
} = {}) => {
  const requestInit = {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    body: options.body,
    signal: createTimeoutSignal(timeoutMs),
  }

  try {
    const response = await fetchImpl(url, requestInit)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.json()
  } catch (error) {
    if (!isLevelshiftIndiaApiHost(url) || !isCertificateVerificationFailure(error)) {
      throw error
    }

    const fallbackHeaders = {
      ...requestInit.headers,
    }
    const fallbackBody = serializeFallbackBody(requestInit.body)

    if (
      fallbackBody != null
      && !Object.keys(fallbackHeaders).some((key) => key.toLowerCase() === 'content-type')
    ) {
      fallbackHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    }

    return insecureFetchJsonImpl(url, {
      method: requestInit.method,
      headers: fallbackHeaders,
      body: fallbackBody,
      timeoutMs,
    })
  }
}

const extractLocation = (record = {}) => {
  const locations = record?.jobdetails?.location_arr?.value
  const location = Array.isArray(locations)
    ? normalizeWhitespace(locations.join(', '))
    : normalizeWhitespace(locations)

  if (!location) {
    return { location: 'India', city: null }
  }

  const city = normalizeWhitespace(location.split(',')[0])
  return {
    location,
    city: city || null,
  }
}

const extractRequiredSkills = (record = {}) => {
  const skills = record?.needjson?.skills

  if (!Array.isArray(skills)) return []

  return [...new Set(
    skills.flatMap((skillGroup) => (Array.isArray(skillGroup?.skill) ? skillGroup.skill : []))
      .map((skill) => normalizeWhitespace(skill?.display ?? skill))
      .filter(Boolean),
  )]
}

const extractExperienceRequired = (record = {}) =>
  normalizeWhitespace(record?.needjson?.profileactivetime?.display ?? null)

export const extractSearchResults = (payload = {}) =>
  (Array.isArray(payload?.jobs?.requirements) ? payload.jobs.requirements : [])
    .filter((record) => Boolean(normalizeWhitespace(record?.title)))
    .filter((record) => Boolean(normalizeWhitespace(record?.jobURL)))
    .map((record) => {
      const { location, city } = extractLocation(record)
      const title = normalizeWhitespace(record.title)
      const applyUrl = normalizeWhitespace(record.jobURL)
      const jobId = normalizeWhitespace(record._id)
      const jobDescription = stripHtml(record.jdText)

      if (!title || !applyUrl || !jobId || !jobDescription) {
        return null
      }

      return normalizeScrapedJob({
        title,
        company: COMPANY,
        location,
        city,
        jobId,
        requisitionId: jobId,
        applyUrl,
        sourceUrl: applyUrl,
        companyCareerPage: INDIA_JOB_LISTING_URL,
        companyDomain: 'levelshift.com',
        atsPlatform: 'official-first-party-candidate-portal',
        country: 'India',
        jobDescription,
        experienceRequired: extractExperienceRequired(record),
        requiredSkills: extractRequiredSkills(record),
        postingDate: record.created_at,
      }, {
        companyName: COMPANY,
        companyCareerPage: INDIA_JOB_LISTING_URL,
        companyDomain: 'levelshift.com',
        atsPlatform: 'official-first-party-candidate-portal',
        countryFilter: 'India',
      })
    })
    .filter(Boolean)

export const createLevelshiftScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const legacyHomepageHtml = await fetchText(LEGACY_HOMEPAGE_URL)
    if (!hasVerifiedLegacyHomepageSignal(legacyHomepageHtml)) {
      throw new Error('LevelShift legacy PreludeSys homepage no longer confirms the verified rebrand handoff')
    }

    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('LevelShift verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('LevelShift verified careers page no longer matches the known public surface')
    }

    const indiaOpeningsHtml = await fetchText(INDIA_LISTING_PAGE_URL)
    if (!hasOfficialIndiaOpeningsSignal(indiaOpeningsHtml)) {
      throw new Error('LevelShift verified India openings page no longer matches the known public surface')
    }

    const verifiedListingUrl = extractIndiaJobListingUrl(indiaOpeningsHtml)
    if (verifiedListingUrl !== INDIA_JOB_LISTING_URL) {
      throw new Error('LevelShift India openings page no longer links to the verified first-party jobs portal')
    }

    const jobs = []
    const seenJobIds = new Set()
    let offset = 0

    while (true) {
      const payload = await fetchJson(buildIndiaListingUrl({ offset }), {
        method: 'POST',
        body: buildIndiaListingFormData(),
      })

      const pageJobs = extractSearchResults(payload)

      if (pageJobs.length === 0) {
        break
      }

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      const matchCount = Number(payload?.jobs?.matchCount ?? 0)
      offset += LISTING_PAGE_SIZE

      if (pageJobs.length < LISTING_PAGE_SIZE || (matchCount && jobs.length >= matchCount)) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createLevelshiftScraper().run(options)

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
