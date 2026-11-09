import path from 'path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.cognizant.com'
export const CAREER_PAGE_URL = `${BASE_URL}/india-en/jobs/`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2B;/gi, '+')
  .replace(/&#x2F;/gi, '/')
  .replace(/&#x2013;|&#8211;/gi, '-')
  .replace(/&#x2014;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const upper = normalized.toUpperCase()
  if (upper === 'FULL_TIME') return 'Full-time'
  if (upper === 'PART_TIME') return null
  if (upper === 'CONTRACTOR') return 'Contract'
  if (upper === 'INTERN') return 'Internship'
  return normalized
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized)
  if (isoLike) {
    const [, year, month, day] = isoLike
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractJobPosting = (html) => {
  const raw = extractFirst(
    /<script[^>]+id="js-job-posting"[^>]+type="application\/ld(?:\+|&#x2B;)json"[^>]*>([\s\S]*?)<\/script>/i,
    html,
  )

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return parsed?.['@type'] === 'JobPosting' ? parsed : null
  } catch {
    return null
  }
}

const formatJobLocation = (place = {}) => {
  const address = place?.address || {}
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    normalizeWhitespace(address.addressCountry),
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : null
}

const extractJobLocations = (jobPosting = {}) => {
  const locations = Array.isArray(jobPosting?.jobLocation) ? jobPosting.jobLocation : []
  return locations
    .map((place) => formatJobLocation(place))
    .filter(Boolean)
}

const extractPageNumberFromHref = (href) => {
  if (!href) return null

  try {
    const url = new URL(href, CAREER_PAGE_URL)
    const page = Number.parseInt(url.searchParams.get('page') || '', 10)
    return Number.isFinite(page) ? page : 1
  } catch {
    return null
  }
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1)
  if (pageNumber === 1) return CAREER_PAGE_URL

  const url = new URL(CAREER_PAGE_URL)
  url.searchParams.set('page', String(pageNumber))
  return url.toString()
}

const COGNIZANT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const extractHtmlTitle = (html) =>
  String(html ?? '').match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null

export const hasCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractHtmlTitle(page) || ''

  return /just a moment\.\.\./i.test(title)
    && /challenges\.cloudflare\.com|cf-browser-verification|cf-chl/i.test(page)
}

const buildBlockedCareersPageError = (url, response, html) => {
  const title = extractHtmlTitle(html)
  const status = Number(response?.status) || 403
  const upstreamError = new Error(
    `Cognizant careers page returned HTTP ${status} Cloudflare challenge${title ? ` (${title})` : ''} for ${url}`,
  )
  upstreamError.softFailure = true
  upstreamError.upstreamOutage = true
  upstreamError.failureKind = 'blocked_or_access_denied'
  upstreamError.abortRetries = true
  return upstreamError
}

const buildHttpStatusError = (url, response) => {
  const status = Number(response?.status)
  const error = new Error(`HTTP ${Number.isFinite(status) ? status : 'unknown'} for ${url}`)
  if (Number.isFinite(status) && [401, 403, 404, 429].includes(status)) {
    error.abortRetries = true
  }
  return error
}

const runCurlRequest = (url, execFileImpl = execFile) => new Promise((resolve, reject) => {
  const command = process.platform === 'win32' ? 'curl.exe' : 'curl'
  const args = [
    '-L',
    '--compressed',
    '-A',
    COGNIZANT_HEADERS['User-Agent'],
    '-H',
    `Accept: ${COGNIZANT_HEADERS.Accept}`,
    '--',
    url,
  ]

  execFileImpl(command, args, (error, stdout, stderr) => {
    if (error) {
      reject(error)
      return
    }

    const output = String(stdout ?? '')
    if (!output.trim()) {
      reject(new Error(stderr || `Empty curl response for ${url}`))
      return
    }

    resolve(output)
  })
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: COGNIZANT_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  return Number(page.status) === 403
    && hasCloudflareChallengeSignal(html)
    && /Enable JavaScript and cookies to continue/i.test(html)
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
    && hasVerifiedCloudflareChallengeSignal(page)
}

export const extractSearchResults = (html) => [...String(html).matchAll(
  /<div class="card card-job" data-id="[^"]+">[\s\S]*?<\/div>\s*<\/div>/gi,
)]
  .map((match) => {
    const card = match[0]
    const sourcePath = extractFirst(/<a class="stretched-link js-view-job" href="([^"]+)"/i, card)
    const title = normalizeWhitespace(extractFirst(/<h2 class="card-title"><a[^>]*>([\s\S]*?)<\/a><\/h2>/i, card))
    const jobId = normalizeWhitespace(extractFirst(/data-id="([^"]+)"/i, card))
    const metaItems = [...card.matchAll(/<li class="list-inline-item">\s*([\s\S]*?)\s*<\/li>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)
    const location = metaItems[0] || null
    const department = metaItems[1] || null
    const sourceUrl = toAbsoluteUrl(sourcePath)

    if (!title || !jobId || !location || !sourceUrl) return null

    return {
      title,
      company: 'Cognizant',
      department,
      location,
      city: extractCity(location),
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const activePageHref = extractFirst(/<li class="page-item active"><a[^>]+href="([^"]+)"/i, html)
  const currentPage = extractPageNumberFromHref(activePageHref)
  const lastPage = Number.parseInt(
    normalizeWhitespace(extractFirst(/aria-label="Last page (\d+)"/i, html)) || '',
    10,
  )
  const totalJobCount = Number.parseInt(
    normalizeWhitespace(extractFirst(/id="js-job-search-results"[^>]+data-results="(\d+)"/i, html)) || '',
    10,
  )
  const nextPageHref = extractFirst(/<li class="page-item next"><a[^>]+href="([^"]+)"/i, html)
  const nextPage = extractPageNumberFromHref(nextPageHref)

  return {
    currentPage,
    totalPages: Number.isFinite(lastPage) ? lastPage : null,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
    hasNext: Boolean(nextPageHref),
    nextPage,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJobPosting(html)
  const locations = extractJobLocations(jobPosting)
  const location = locations.length ? locations.join('; ') : listing.location || null
  const visibleDepartment = normalizeWhitespace(
    extractFirst(
      /Job category\s*<strong><a[^>]*>([\s\S]*?)<\/a><\/strong>/i,
      html,
      (match) => stripTags(match[1]),
    ),
  )
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a class="js-apply-now btn btn-primary"[^>]+href="([^"]+)"/i, html),
  )

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1 class="hero-heading[^"]*">([\s\S]*?)<\/h1>/i, html),
    ) || normalizeWhitespace(jobPosting?.title) || listing.title || null,
    company: 'Cognizant',
    department: visibleDepartment || normalizeWhitespace(jobPosting?.industry) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    jobId: normalizeWhitespace(
      extractFirst(/<meta[^>]+name="JobIdentifier"[^>]+content="([^"]+)"/i, html),
    ) || normalizeWhitespace(jobPosting?.identifier) || listing.jobId || null,
    requisitionId: normalizeWhitespace(
      extractFirst(/<meta[^>]+name="JobIdentifier"[^>]+content="([^"]+)"/i, html),
    ) || normalizeWhitespace(jobPosting?.identifier) || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || normalizeWhitespace(jobPosting?.url) || null,
    applyUrl,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(jobPosting?.datePosted),
    closingDate: null,
    jobDescription: stripTags(jobPosting?.description) || null,
  }
}

export const createDefaultFetchText = ({
  fetchImpl = fetch,
  execFileImpl = execFile,
} = {}) => async (url) => {
  try {
    const response = await fetchImpl(url, { headers: COGNIZANT_HEADERS })
    const html = await response.text()

    if (
      hasCloudflareChallengeSignal(html)
      && Number(response?.status) === 403
      && /cloudflare/i.test(response?.headers?.get?.('server') || '')
      && String(response?.headers?.get?.('cf-ray') || '').trim().length > 0
    ) {
      throw buildBlockedCareersPageError(url, response, html)
    }

    if (response.ok) {
      return html
    }

    throw buildHttpStatusError(url, response)
  } catch (error) {
    if (error?.abortRetries === true || error?.softFailure === true) {
      throw error
    }
    return runCurlRequest(url, execFileImpl)
  }
}

const defaultFetchText = createDefaultFetchText()

export const createCognizantScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchPage = options.fetchPage || defaultFetchPage
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingUrl = buildSearchUrl({ page })
      let listingHtml
      try {
        listingHtml = await fetchText(listingUrl)
      } catch (error) {
        const blockedPage = await fetchPage(listingUrl)
        if (isVerifiedCloudflareChallengedPage(blockedPage, listingUrl)) {
          return []
        }

        throw error
      }
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          ...detail,
          company: 'Cognizant',
          source: 'cognizant',
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
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

export const run = async () => createCognizantScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Cognizant scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cognizant')
    console.log('DB result:', result)
    process.exit(0)
  }
}
