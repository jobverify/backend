import path from 'path'
import { fileURLToPath } from 'url'

import { composeAbortSignals, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const DEFAULT_COMPANY_NAME = 'Darwinbox'
const DEFAULT_SOURCE = 'darwinbox'
const DEFAULT_COMPANY_ID = 'main'
const DEFAULT_PAGE_SIZE = 10
const DEFAULT_DETAIL_BUDGET_MS = 30000
const DEFAULT_ORIGIN = 'https://dbx.darwinbox.in'
const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

// The native editor prompt is not employer criteria. Keep its original value
// separately while allowing the ordinary detail request to recover real text.
const isNativeDescriptionPlaceholder = (value) => {
  const text = normalizeWhitespace(String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
  return /^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[.!\u2026]*$/i.test(text || '')
}

// Employer handoffs may render typographic dashes while the native API uses
// ASCII hyphens. Preserve all title words, case and punctuation beyond dashes.
const normalizeDetailTitle = (value) => normalizeWhitespace(value)?.replace(/\s*[-\u2010-\u2015]\s*/g, '-')

const normalizeOrigin = (value) =>
  (normalizeWhitespace(value) || DEFAULT_ORIGIN).replace(/\/+$/g, '')

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  return undefined
}

const extractSetCookieValues = (headers) => {
  if (!headers) return []

  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie()
    if (Array.isArray(values)) {
      return values.map((value) => normalizeWhitespace(value)).filter(Boolean)
    }
  }

  const singleValue = normalizeWhitespace(headers.get?.('set-cookie'))
  return singleValue ? [singleValue] : []
}

const updateSessionCookies = (cookies, setCookieValues, now = Date.now()) => {
  for (const value of setCookieValues) {
    const [pair, ...attributes] = value.split(';').map(part => part.trim())
    const separator = pair.indexOf('=')
    if (separator <= 0) continue
    const name = pair.slice(0, separator)
    const maxAge = attributes.find(part => /^max-age=/i.test(part))?.slice(8)
    const expires = attributes.find(part => /^expires=/i.test(part))?.slice(8)
    const maxAgeSeconds = maxAge != null && /^-?\d+$/.test(maxAge) ? Number(maxAge) : NaN
    // Max-Age takes precedence over Expires; absent/invalid expiry is a session cookie.
    const expiresAt = Number.isFinite(maxAgeSeconds) ? now + maxAgeSeconds * 1000 : Date.parse(expires)
    if (expiresAt <= now) cookies.delete(name)
    else cookies.set(name, { pair, expiresAt })
  }
}

const buildCookieHeader = (cookies, now = Date.now()) => {
  for (const [name, cookie] of cookies) if (cookie.expiresAt <= now) cookies.delete(name)
  return [...cookies.values()].map(cookie => cookie.pair).join('; ') || null
}

const isRetryableDarwinboxListingError = (error) => {
  if (!error) return false
  if (error.status === 403) return true

  const message = normalizeWhitespace(error.message) || ''
  return /(?:^| )HTTP 403\b|Forbidden HTML response/i.test(message)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'

  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const firstPart = parts[0] || normalized
  const secondPart = parts[1] || null
  const looksLikeOfficeCode = /^[A-Z0-9]{2,5}$/.test(firstPart)

  if (looksLikeOfficeCode && secondPart && !/india/i.test(secondPart)) {
    return secondPart
  }

  return firstPart
}

const isIndiaJob = (record) => {
  const location = normalizeWhitespace(record?.locations)
  const country = normalizeWhitespace(record?.country)
  return /india/i.test(location || '') || /india/i.test(country || '')
}

const parseNativeClosingDate = (record, source) => {
  const value = record?.job_posting?.careers?.to
  if (value == null) return null
  const seconds = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))
    ? Number(value) : NaN
  const closingDate = new Date(seconds * 1000)
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || !Number.isFinite(closingDate.getTime())) {
    const error = new Error(`[${source}] Darwinbox native closing epoch is malformed for ${normalizeWhitespace(record?.id) || 'unknown job'}`)
    error.name = 'DarwinboxListingContractError'
    error.abortRetries = true
    error.failureKind = 'parser_or_contract_error'
    throw error
  }
  return closingDate.toISOString()
}

const extractNativeListingPublication = (record, source) => {
  const posted = record?.posted_on
  // Retain legacy display dates unchanged; never infer publication from
  // created_on, updated_on, or a careers.from value without posted_on.
  const isEpoch = typeof posted === 'number'
    || (typeof posted === 'string' && /^\d+$/.test(posted.trim()))
  if (!isEpoch) return {}
  const seconds = Number(posted)
  const nativeFrom = record?.job_posting?.careers?.from
  const from = typeof nativeFrom === 'number'
    || (typeof nativeFrom === 'string' && /^\d+$/.test(nativeFrom.trim()))
    ? Number(nativeFrom) : NaN
  const date = new Date(seconds * 1000)
  if (!Number.isSafeInteger(seconds) || seconds <= 0
    || !Number.isSafeInteger(seconds * 1000) || !Number.isFinite(date.getTime())
    || (nativeFrom != null && from !== seconds)) {
    const error = new Error(`[${source}] Darwinbox native publication epochs are malformed or inconsistent for ${normalizeWhitespace(record?.id) || 'unknown job'}`)
    error.name = 'DarwinboxListingContractError'
    error.abortRetries = true
    error.failureKind = 'parser_or_contract_error'
    throw error
  }
  return {
    postingDate: date.toISOString(),
    sourcePostingDate: date.toISOString(),
    sourceDateEvidence: 'darwinbox-native-posted-on-v1',
    sourceNativePostedOn: posted,
    ...(nativeFrom != null ? { sourceNativeCareersFrom: nativeFrom } : {}),
  }
}

export class DarwinboxUpstreamUnavailableError extends Error {
  constructor(source, url, cause) {
    super('[' + source + '] Darwinbox listing unavailable at ' + url + ': ' + cause.message, { cause })
    this.name = 'DarwinboxUpstreamUnavailableError'
    this.httpStatus = 403
    this.status = 403
    this.softFailure = true
    this.upstreamOutage = true
    this.abortRetries = true
    this.failureKind = 'blocked_or_access_denied'
  }
}

const validateListingPayload = (payload, source, pageNumber, pageSize) => {
  const total = payload?.job_counts == null ? null : Number(payload.job_counts)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || !Array.isArray(payload.data)
    || (payload.status != null && !['success', true, 200].includes(payload.status))
    || (total != null && (!Number.isSafeInteger(total) || total < 0
      || !['string', 'number'].includes(typeof payload.job_counts) || String(payload.job_counts).trim() === ''))
    || (payload.data.length === 0 && total > (pageNumber - 1) * pageSize)
    || payload.data.some((record) => !record || !normalizeWhitespace(record.id)
      || !normalizeWhitespace(record.title) || (!normalizeWhitespace(record.locations) && !normalizeWhitespace(record.country))
      || (isIndiaJob(record) && !normalizeWhitespace(record.locations)))) {
    const error = new Error('[' + source + '] Darwinbox listings payload is malformed or incomplete')
    error.name = 'DarwinboxListingContractError'
    error.abortRetries = true
    error.failureKind = 'parser_or_contract_error'
    throw error
  }
  for (const record of payload.data) {
    parseNativeClosingDate(record, source)
    extractNativeListingPublication(record, source)
  }
}
export const createDarwinboxScraper = ({
  companyName = DEFAULT_COMPANY_NAME,
  source = DEFAULT_SOURCE,
  companyId = DEFAULT_COMPANY_ID,
  pageSize = DEFAULT_PAGE_SIZE,
  origin = DEFAULT_ORIGIN,
  fetchImpl = fetch,
} = {}) => {
  const portalOrigin = normalizeOrigin(origin)
  const requestTimeoutMs = Math.max(Number(config.jobListingTimeoutMs) || 0, 30000)
  const publicSessionCookies = new Map()
  const invokeFetchImpl = (url, requestInit) => (
    fetchImpl === globalThis.fetch
      ? globalThis.fetch(url, requestInit)
      : fetchImpl(url, requestInit)
  )

  const buildCareersPageUrl = (targetCompanyId = companyId) =>
    `${portalOrigin}/ms/candidatev2/${targetCompanyId}/careers/allJobs`

  const buildListingApiUrl = (targetCompanyId = companyId) =>
    `${portalOrigin}/ms/candidateapi/job/alljobs?companyId=${targetCompanyId}`

  const buildJobDetailUrl = (jobId, targetCompanyId = companyId) =>
    `${portalOrigin}/ms/candidatev2/${targetCompanyId}/careers/jobDetails/${normalizeWhitespace(jobId) || ''}`

  const buildJobDetailApiUrl = (jobId, targetCompanyId = companyId) =>
    `${portalOrigin}/ms/candidateapi/job/${encodeURIComponent(normalizeWhitespace(jobId) || '')}?companyId=${encodeURIComponent(targetCompanyId)}`

  const updatePublicSessionCookieHeader = (headers) => {
    updateSessionCookies(publicSessionCookies, extractSetCookieValues(headers))
    return buildCookieHeader(publicSessionCookies)
  }

  const cookieAwareFetchImpl = async (url, requestInit) => {
    const response = await invokeFetchImpl(url, requestInit)
    updatePublicSessionCookieHeader(response?.headers)
    return response
  }

  const seedPublicSessionCookie = async (
    targetCompanyId = companyId,
    { forceRefresh = false, signal, timeoutMs = requestTimeoutMs } = {},
  ) => {
    signal?.throwIfAborted()
    // A forced shell refresh must obtain a new public challenge token rather
    // than replay the token rejected by the API. Retain the tenant's app session.
    if (forceRefresh) publicSessionCookies.delete('__cf_bm')
    const cookieHeader = buildCookieHeader(publicSessionCookies)
    if (!forceRefresh && cookieHeader) return cookieHeader

    try {
      const response = await cookieAwareFetchImpl(buildCareersPageUrl(targetCompanyId), {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        signal: composeAbortSignals(signal, createTimeoutSignal(timeoutMs)),
      })

      signal?.throwIfAborted()
      await response.body?.cancel?.()
    } catch {
      signal?.throwIfAborted()
      // Best effort only; some tenants may still allow the API without a seeded cookie.
    }

    return buildCookieHeader(publicSessionCookies)
  }

  const extractSearchResults = (payload = {}) => (
    Array.isArray(payload?.data)
      ? payload.data
        .filter((record) => isIndiaJob(record))
        .map((record) => {
          const jobId = normalizeWhitespace(record.id)
          const location = normalizeWhitespace(record.locations)
          const nativePlaceholder = isNativeDescriptionPlaceholder(record.jd)
          const jobDescription = nativePlaceholder ? null : normalizeWhitespace(record.jd)
          const experienceRequired = normalizeWhitespace(record.experience)
          const closingDate = parseNativeClosingDate(record, source)
          const publication = extractNativeListingPublication(record, source)

          if (!jobId || !location) return null

          return {
            title: normalizeWhitespace(record.title),
            company: companyName,
            department: normalizeWhitespace(record.department_name),
            location,
            city: extractCity(location),
            jobId,
            requisitionId: null,
            sourceUrl: buildJobDetailUrl(jobId),
            applyUrl: buildJobDetailUrl(jobId),
            employmentType: normalizeWhitespace(record.emp_type_name),
            experienceRequired,
            minimumQualification: null,
            preferredQualification: null,
            requiredSkills: [],
            postingDate: normalizeWhitespace(record.posted_on),
            ...publication,
            closingDate,
            ...(closingDate ? { sourceClosingDateIsExact: true } : {}),
            jobDescription,
            ...(nativePlaceholder ? { sourceNativeListingDescription: record.jd } : {}),
            ...(jobDescription && !experienceRequired
              ? { publicExperienceChecked: true }
              : {}),
          }
        })
        .filter(Boolean)
      : []
  )

  const fetchListingPageFromApi = ({
    page: pageNumber,
    pageSize: targetPageSize = pageSize,
    companyId: targetCompanyId = companyId,
    signal,
  }) => (async () => {
    const requestBody = JSON.stringify({
      companyId: targetCompanyId,
      sort_option: 'new',
      limit: targetPageSize,
      page: pageNumber,
    })

    for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
      signal?.throwIfAborted()
      const cookieHeader = await seedPublicSessionCookie(targetCompanyId, { forceRefresh: true, signal })
      signal?.throwIfAborted()
      const headers = {
        'User-Agent': USER_AGENT,
        Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/json',
        Origin: portalOrigin,
        Referer: buildCareersPageUrl(targetCompanyId),
      }

      if (cookieHeader) {
        headers.cookie = cookieHeader
      }

      try {
        return await fetchJsonWithRetry(buildListingApiUrl(targetCompanyId), {
          fetchImpl: cookieAwareFetchImpl,
          signal,
          attempts: 1,
          method: 'POST',
          headers,
          body: requestBody,
          label: `${source}-darwinbox-listings`,
          timeoutMs: requestTimeoutMs,
        })
      } catch (error) {
        signal?.throwIfAborted()
        if (attemptNumber >= 2 || !isRetryableDarwinboxListingError(error)) {
          throw error
        }
      }
    }

    throw new Error(`[${source}] Darwinbox listings retry exhausted unexpectedly`)
  })()

  // The public candidate client reads message.job[0].jd from GET job/{id}.
  // Check blank listing jd against that endpoint without synthesizing missing text.
  const fetchJobDetailFromApi = async ({ jobId, companyId: targetCompanyId = companyId, signal, timeoutMs = requestTimeoutMs }) => {
    signal?.throwIfAborted()
    const deadline = Date.now() + timeoutMs
    const cookieHeader = await seedPublicSessionCookie(targetCompanyId, { signal, timeoutMs })
    signal?.throwIfAborted()
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) throw new Error('Darwinbox detail request budget exhausted during session seeding')
    return fetchJsonWithRetry(buildJobDetailApiUrl(jobId, targetCompanyId), {
      fetchImpl: cookieAwareFetchImpl,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en',
        Referer: buildJobDetailUrl(jobId, targetCompanyId),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      attempts: 1,
      timeoutMs: remainingMs,
      signal,
      label: `${source}-darwinbox-detail`,
    })
  }

  const validateJobDetail = (payload, job) => {
    const records = payload?.message?.job
    const record = Array.isArray(records) && records.length === 1 ? records[0] : null
    const location = normalizeWhitespace(record?.officelocation_show_arr)
    const country = normalizeWhitespace(record?.country)
    const locationList = record?.officelocation_show_arr_list
    const isGroupedLocation = (value) => /^multiple locations$/i.test(normalizeWhitespace(value) || '')
    const isExplicitIndiaLocation = (value) => typeof value === 'string'
      && /(?:^|,\s*)India(?:\s*\([^)]*\))?$/i.test(normalizeWhitespace(value) || '')
    const groupedLocation = isGroupedLocation(location)
    const nativeAddresses = record?.tool_tip_locations
    const completeIndiaAddresses = Array.isArray(nativeAddresses) && nativeAddresses.length > 0
      && nativeAddresses.every(isExplicitIndiaLocation)
    const validPrimaryLocation = groupedLocation ? completeIndiaAddresses : isExplicitIndiaLocation(location)
    const invalidAddressList = ['tool_tip_locations', 'officelocations_area', 'officelocations_without_area']
      .some((key) => record?.[key] != null && (!Array.isArray(record[key]) || !record[key].every(isExplicitIndiaLocation)))
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || (payload.status != null && !['success', true, 200].includes(payload.status))
      || normalizeWhitespace(record.id) !== job.jobId
      || !normalizeDetailTitle(record.title) || !normalizeDetailTitle(job.title)
      || normalizeDetailTitle(record.title) !== normalizeDetailTitle(job.title)
      || typeof record.officelocation_show_arr !== 'string' || !validPrimaryLocation || invalidAddressList
      || (locationList != null && (!Array.isArray(locationList)
        || locationList.some((value) => !isExplicitIndiaLocation(value) && !(groupedLocation && isGroupedLocation(value)))))
      || (record.country != null && typeof record.country !== 'string')
      || (country && !/^(?:india|in)$/i.test(country))
      || (record.jd != null && typeof record.jd !== 'string')) {
      const error = new Error(`[${source}] Darwinbox detail identity, native location or payload is malformed for ${job.jobId}`)
      error.name = 'DarwinboxDetailContractError'
      error.abortRetries = true
      error.failureKind = 'parser_or_contract_error'
      throw error
    }
    return normalizeWhitespace(record.jd)
  }

  const extractJobDetailFacts = (payload, job) => {
    validateJobDetail(payload, job)
    const record = payload.message.job[0]
    const posted = record.posted_on
    const careersFrom = record.job_posting?.careers?.from
    // created_on is a different event and cannot replace the native public
    // posting instant. Older bodies remain useful without becoming new jobs.
    if (posted == null && careersFrom == null) return {}
    const date = new Date(posted * 1000)
    if (typeof posted !== 'number' || !Number.isSafeInteger(posted) || posted <= 0
      || typeof careersFrom !== 'number' || careersFrom !== posted
      || !Number.isSafeInteger(posted * 1000) || !Number.isFinite(date.getTime())) {
      const error = new Error(`[${source}] Darwinbox native publication epochs are malformed or inconsistent for ${job.jobId}`)
      error.name = 'DarwinboxDetailContractError'
      error.abortRetries = true
      error.failureKind = 'parser_or_contract_error'
      throw error
    }
    return { postingDate: date.toISOString(), sourcePostingDate: date.toISOString(), sourceDateEvidence: 'darwinbox-native-posted-on-v1' }
  }

  const run = async ({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchListingPage = fetchListingPageFromApi,
    fetchJobDetail = fetchJobDetailFromApi,
    detailEnrichmentBudgetMs = config.detailEnrichmentBudgetMs ?? DEFAULT_DETAIL_BUDGET_MS,
    signal,
  } = {}) => {
    signal?.throwIfAborted()
    const jobs = []
    let pageNumber = 1
    let pagesFetched = 0
    let reportedTotal = null
    let exhausted = false
    let duplicateRecords = false
    const recordIds = new Set()
    const finish = async () => {
      const configuredBudget = Number(detailEnrichmentBudgetMs)
      const detailBudgetMs = Number.isFinite(configuredBudget) && configuredBudget >= 0
        ? configuredBudget : DEFAULT_DETAIL_BUDGET_MS
      const detailDeadline = Date.now() + detailBudgetMs
      for (const job of jobs) {
        if (hasSourceDescription(job)) continue
        signal?.throwIfAborted()
        const remainingMs = detailDeadline - Date.now()
        job.sourceDetailComplete = false
        if (remainingMs <= 0) {
          job.sourceDetailFailureKind = 'budget-exhausted'
          continue
        }
        let payload
        try {
          payload = await fetchJobDetail({ jobId: job.jobId, companyId, signal, timeoutMs: Math.min(requestTimeoutMs, remainingMs) })
          signal?.throwIfAborted()
        } catch (error) {
          signal?.throwIfAborted()
          job.sourceDetailFailureKind = !error?.status && Date.now() >= detailDeadline ? 'budget-exhausted' : 'upstream'
          continue
        }
        const description = validateJobDetail(payload, job)
        Object.assign(job, extractJobDetailFacts(payload, job))
        if (isNativeDescriptionPlaceholder(description)) {
          job.sourceNativeDetailDescription = payload.message.job[0].jd
        }
        if (hasSourceDescription({ jobDescription: description }) && !isNativeDescriptionPlaceholder(description)) {
          job.jobDescription = description
          job.sourceDetailComplete = true
          if (!job.experienceRequired) job.publicExperienceChecked = true
        } else {
          job.sourceDetailFailureKind = 'missing-content'
        }
      }
      const complete = exhausted && !duplicateRecords && (recordIds.size > 0 || reportedTotal === 0)
        && (reportedTotal == null || recordIds.size === reportedTotal)
      if (!complete) for (const job of jobs) job.sourceListingComplete = false
      return attachInventoryEvidence(jobs, {
        status: complete ? recordIds.size === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
        surface: buildListingApiUrl(companyId), firstParty: true, listingComplete: complete,
        pagesFetched, reportedTotal, indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString(),
        reason: complete ? 'darwinbox-complete-public-pagination' : 'darwinbox-incomplete-or-limited-pagination',
      })
    }

    while (pageNumber <= maxPages) {
      signal?.throwIfAborted()
      let payload

      try {
        payload = await fetchListingPage({ page: pageNumber, pageSize, companyId, signal })
        signal?.throwIfAborted()
      } catch (error) {
        signal?.throwIfAborted()
        if (isRetryableDarwinboxListingError(error)) {
          throw new DarwinboxUpstreamUnavailableError(source, buildListingApiUrl(companyId), error)
        }
        throw error
      }

      validateListingPayload(payload, source, pageNumber, pageSize)
      pagesFetched += 1
      if (payload.job_counts != null) {
        const nextTotal = Number(payload.job_counts)
        if (reportedTotal != null && nextTotal !== reportedTotal) duplicateRecords = true
        reportedTotal = nextTotal
      }
      for (const record of payload.data) {
        const id = normalizeWhitespace(record.id)
        if (recordIds.has(id)) duplicateRecords = true
        recordIds.add(id)
      }
      const results = extractSearchResults(payload)

      for (const job of results) {
        jobs.push({
          ...job,
          source,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return finish()
        }
      }

      const totalJobCount = Number.parseInt(String(payload?.job_counts ?? ''), 10)
      const hasMore = Number.isFinite(totalJobCount)
        ? pageNumber * pageSize < totalJobCount
        : Array.isArray(payload?.data) && payload.data.length === pageSize

      if (!hasMore) { exhausted = true; break }
      pageNumber += 1
    }

    return finish()
  }

  return {
    buildCareersPageUrl,
    buildListingApiUrl,
    buildJobDetailUrl,
    buildJobDetailApiUrl,
    extractSearchResults,
    fetchListingPageFromApi,
    fetchJobDetailFromApi,
    validateJobDetail,
    extractJobDetailFacts,
    run,
  }
}

const scraper = createDarwinboxScraper()

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Darwinbox scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, DEFAULT_SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
