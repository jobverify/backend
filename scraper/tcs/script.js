import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OFFICIAL_INDIA_CAREERS_URL = 'https://www.tcs.com/careers/india'
export const CAREER_PAGE_URL = 'https://ibegin.tcsapps.com/candidate/next/'
export const SEARCH_API_URL = new URL('api/en-IN/search/jobs', CAREER_PAGE_URL).toString()
export const DETAIL_API_URL = new URL('api/en-IN/job/desc/', CAREER_PAGE_URL).toString()
export const WALKIN_DETAIL_API_URL = new URL('api/en-IN/job/desc/walkin/', CAREER_PAGE_URL).toString()
export const DEFAULT_PAGE_SIZE = 50

const MONTH_INDEX = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const LOWERCASE_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to'])

const titleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) {
        return word
      }

      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(0, 10)
  }

  const monthMatch = normalized.match(/^(\d{2})-([A-Z]{3})-(\d{4})/i)
  if (monthMatch) {
    const [, day, month, year] = monthMatch
    const monthNumber = MONTH_INDEX[month.toUpperCase()]
    return monthNumber ? `${year}-${monthNumber}-${day}` : null
  }

  return null
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /year/i.test(normalized) ? normalized : `${normalized} Years`
}

const splitSkills = (value) => String(value ?? '')
  .split(',')
  .map((item) => normalizeWhitespace(item))
  .filter(Boolean)

const isWalkinJobId = (jobId) => /w$/i.test(String(jobId ?? ''))

const extractRequisitionId = (jobId) => normalizeWhitespace(jobId)?.replace(/[jw]$/i, '') || null

const normalizeEmploymentType = (jobId) => {
  if (isWalkinJobId(jobId)) return 'Walk-in'
  if (/j$/i.test(String(jobId ?? ''))) return 'Full-time'
  return null
}


export const buildPublicJobUrl = (jobId) => new URL('en-IN/jobs/' + jobId, CAREER_PAGE_URL).toString()

export const buildSearchPayload = ({ page = 1, pageSize = DEFAULT_PAGE_SIZE, regular = true, walkin = true } = {}) => ({
  includeRegularJob: regular,
  includeWalkIn: walkin,
  searchTerms: [],
  jobLocationFilters: [],
  jobDomainFilters: [],
  experienceLevelFilters: [],
  skillFilters: [],
  // The public relevance sort repeats records across pages. The published recent sort reconciles all IDs.
  relevancySortOrder: null,
  recentSortOrder: 'desc',
  lastDateToApplySortOrder: null,
  page,
  resultsPerPage: pageSize,
})

export const buildDetailApiUrl = (jobId) => {
  if (!/^[1-9]\d*[JW]$/.test(String(jobId))) throw new Error('Invalid TCS requisition identity: ' + jobId)
  return new URL(extractRequisitionId(jobId), isWalkinJobId(jobId) ? WALKIN_DETAIL_API_URL : DETAIL_API_URL).toString()
}

const unwrap = (response, surface) => {
  if (response?.result !== true || response?.status !== 200 || !response.payload || typeof response.payload !== 'object' || Array.isArray(response.payload)) {
    throw new Error('Invalid TCS ' + surface + ' response: expected a successful public API payload')
  }
  return response.payload
}

export const extractPaginationSummary = (response, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const payload = unwrap(response, 'search')
  const count = payload.totalElements
  const totalPages = Math.ceil(count / pageSize)
  const expectedLength = Math.min(pageSize, Math.max(0, count - (page - 1) * pageSize))
  if (!Number.isInteger(count) || count < 0 || !Array.isArray(payload.content)
    || payload.totalPages !== totalPages || payload.number !== page - 1 || payload.size !== pageSize
    || payload.numberOfElements !== payload.content.length || payload.content.length !== expectedLength
    || payload.first !== (page === 1) || payload.last !== (page >= totalPages) || payload.empty !== (expectedLength === 0)
    || payload.pageable?.pageNumber !== page - 1 || payload.pageable?.pageSize !== pageSize
    || payload.pageable?.offset !== (page - 1) * pageSize || payload.pageable?.paged !== true || payload.pageable?.unpaged !== false
    || !payload.facets || !Array.isArray(payload.facets.locations)) {
    throw new Error('Invalid TCS pagination: advertised inventory count, page, size, and records do not reconcile')
  }
  return { page, pageSize, totalRecords: count, totalPages, hasNext: page < totalPages }
}

export const extractSearchResults = (response) => unwrap(response, 'search').content.map((record) => {
  const jobId = record?.id
  if (!/^[1-9]\d*[JW]$/.test(String(jobId)) || !normalizeWhitespace(record.title)
    || !normalizeWhitespace(record.location) || !normalizeWhitespace(record.domain)
    || typeof record.walkIn !== 'boolean' || record.walkIn !== isWalkinJobId(jobId)
    || !Number.isFinite(record.minimumExperienceInYears) || record.minimumExperienceInYears < 0
    || !Number.isFinite(record.maximumExperienceInYears) || record.maximumExperienceInYears < record.minimumExperienceInYears
    || !Array.isArray(record.skills) || record.skills.some((skill) => typeof skill !== 'string')
    || !normalizeDate(record.applyBy)) {
    throw new Error('Invalid TCS listing identity, location, walk-in flag, or required metadata')
  }
  const sourceUrl = buildPublicJobUrl(jobId)
  return {
    title: normalizeWhitespace(record.title), company: 'TCS', department: titleCase(record.domain),
    location: normalizeWhitespace(record.location), city: extractCity(record.location),
    jobId, requisitionId: extractRequisitionId(jobId), sourceUrl, applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(jobId),
    experienceRequired: record.minimumExperienceInYears + ' - ' + record.maximumExperienceInYears + ' Years',
    minimumQualification: null, preferredQualification: null,
    requiredSkills: record.skills.flatMap(splitSkills), postingDate: null,
    closingDate: normalizeDate(record.applyBy), jobDescription: null,
  }
})

export const extractJobDetail = (response, baseJob) => {
  const detail = unwrap(response, 'detail')
  if (String(detail.jobId) !== baseJob.requisitionId || normalizeWhitespace(detail.title) !== baseJob.title
    || normalizeWhitespace(detail.location) !== baseJob.location
    || titleCase(detail.functionName) !== baseJob.department
    || normalizeDate(detail.applyby) !== baseJob.closingDate
    || (!!detail.walkInVenue) !== isWalkinJobId(baseJob.jobId)) {
    const error = new Error('TCS listing/detail identity or metadata conflict for ' + baseJob.jobId)
    error.code = 'TCS_DETAIL_CONFLICT'
    throw error
  }
  // Locale is a request selector. Only the first-party detail country establishes India scope.
  if (detail.country !== 'India' || detail.countryMatch !== 'Y') {
    const error = new Error('TCS detail country conflict: explicit India scope is required for ' + baseJob.jobId)
    error.code = 'TCS_DETAIL_CONFLICT'
    throw error
  }
  return {
    ...baseJob, country: 'India', location: normalizeLocation(detail.location),
    experienceRequired: normalizeExperience(detail.experience) || baseJob.experienceRequired,
    minimumQualification: normalizeWhitespace(detail.qualifications),
    requiredSkills: splitSkills(String(detail.skilldetail ?? '').replace(/\|/g, ',')),
    jobDescription: stripTags(String(detail.description ?? '').replace(/<!--[\s\S]*?-->/g, ' ')),
  }
}

const failForMaintenance = (body) => {
  if (/<title>\s*App Maintenance\s*<\/title>/i.test(body) && /iBegin[\s\S]*temporarily under maintenance/i.test(body)) {
    const error = new Error('TCS iBegin is temporarily under maintenance; job search is unavailable')
    Object.assign(error, { code: 'TCS_MAINTENANCE', softFailure: true, upstreamOutage: true, failureKind: 'upstream_maintenance', abortRetries: true })
    throw error
  }
}

const verifyIndiaCareersHandoff = (body) => {
  if (!/<title>\s*TCS India Careers\s*<\/title>/i.test(body)
    || !/<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.tcs\.com\/careers\/india["']/i.test(body)
    || !/href=["']https:\/\/ibegin\.tcsapps\.com\/candidate\/\?geography=IN&(?:amp;)?language=EN["']/i.test(body)) {
    throw new Error('TCS official India careers handoff no longer matches the verified public iBegin surface')
  }
}

const verifyPublicShell = (body) => {
  if (!/<title>\s*iBegin\s*<\/title>/i.test(body)
    || !/<base\b[^>]*href=["']\/candidate\/next\/["']/i.test(body)
    || !/<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/ibegin\.tcsapps\.com\/candidate\/next\/["']/i.test(body)
    || !/<ib-root\b/i.test(body)) throw new Error('TCS current public iBegin shell no longer matches its verified surface')
}

const createPublicClient = ({ fetchImpl, signal, requestTimeoutMs }) => {
  const cookies = new Map()
  let csrf = null
  const request = async (url, { method = 'GET', body, text = false } = {}) => {
    signal.throwIfAborted()
    const publicOrigin = new URL(url).origin === new URL(CAREER_PAGE_URL).origin
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      Accept: text ? 'text/html,*/*;q=0.8' : 'application/json, text/plain, */*',
      Referer: new URL('en-IN/jobs/search', CAREER_PAGE_URL).toString(),
      ...(publicOrigin && cookies.size ? { Cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; ') } : {}),
    }
    if (method === 'POST') {
      if (!csrf) throw new Error('TCS public search bootstrap did not supply its client CSRF header')
      Object.assign(headers, { 'Content-Type': 'application/json', Origin: 'https://ibegin.tcsapps.com', 'NEXT-XSRF-TOKEN': csrf })
    }
    const response = await fetchImpl(url, {
      method, headers, body: body == null ? undefined : JSON.stringify(body), redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]),
    })
    signal.throwIfAborted()
    for (const entry of publicOrigin ? (response.headers.getSetCookie?.() || []) : []) {
      const pair = entry.split(';')[0]
      const equals = pair.indexOf('=')
      if (equals > 0) cookies.set(pair.slice(0, equals), pair.slice(equals + 1))
    }
    if (publicOrigin) csrf = response.headers.get('x-next-xsrf-token') || csrf
    const content = await response.text()
    signal.throwIfAborted()
    failForMaintenance(content)
    if (!text && ((response.url === CAREER_PAGE_URL && /<ib-root\b/i.test(content))
      || (response.status >= 300 && response.status < 400 && new URL(response.headers.get('location') || url, url).toString() === CAREER_PAGE_URL))) {
      const error = new Error('TCS verified public jobs API redirects to the iBegin app shell; its API contract requires re-verification')
      Object.assign(error, { code: 'TCS_API_MIGRATED', abortRetries: true })
      throw error
    }
    if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url)
    if (response.url && response.url !== url) throw new Error('TCS public surface redirected away from its verified endpoint: ' + url)
    if (text) return content
    if (!/application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type') || '')) throw new Error('Expected JSON from TCS public API for ' + url)
    try { return JSON.parse(content) } catch { throw new Error('Invalid TCS public API JSON for ' + url) }
  }
  const bootstrap = async () => {
    verifyPublicShell(await request(CAREER_PAGE_URL, { text: true }))
    const geographyResponse = await request(new URL('api/geographies', CAREER_PAGE_URL).toString())
    const geographies = geographyResponse?.payload
    if (geographyResponse?.result !== true || geographyResponse?.status !== 200 || !Array.isArray(geographies) || !geographies.some((country) => country.id === 101 && country.name === 'India' && country.geoCode === 'IN' && country.languageCode === 'EN')) {
      throw new Error('TCS public geography contract no longer identifies the verified India country and language')
    }
    const candidate = await request(new URL('api/candidate', CAREER_PAGE_URL).toString())
    if (candidate?.result !== true || candidate?.status !== 200 || candidate.payload != null || !csrf || !cookies.get('SESSION')) {
      throw new Error('TCS ordinary anonymous public session bootstrap failed')
    }
  }
  return { request, bootstrap }
}

export const createTcsScraper = ({
  pageSize = DEFAULT_PAGE_SIZE,
  detailConcurrency = 2,
  // Shared defaults cap at ten pages; complete TCS inventory requires its own advertised page count.
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
  requestTimeoutMs = 15000,
} = {}) => ({
  async run(options = {}) {
    if (![10, 25, 50].includes(pageSize) || !Number.isInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 4
      || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1
      || !(maxPages === Number.POSITIVE_INFINITY || (Number.isInteger(maxPages) && maxPages > 0))
      || !(maxJobs == null || (Number.isInteger(maxJobs) && maxJobs >= 0))) throw new Error('Invalid TCS public scraper options')
    const cancellation = new AbortController()
    const signal = options.signal ? AbortSignal.any([options.signal, cancellation.signal]) : cancellation.signal
    signal.throwIfAborted()
    const clientOptions = { fetchImpl: options.fetch || globalThis.fetch, signal, requestTimeoutMs }
    const listingClient = createPublicClient(clientOptions)
    verifyIndiaCareersHandoff(await listingClient.request(OFFICIAL_INDIA_CAREERS_URL, { text: true }))
    await listingClient.bootstrap()
    const listings = []
    const seen = new Set()
    let expectedCount = null
    let expectedPages = null
    for (let page = 1; ; page += 1) {
      signal.throwIfAborted()
      const response = await listingClient.request(SEARCH_API_URL, { method: 'POST', body: buildSearchPayload({ page, pageSize }) })
      const summary = extractPaginationSummary(response, { page, pageSize })
      if (expectedCount == null) {
        expectedCount = summary.totalRecords
        expectedPages = summary.totalPages
        if ((maxJobs != null && expectedCount > maxJobs) || expectedPages > maxPages) {
          throw new Error('TCS caller cap would truncate the complete advertised inventory')
        }
      } else if (summary.totalRecords !== expectedCount || summary.totalPages !== expectedPages) {
        throw new Error('TCS inventory count changed during pagination')
      }
      for (const job of extractSearchResults(response)) {
        if (seen.has(job.jobId)) throw new Error('Duplicate TCS listing across pages: ' + job.jobId)
        seen.add(job.jobId)
        listings.push(job)
      }
      if (!summary.hasNext) break
    }
    if (listings.length !== expectedCount) throw new Error('TCS complete inventory count does not reconcile')
    signal.throwIfAborted()
    if (listings.length === 0) return []
    const jobs = new Array(listings.length)
    let cursor = 0
    const workers = Array.from({ length: Math.min(detailConcurrency, listings.length) }, async () => {
      try {
        // The upstream service returned a wrong requisition once under concurrent requests in one session.
        // Each worker follows the ordinary public bootstrap and reads details sequentially in its own session.
        const detailClient = createPublicClient(clientOptions)
        await detailClient.bootstrap()
        while (cursor < listings.length) {
          signal.throwIfAborted()
          const index = cursor++
          const listing = listings[index]
          const response = await detailClient.request(buildDetailApiUrl(listing.jobId))
          const detail = extractJobDetail(response, listing)
          jobs[index] = { ...detail, source: 'tcs', link: detail.applyUrl, scrapedAt: new Date().toISOString() }
        }
      } catch (error) {
        if (!cancellation.signal.aborted) cancellation.abort(error)
        throw error
      }
    })
    const results = await Promise.allSettled(workers)
    const rejected = results.find((result) => result.status === 'rejected')
    if (rejected) throw cancellation.signal.reason || rejected.reason
    signal.throwIfAborted()
    if (jobs.filter(Boolean).length !== expectedCount) throw new Error('TCS detail coverage is incomplete')
    return jobs
  },
})

export const run = async (options = {}) => createTcsScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log('Running TCS scraper standalone (' + (isDryRun ? 'dry-run' : 'live') + ')...')
  const jobs = await run()
  console.log('Total India jobs scraped: ' + jobs.length)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else { console.log('DB result:', await saveToDB(jobs, 'tcs')); process.exit(0) }
}
