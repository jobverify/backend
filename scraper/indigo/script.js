import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { composeAbortSignals, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { withRetry } from '../../scraper-support/utils/retry.js'
import { INDIGO_CATALOG } from './catalog.js'
import { runNativeIndigo } from './nativeRun.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INDIGO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const DEPARTMENTS_URL = PROVIDER_METADATA.careersDepartmentsUrl
export const JOB_SEARCH_URL = PROVIDER_METADATA.careersJobSearchUrl
export const SAMPLE_DEPARTMENT_URL = PROVIDER_METADATA.sampleDepartmentUrl
export const JOB_SEARCH_API_URL = PROVIDER_METADATA.jobSearchApiUrl
export const CAREER_MS_USER_KEY = PROVIDER_METADATA.careerMsUserKey
export const SUCCESSFACTORS_APPLY_URL_PREFIX = PROVIDER_METADATA.successFactorsApplyUrlPrefix
export const SUCCESSFACTORS_HOST = PROVIDER_METADATA.successFactorsHost || 'career44.sapsf.com'
export const SUCCESSFACTORS_COMPANY_TOKEN = PROVIDER_METADATA.successFactorsCompanyToken || 'interglobe'
export const OPAQUE_SUCCESSFACTORS_URL =
  `https://${SUCCESSFACTORS_HOST}/career?career_ns=subscribe&company=${SUCCESSFACTORS_COMPANY_TOKEN}&navBarLevel=MY_PROFILE`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OPAQUE_SUCCESSFACTORS_ERROR_TEXT =
  'An error occurred while processing your request. Please go back to your original page and check the URL. Then try your request again.'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_PAGE_URL) => {
  try {
    return new URL(decodeHtmlEntities(String(value ?? '')), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeSuccessFactorsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, CAREERS_PAGE_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    if (url.hostname.toLowerCase() !== SUCCESSFACTORS_HOST) return null
    if (url.pathname !== '/career') return null
    if (url.searchParams.get('company')?.toLowerCase() !== SUCCESSFACTORS_COMPANY_TOKEN) return null
    return OPAQUE_SUCCESSFACTORS_URL
  } catch {
    return null
  }
}

const defaultFetchPage = async (url, { signal: abortSignal } = {}) => {
  return withRetry(async () => {
    abortSignal?.throwIfAborted()
    const requestSignal = composeAbortSignals(abortSignal, typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15000) : undefined)
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: requestSignal,
    })

    abortSignal?.throwIfAborted()
    requestSignal?.throwIfAborted()
    const html = await response.text()
    abortSignal?.throwIfAborted()
    requestSignal?.throwIfAborted()
    return { status: response.status, url: response.url, html }
  }, {
    signal: abortSignal,
    attempts: 3,
    baseDelayMs: 250,
    label: `${SOURCE}-page`,
  })
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Origin: 'https://www.goindigo.in',
    Referer: JOB_SEARCH_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  signal: options.signal,
  redirect: 'follow',
  attempts: 3,
  baseDelayMs: 250,
  timeoutMs: 20000,
  label: `${SOURCE}-json`,
})

export const hasOfficialCareersLandingSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Log in for getting posted on new career opportunities with IndiGo!')
    && normalized.includes('Find your next job at IndiGo')
    && normalized.includes('View all jobs')
    && normalized.includes('Airport Operations & Customer Services')
    && normalized.includes('Engineering')
    && normalized.includes('CarGo')
}

export const hasDepartmentsPageSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Find Your Perfect Job')
    && normalized.includes('Browse job by Departments')
    && normalized.includes('Airport Operations & Customer Services')
    && normalized.includes('View all jobs')
    && normalized.includes('Engineering')
    && normalized.includes('CarGo')
}

export const hasDepartmentDetailSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Airport Operations & Customer Services')
    && normalized.includes('This department manages the activities at the airport pertaining to passenger travel')
    && normalized.includes('Teams in Airport Operations & Customer Services Department')
    && normalized.includes('VIEW ALL EVENTS')
}

export const hasJobSearchShellSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Careers All Jobs')
    && normalized.includes('Please enter valid email address.')
    && /data-component=["']mf-job-search["']/i.test(String(html ?? ''))
}

export const extractCareersLoginUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const normalizedUrl = normalizeSuccessFactorsUrl(match[1])
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

const extractEnvValue = (html, key) => {
  const match = String(html ?? '').match(new RegExp(`${key}\\s*:\\s*['"]([^'"]+)['"]`, 'i'))
  return normalizeWhitespace(match?.[1])
}

export const extractJobSearchApiConfig = (html = '') => {
  const jobListApiUrl = extractEnvValue(html, 'CAREER_JOB_SEARCH_RESULT_LIST')
  const applyUrlPrefix = extractEnvValue(html, 'CAREER_APPLY_NOW_URL')
  const userKey = extractEnvValue(html, 'CAREER_MS')

  if (!jobListApiUrl || !applyUrlPrefix || !userKey) return null

  return {
    jobListApiUrl,
    applyUrlPrefix,
    userKey,
  }
}

export const hasPublicJobSearchApiSignal = (html = '') => {
  if (!hasJobSearchShellSignal(html)) return false

  const config = extractJobSearchApiConfig(html)
  return config?.jobListApiUrl === JOB_SEARCH_API_URL
    && config.applyUrlPrefix === SUCCESSFACTORS_APPLY_URL_PREFIX
    && config.userKey === CAREER_MS_USER_KEY
}

export const hasFirstPartyPublicJobsSignal = (html = '') =>
  hasPublicJobSearchApiSignal(html)
  || /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? ''))
  || /\bcareer_ns=job_listing_summary\b/i.test(String(html ?? ''))

export const isOpaqueSuccessFactorsSurface = (page = {}) =>
  Number(page.status) === 200
  && normalizeComparableUrl(page.url) === normalizeComparableUrl(OPAQUE_SUCCESSFACTORS_URL)
  && (stripTags(page.html) || '').includes(OPAQUE_SUCCESSFACTORS_ERROR_TEXT)
  && !hasFirstPartyPublicJobsSignal(page.html)

const verifyPage = ({
  page,
  expectedUrl,
  signal,
  errorLabel,
}) => {
  if (page.status !== 200 || normalizeComparableUrl(page.url) !== normalizeComparableUrl(expectedUrl)) {
    throw new Error(`Indigo verified ${errorLabel} no longer matches the known first-party surface`)
  }

  if (!signal(page.html)) {
    throw new Error(`Indigo verified ${errorLabel} no longer matches the known first-party surface`)
  }
}

export const parseSapDate = (value) => {
  const match = String(value ?? '').match(/\/Date\((-?\d+)\)\//)
  if (!match) return null

  const timestamp = Number.parseInt(match[1], 10)
  if (!Number.isFinite(timestamp)) return null

  return new Date(timestamp).toISOString()
}

const firstResult = (value) => Array.isArray(value?.results) ? value.results[0] : null

const getOpenPosting = (item = {}) => {
  const postings = Array.isArray(item.jobReqPostings?.results) ? item.jobReqPostings.results : []
  return postings.find((posting) => posting.boardId === '_external') || postings[0] || null
}

const isOpenJob = (item = {}) => {
  const deleted = normalizeWhitespace(item.deleted)
  if (deleted && !/^not deleted$/i.test(deleted) && /deleted/i.test(deleted)) return false

  const status = firstResult(item.status)
  if (!status) return true

  return /open/i.test(normalizeWhitespace(status.externalCode) || '')
    && /active/i.test(normalizeWhitespace(status.status) || '')
}

const getLocationLabel = (item = {}) => {
  const locations = Array.isArray(item.location_obj?.results) ? item.location_obj.results : []
  const names = locations
    .map((location) => normalizeWhitespace(location.name || location.externalCode))
    .filter(Boolean)

  if (!names.length) return null
  if (names.length === 1) return names[0]
  return names.join(', ')
}

const buildLocation = (item = {}) => {
  const location = getLocationLabel(item)
  if (!location) return null
  if (/^pan[-\s]?india$/i.test(location)) return `${location}, India`
  if (/(?:^|,\s*)India(?:$|[\s,)(-])/i.test(location)) return location
  return `${location}, India`
}

const buildApplyUrl = (applyUrlPrefix, jobReqId) => {
  if (!applyUrlPrefix || !jobReqId) return null
  return `${applyUrlPrefix}${encodeURIComponent(String(jobReqId))}`
}

export const extractJobsFromApiPayload = (
  payload,
  {
    applyUrlPrefix = SUCCESSFACTORS_APPLY_URL_PREFIX,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const records = Array.isArray(payload?.result) ? payload.result : []

  return records
    .filter(isOpenJob)
    .map((item) => {
      const locale = firstResult(item.jobReqLocale) || {}
      const jobReqId = normalizeWhitespace(item.jobReqId)
      const title = normalizeWhitespace(locale.externalTitle)
      const location = buildLocation(item)
      const applyUrl = buildApplyUrl(applyUrlPrefix, jobReqId)
      const posting = getOpenPosting(item)

      if (!jobReqId || !title || !location || !applyUrl) return null

      return {
        title,
        company: COMPANY,
        department:
          normalizeWhitespace(item.department_obj?.name)
          || normalizeWhitespace(item.division_obj?.name),
        location,
        city: normalizeCity(location.split(',')[0]),
        country: 'India',
        link: applyUrl,
        applyUrl,
        sourceUrl: applyUrl,
        source: SOURCE,
        jobId: jobReqId,
        requisitionId: jobReqId,
        numberOpenings: Number.parseInt(item.numberOpenings, 10) || null,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: parseSapDate(posting?.postStartDate),
        closingDate: parseSapDate(posting?.postEndDate),
        jobDescription: stripTags(locale.externalJobDescription),
        publicExperienceChecked: true,
        remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
        scrapedAt,
      }
    })
    .filter(Boolean)
}

export const createIndigoScraper = () => ({
  async run({
    fetchPage: rawFetchPage = defaultFetchPage,
    fetchJson: rawFetchJson = defaultFetchJson,
    signal: abortSignal,
    now = () => new Date().toISOString(),
  } = {}) {
    abortSignal?.throwIfAborted()
    const read = async (fetchSurface, url, options = {}) => {
      abortSignal?.throwIfAborted()
      try {
        const result = await fetchSurface(url, { ...options, signal: abortSignal || options.signal })
        abortSignal?.throwIfAborted()
        return result
      } catch (error) {
        abortSignal?.throwIfAborted()
        throw error
      }
    }
    const fetchPage = (url, options) => read(rawFetchPage, url, options)
    const fetchJson = (url, options) => read(rawFetchJson, url, options)
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    verifyPage({
      page: careersPage,
      expectedUrl: CAREERS_PAGE_URL,
      signal: hasOfficialCareersLandingSignal,
      errorLabel: 'careers landing page',
    })

    const jobSearchPage = await fetchPage(JOB_SEARCH_URL)
    verifyPage({
      page: jobSearchPage,
      expectedUrl: JOB_SEARCH_URL,
      signal: hasPublicJobSearchApiSignal,
      errorLabel: 'job-search API contract',
    })

    const config = extractJobSearchApiConfig(jobSearchPage.html)
    const payload = await fetchJson(config.jobListApiUrl, {
      method: 'GET',
      headers: {
        user_key: config.userKey,
      },
    })

    const jobs = extractJobsFromApiPayload(payload, {
      applyUrlPrefix: config.applyUrlPrefix,
      scrapedAt: now(),
    })

    if (jobs.length === 0) {
      throw new Error('Indigo public jobs API returned no public India jobs')
    }

    return attachInventoryEvidence(jobs.map(job => ({ ...job, sourceListingComplete: false, sourceDetailComplete: false, sourceDetailStatus: 'legacy-contract-unqualified' })), {
      status: 'discovery-only', surface: JOB_SEARCH_API_URL, firstParty: true,
      listingComplete: false, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: now(), reason: 'legacy-unreconciled-public-feed-contract',
    })
  },
})

export const run = async (options = {}) => options.fetchPage || options.fetchJson
  ? createIndigoScraper().run(options)
  : runNativeIndigo(options)

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
