import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

import { MCKINSEY_COMPANY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MCKINSEY_COMPANY_CATALOG.source
export const COMPANY = MCKINSEY_COMPANY_CATALOG.companyName
export const VERIFIED_ON = MCKINSEY_COMPANY_CATALOG.verifiedOn
export const HOMEPAGE_URL = MCKINSEY_COMPANY_CATALOG.homepageUrl
export const INDIA_CAREERS_URL = MCKINSEY_COMPANY_CATALOG.companyCareerPage
export const SEARCH_JOBS_URL = MCKINSEY_COMPANY_CATALOG.publicJobsSearchUrl
export const SEARCH_API_BASE_URL = MCKINSEY_COMPANY_CATALOG.publicSearchApiUrl
export const SEARCH_PAGE_SIZE = MCKINSEY_COMPANY_CATALOG.searchPageSize
export const VERIFIED_SURFACE_SUMMARY = MCKINSEY_COMPANY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = MCKINSEY_COMPANY_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const normalizeDate = (value) => {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toArray = (value) => Array.isArray(value) ? value : []

export const buildSearchApiUrl = ({
  start = 1,
  pageSize = SEARCH_PAGE_SIZE,
  lang = 'en',
} = {}) => `${SEARCH_API_BASE_URL}?pageSize=${pageSize}&start=${start}&lang=${lang}`

export const hasOfficialIndiaCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Careers in India\s*\|\s*India\s*\|\s*McKinsey\s*&amp;\s*Company\s*<\/title>/i.test(page)
    && text.includes('search jobs')
    && text.includes('careers in india')
    && text.includes('join mckinsey india')
    && text.includes('find your ideal job')
    && text.includes('career paths for students')
}

export const hasPublicJobsSearchSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*McKinsey Job Search\s*\|\s*Consulting and Internal Roles\s*\|\s*Careers\s*\|\s*McKinsey\s*&amp;\s*Company\s*<\/title>/i.test(page)
    && page.includes('/careers/search-jobs/en')
    && page.includes('gateway.mckinsey.com')
    && page.includes('__NEXT_DATA__')
}

// These labels are the complete explicit India pairs in the current native
// opening/closing capture. The country must independently say India; this set
// never supplies a country for a city. New/compound labels remain unresolved.
const reviewedIndiaCities = new Set(['Bengaluru', 'Chennai', 'Gurugram', 'Kolkata', 'Mumbai', 'New Delhi'].map(value => value.toLowerCase()))
const nativeLabel = value => typeof value === 'string' && !/[<>]/.test(value)
  ? value.replace(/\s+/g, ' ').trim() || null : null

export const extractIndiaCityPairs = (record = {}) => {
  const cities = toArray(record.cities)
  const countries = toArray(record.countries)
  const pairs = []
  if (cities.length !== countries.length || [...cities, ...countries].some(value => typeof value !== 'string')) return pairs

  for (let index = 0; index < Math.min(cities.length, countries.length); index += 1) {
    const city = nativeLabel(cities[index])
    const country = nativeLabel(countries[index])
    if (!city || !country) continue
    if (country.toLowerCase() !== 'india') continue
    if (!reviewedIndiaCities.has(city.toLowerCase())) continue
    pairs.push({ city, country })
  }

  return pairs
}

const isIndiaJob = (record = {}) => extractIndiaCityPairs(record).length > 0

const buildLocation = (pairs = []) => pairs
  .map(({ city, country }) => `${city}, ${country}`)
  .join(' | ')

const nativeFailure = message => Object.assign(new Error('McKinsey native '+message), {
  softFailure: true, abortRetries: true, lifecycleCleanupAllowed: false,
})

const nativeDescription = record => {
  const fields = ['whoYouWillWorkWith', 'whatYouWillDo', 'yourBackground']
  if (!fields.some(key => Object.hasOwn(record, key))) return { description: extractActiveDescription(record.shortJobSummary), complete: false }
  const descriptions = fields.map(key => typeof record[key] === 'string' ? extractActiveDescription(record[key]) : null)
  if (!descriptions[1] && !descriptions[2]) return { description: null, complete: false }
  const headings = ['Who you will work with', 'What you will do', 'Your background']
  return { description: descriptions.flatMap((value, index) => value ? [`${headings[index]}: ${value}`] : []).join('\n\n'),
    complete: Boolean(descriptions[1] && descriptions[2] && (!Object.hasOwn(record, fields[0]) || descriptions[0])) }
}

const isOwnApplication = (value, id) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://mckinsey.avature.net' && !url.username && !url.password && !url.hash
      && url.pathname === '/careers/ApplicationMethods' && [...url.searchParams].length === 1
      && url.searchParams.get('folderId') === id
  } catch { return false }
}

const toJob = (record = {}, { now = () => new Date().toISOString() } = {}) => {
  const indiaPairs = extractIndiaCityPairs(record)
  const applyUrl = nativeLabel(record.jobApplyURL)
  const jobId = nativeLabel(record.jobID)
  const title = nativeLabel(record.title)
  if (!title || !/^\d+$/.test(jobId || '') || !isOwnApplication(applyUrl, jobId)) throw nativeFailure('title/application/requisition identity conflicts')
  const description = nativeDescription(record)

  return {
    title,
    company: COMPANY,
    department: normalizeValue(record.interest),
    location: buildLocation(indiaPairs),
    city: indiaPairs.length > 1 ? 'Multiple Locations' : (indiaPairs[0]?.city ?? null),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: applyUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.postedToLinkedInDate),
    closingDate: null,
    jobDescription: description.description,
    sourceScopeComplete: false,
    sourceListingComplete: false,
    sourceDetailComplete: description.complete,
    ...(!description.complete ? { sourceDetailFailureKind: 'native-role-criteria-incomplete' } : {}),
    lifecycleCleanupAllowed: false,
    source: SOURCE,
    link: applyUrl,
    scrapedAt: now(),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createMckinseyCompanyScraper = ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(override = {}) {
    const caller = override.signal
    caller?.throwIfAborted()
    const sourceTimeoutMs = override.sourceTimeoutMs ?? 180000
    const requestTimeoutMs = override.requestTimeoutMs ?? 30000
    if (!Number.isSafeInteger(sourceTimeoutMs) || sourceTimeoutMs < 1 || sourceTimeoutMs > 180000
      || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30000) throw RangeError('Invalid McKinsey source/request deadline')
    const started = performance.now(), controller = new AbortController()
    const signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal
    const sourceReason = new DOMException('McKinsey source deadline exceeded', 'TimeoutError')
    const sourceTimer = setTimeout(() => controller.abort(sourceReason), sourceTimeoutMs)
    const check = () => {
      caller?.throwIfAborted()
      if (performance.now() - started >= sourceTimeoutMs && !controller.signal.aborted) controller.abort(sourceReason)
      signal.throwIfAborted()
    }
    const rawFetchText = override.fetchText || fetchText
    const rawFetchJson = override.fetchJson || fetchJson
    const read = async (fetchValue, url, options = {}) => {
      check()
      const requestStarted = performance.now(), request = new AbortController()
      const reason = new DOMException('McKinsey request deadline exceeded', 'TimeoutError')
      const requestSignal = AbortSignal.any([signal, request.signal])
      const timer = setTimeout(() => request.abort(reason), requestTimeoutMs)
      let onAbort
      try {
        const aborted = new Promise((_, reject) => {
          onAbort = () => reject(caller?.aborted ? caller.reason : requestSignal.reason)
          requestSignal.addEventListener('abort', onAbort, { once: true })
        })
        const value = await Promise.race([Promise.resolve().then(() => {
          check(); requestSignal.throwIfAborted()
          return fetchValue(url, { ...options, signal: requestSignal })
        }), aborted])
        check()
        if (performance.now() - requestStarted >= requestTimeoutMs) request.abort(reason)
        requestSignal.throwIfAborted()
        return value
      } catch (error) {
        caller?.throwIfAborted()
        check(); requestSignal.throwIfAborted()
        throw error
      } finally {
        clearTimeout(timer)
        requestSignal.removeEventListener('abort', onAbort)
      }
    }
    const effectiveFetchText = (url, options) => read(rawFetchText, url, options)
    const effectiveFetchJson = (url, options) => read(rawFetchJson, url, options)

    try {
    const indiaCareersHtml = await effectiveFetchText(INDIA_CAREERS_URL)
    if (!hasOfficialIndiaCareersSignal(indiaCareersHtml)) {
      throw new Error('McKinsey & Company verified India careers page no longer matches the first-party handoff')
    }

    const searchJobsHtml = await effectiveFetchText(SEARCH_JOBS_URL)
    if (!hasPublicJobsSearchSignal(searchJobsHtml)) {
      throw new Error('McKinsey & Company verified public search jobs page no longer matches the first-party shell')
    }

    const collect = async () => {
      const records = [], ids = new Set()
      let reportedTotal = null
      for (let page = 1; page <= 100; page++) {
        const payload = await effectiveFetchJson(buildSearchApiUrl({ start: page }))
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw nativeFailure('invalid native inventory payload')
        if (Object.hasOwn(payload, 'numFound')) {
          const total = payload.numFound
          if (!Number.isSafeInteger(total) || total < 0 || total > 100 * SEARCH_PAGE_SIZE
            || reportedTotal !== null && total !== reportedTotal) throw nativeFailure('native inventory total changed or exceeds bounded pagination')
          reportedTotal = total
        } else if (reportedTotal !== null) throw nativeFailure('native inventory total disappeared during pagination')
        if (payload.docs === null && reportedTotal === 0) return { records, reportedTotal }
        if (!Array.isArray(payload.docs) || payload.docs.length > SEARCH_PAGE_SIZE) throw nativeFailure('native inventory pagination contract changed')
        for (const record of payload.docs) {
          const id = nativeLabel(record?.jobID)
          if (!/^\d+$/.test(id || '') || ids.has(id)) throw nativeFailure('duplicate or missing requisition in native pagination')
          ids.add(id); records.push(record)
        }
        if (reportedTotal !== null && records.length > reportedTotal) throw nativeFailure('native inventory exceeds reported total')
        if (!payload.docs.length) {
          if (reportedTotal !== null && records.length !== reportedTotal) throw nativeFailure('incomplete native pagination before reported total')
          return { records, reportedTotal }
        }
        if (reportedTotal !== null && records.length === reportedTotal) return { records, reportedTotal }
      }
      throw nativeFailure('native inventory pagination request budget exceeded')
    }

    const opening = await collect()
    if (opening.reportedTotal !== null) {
      const closingIndia = await effectiveFetchText(INDIA_CAREERS_URL)
      const closingSearch = await effectiveFetchText(SEARCH_JOBS_URL)
      if (!hasOfficialIndiaCareersSignal(closingIndia) || !hasPublicJobsSearchSignal(closingSearch)) throw nativeFailure('closing current publisher declaration changed')
      const closing = await collect()
      const signature = records => JSON.stringify(records.map(record => [record.jobID, record.title, record.cities, record.countries,
        record.jobApplyURL, record.whoYouWillWorkWith, record.whatYouWillDo, record.yourBackground,
        record.shortJobSummary, record.postedToLinkedInDate]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
      if (closing.reportedTotal !== opening.reportedTotal || signature(closing.records) !== signature(opening.records)) throw nativeFailure('closing native inventory or role criteria changed')
    }
    const jobs = opening.records.filter(isIndiaJob).map(record => toJob(record, { now })).filter(job => job.title)
    check()
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: opening.records.length,
      observedVacancyCount: opening.records.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: INDIA_CAREERS_URL, firstParty: false,
      listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: null, reason: 'native-page-index-pagination-and-own-full-criteria;company-scope-and-legacy-transport-metadata-unverified;cleanup-forbidden' })
    } finally {
      clearTimeout(sourceTimer)
      controller.abort()
    }
  },
})

export const run = async (options = {}) => createMckinseyCompanyScraper(options).run(options)

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
