import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'
import { inferExperienceFromPublicPageHtml } from '../../scraper-support/utils/publicExperienceEnrichment.js'
import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { isExactPublicJobUrl } from '../../rewriting/publicPostingDescription.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { AURIGO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AURIGO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SEARCH_PAGE_URL = PROVIDER_METADATA.searchResultsUrl
export const SEARCH_RESULTS_URL = SEARCH_PAGE_URL
export const JOBS_API_URL = 'https://careers.aurigo.com/services/recruiting/v1/jobs'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const DEFAULT_LOCALE = 'en_US'
export const DEFAULT_PAGE_SIZE = 10
export const AURIGO_ERROR_PAGE_URL = 'https://careers.aurigo.com/errorpage/?errortype=Exception'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const parseSlashDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return null

  const month = String(Number.parseInt(match[1], 10)).padStart(2, '0')
  const day = String(Number.parseInt(match[2], 10)).padStart(2, '0')
  const rawYear = Number.parseInt(match[3], 10)
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  const date = `${year}-${month}-${day}`
  return Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null
}

const normalizeArrayValues = (value) => (
  Array.isArray(value)
    ? value.map((entry) => normalizeWhitespace(entry)).filter(Boolean)
    : []
)

const buildJobUrl = (urlTitle, id, locale = DEFAULT_LOCALE) => {
  const normalizedTitle = normalizeWhitespace(urlTitle)
  const normalizedId = normalizeWhitespace(id)
  if (!normalizedTitle || !/^\d+$/.test(normalizedId) || !/^[a-z]{2}_[A-Z]{2}$/.test(locale)) return null
  // The public client and canonical links include the locale after the ID.
  // Omitting it redirects otherwise valid jobs to the employer error page.
  return `https://careers.aurigo.com/job/${normalizedTitle}/${normalizedId}-${locale}/`
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Aurigo Software Technologies Jobs\s*<\/title>/i.test(page)
    && /var\s+CSRFToken\s*=\s*"[^"]*"/i.test(page)
    && page.includes('/platform/js/j2w/min/j2w.searchManager.min.js')
    && page.includes('searchResultView=LIST')
    && normalized.includes('Job listings')
    && normalized.includes('Search jobs')
}

export const extractCsrfToken = (html = '') => (
  String(html ?? '').match(/var\s+CSRFToken\s*=\s*"([^"]+)"/i)?.[1] || null
)

export const extractSearchLocale = (html = '') => (
  String(html ?? '').match(/locale:\s*"([^"]+)"/i)?.[1]
  || String(html ?? '').match(/currentLocale:\s*'([^']+)'/i)?.[1]
  || DEFAULT_LOCALE
)

export const buildJobsApiRequestPayload = ({
  keywords = '',
  locale = DEFAULT_LOCALE,
  location = '',
  pageNumber = 0,
  sortBy = 'recent',
} = {}) => ({
  keywords,
  locale,
  location,
  pageNumber,
  sortBy,
})

export const hasExpectedJobsApiSignal = (payload = {}) => (
  Number.isFinite(Number(payload?.totalJobs))
  && Array.isArray(payload?.jobSearchResult)
)

export const extractJobsFromApiPayload = (payload = {}, { locale = DEFAULT_LOCALE } = {}) => (
  Array.isArray(payload?.jobSearchResult) ? payload.jobSearchResult : []
)
  .map((entry) => entry?.response || null)
  .map((job) => {
    if (!job) return null

    const locations = normalizeArrayValues(job.filter1)
    if (!locations.length || !locations.every((location) => /^India$/i.test(location))) return null

    const title = normalizeWhitespace(job.unifiedStandardTitle || job.title)
    const jobId = normalizeWhitespace(job.id)
    const sourceUrl = buildJobUrl(job.unifiedUrlTitle || job.urlTitle, jobId, locale)

    if (!title || !jobId || !sourceUrl) return null

    const department = normalizeArrayValues(job.division_obj)[0] || null
    const location = locations[0] || 'India'
    const postingDate = parseSlashDate(job.unifiedStandardStart)
    const closingDate = parseSlashDate(job.unifiedStandardEnd)

    return {
      title,
      company: COMPANY,
      department,
      location,
      city: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate,
      ...(postingDate || closingDate ? { sourceDatePrecision: 'day' } : {}),
      ...(closingDate ? { sourceClosingDateIsExact: false } : {}),
      jobDescription: null,
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const page = await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 1,
    label: SOURCE,
    timeoutMs: 15000,
    includeResponseMetadata: true,
    signal,
  })
  return { ...page, finalUrl: page.url }
}

export const pageRedirectsToAurigoError = (value = '') => {
  const normalized = normalizeWhitespace(value)
  return normalized === AURIGO_ERROR_PAGE_URL
}

// Employer-rendered JobPosting microdata is present on the canonical locale
// route even though the older numeric-only route returns an exception page.
export const extractAurigoNativeDetail = (job, page = {}, nativeListingRecord) => {
  if (page.status !== 200 || job.company !== COMPANY) return null
  try {
    const source = new URL(job.sourceUrl)
    const route = source.pathname.match(/^\/job\/([^/]+)\/(\d+)(?:-en_US)?\/?$/)
    if (source.origin !== 'https://careers.aurigo.com' || source.search || source.hash || !route || route[2] !== job.jobId) return null
    const canonicalUrl = `${source.origin}/job/${route[1]}/${job.jobId}-en_US/`
    if (!isExactPublicJobUrl(canonicalUrl, page.finalUrl || page.url)) return null
    const document = readNativeDocument(page.html)
    const canonicals = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
    const headTitles = document.nodes(node => node.tag === 'title')
    const shells = document.nodes(node => document.hasClass(node, 'jobDisplayShell') && node.attrs.itemtype === 'http://schema.org/JobPosting')
    const titles = document.nodes(node => node.attrs.itemprop === 'title')
    const descriptions = document.nodes(node => node.attrs.itemprop === 'description')
    const contains = (parent, child) => parent === child || parent.children.some(node => typeof node !== 'string' && contains(node, child))
    if (canonicals.length !== 1 || !isExactPublicJobUrl(canonicalUrl, canonicals[0].attrs.href)
      || headTitles.length !== 1 || normalizeWhitespace(headTitles[0].raw) !== `${normalizeWhitespace(job.title)} Job Details | ${COMPANY}`
      || shells.length !== 1 || titles.length !== 1 || descriptions.length !== 1
      || !contains(shells[0], titles[0]) || !contains(shells[0], descriptions[0])
      || document.text(titles[0]) !== normalizeWhitespace(job.title)) return null
    const tokens = document.nodes(node => document.hasClass(node, 'joblayouttoken') && contains(shells[0], node)).map(document.text)
    const values = label => tokens.filter(value => value.startsWith(label)).map(value => value.slice(label.length).trim())
    const starts = values('Posting Start Date:'), locations = values('Posting Location:')
    if (starts.length !== 1 || locations.length !== 1) return null
    const postingDate = parseSlashDate(starts[0])
    if (!postingDate) return null
    let closingDate = null, listingIndia = false
    if (nativeListingRecord) {
      const countries = normalizeArrayValues(nativeListingRecord.filter1)
      if (normalizeWhitespace(nativeListingRecord.id) !== job.jobId
        || normalizeWhitespace(nativeListingRecord.unifiedStandardTitle || nativeListingRecord.title) !== normalizeWhitespace(job.title)
        || !countries.length || !countries.every(value => /^India$/i.test(value))
        || parseSlashDate(nativeListingRecord.unifiedStandardStart) !== postingDate) return null
      closingDate = parseSlashDate(nativeListingRecord.unifiedStandardEnd)
      if (nativeListingRecord.unifiedStandardEnd && !closingDate) return null
      listingIndia = true
    }
    if (locations[0] ? !/(?:^|,\s*)India$/i.test(locations[0]) : !listingIndia) return null
    const nativeLocation = locations[0] || 'India'
    const nativeCity = locations[0].split(',').map(value => value.trim()).find(value => value && !/^India$/i.test(value))
    const description = extractActiveDescription(document.text(descriptions[0]))
    return {
      sourceDescription: description, jobDescription: description,
      location: nativeLocation, locations: [nativeLocation], city: nativeCity ? normalizeCity(nativeCity) : null,
      sourceLocationEvidence: locations[0] ? 'aurigo-native-visible-posting-location-v1' : 'aurigo-native-listing-country-only-v1',
      sourceDetailComplete: Boolean(description),
      ...(description ? {} : { sourceDetailFailureKind: 'missing-content' }),
      sourceDetailEvidence: 'aurigo-native-canonical-role-microdata-v1', sourceCanonicalUrl: canonicalUrl,
      postingDate, sourcePostingDate: postingDate, sourceDatePrecision: 'day', sourceDateEvidence: 'aurigo-native-posting-dates-v1',
      ...(closingDate ? { closingDate, sourceClosingDate: closingDate, sourceClosingDateIsExact: false } : {}),
      publicExperienceChecked: true,
    }
  } catch {
    return null
  }
}

export const createAurigoScraper = ({ maxPages = 10, maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchPage = defaultFetchPage,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const searchShell = await fetchText(SEARCH_PAGE_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(searchShell)) {
      throw new Error('The verified Aurigo search shell no longer matches the trusted first-party jobs surface')
    }

    const csrfToken = extractCsrfToken(searchShell)
    if (!csrfToken) {
      throw new Error('The verified Aurigo search shell no longer exposes the first-party jobs API token')
    }

    const locale = extractSearchLocale(searchShell)
    const jobs = []
    const seenJobIds = new Set()
    const nativeRecords = new Map()
    let accumulatedRawResults = 0

    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const payload = buildJobsApiRequestPayload({ locale, pageNumber })
      const response = await fetchJson(JOBS_API_URL, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          Referer: SEARCH_PAGE_URL,
          Origin: 'https://careers.aurigo.com',
          Accept: 'application/json,text/plain,*/*',
        },
        body: JSON.stringify(payload),
        signal,
      })
      signal?.throwIfAborted()

      if (!hasExpectedJobsApiSignal(response)) {
        throw new Error('The verified Aurigo jobs API no longer matches the trusted first-party jobs surface')
      }

      const rawResults = Array.isArray(response.jobSearchResult) ? response.jobSearchResult : []
      const pageJobs = extractJobsFromApiPayload(response, { locale })
      for (const entry of rawResults) if (entry?.response?.id != null) nativeRecords.set(String(entry.response.id), entry.response)
      accumulatedRawResults += rawResults.length

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue
        seenJobIds.add(job.jobId)
        jobs.push(job)
      }

      if (rawResults.length === 0) break

      const totalJobs = Number.parseInt(response.totalJobs, 10)
      if (Number.isFinite(totalJobs) && accumulatedRawResults >= totalJobs) break
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    const verifiedJobs = await Promise.all(selectedJobs.map(async (job) => {
      const publicJob = {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        sourceListingComplete: false,
      }

      try {
        signal?.throwIfAborted()
        const publicPage = await fetchPage(job.sourceUrl, { signal })
        signal?.throwIfAborted()
        if (pageRedirectsToAurigoError(publicPage.finalUrl)) {
          return {
            ...publicJob,
            publicExperienceChecked: true,
          }
        }

        const nativeDetail = extractAurigoNativeDetail(publicJob, publicPage, nativeRecords.get(job.jobId))
        if (nativeDetail) return { ...publicJob, ...nativeDetail }

        // Canonical source recovery requires a successful response at the exact
        // role URL. Passing only HTML loses that proof and keeps the role private.
        return inferExperienceFromPublicPageHtml(publicJob, {
          html: publicPage.html,
          status: publicPage.status,
          url: publicPage.finalUrl || publicPage.url,
        })
      } catch {
        signal?.throwIfAborted()
        return publicJob
      }
    }))

    return verifiedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAurigoScraper().run(options)

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
