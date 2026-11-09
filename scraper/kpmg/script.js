import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { buildHttpError, composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { collectOracleRequisitionJobs } from '../../scraper-support/utils/oracleRequisitionInventory.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const API_BASE_URL = 'https://ejgk.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL = 'https://ejgk.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
const PUBLIC_CAREERS_BASE_URL = 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites'
const DEFAULT_LOCATION = 'India'
const DEFAULT_LIMIT = 24
const DEFAULT_DETAIL_CONCURRENCY = 6

export const SITE_NUMBERS = ['CX_1', 'CX_3', 'CX_3001']
export const CURRENT_ORACLE_SITE_NUMBERS = Object.freeze(['CX_3', 'CX_3001'])
export const CAREERS_URL = 'https://kpmg.com/in/en/careers.html'
export const INDIA_PRACTICE_URL = 'https://kpmgindia.talentrecruit.com/career-page'
export const KPMG_SURFACE_EVIDENCE = Symbol.for('jobverify.kpmg-current-hiring-surfaces')

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+:/g, ':'),
)

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(',')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join(', ')
}

const extractCity = (location) => normalizeLocation(location)?.split(',')[0] || null

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  }

  if (Array.isArray(payload?.requisitionList)) {
    return payload.requisitionList
  }

  return []
}

const getRequisitionDetail = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const getIndiaLocation = (record = {}) => {
  const locations = [{ CountryCode: record.PrimaryLocationCountry, Name: record.PrimaryLocation },
    ...(Array.isArray(record.secondaryLocations) ? record.secondaryLocations : [])]
  const location = locations.find(item => (nativeCountryName(item?.CountryCode)
    || nativeLocationCountryName(item?.Name || item?.LocationName)) === 'India')
  return location ? normalizeWhitespace(location.Name || location.LocationName) || 'India' : null
}
const isIndiaJob = record => Boolean(getIndiaLocation(record))

export const buildSearchUrl = ({
  siteNumber = SITE_NUMBERS[0],
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
} = {}) => {
  const offset = Math.max(0, Number(page) || 0) * (Number(limit) || DEFAULT_LIMIT)
  return `${API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${siteNumber},limit=${Number(limit) || DEFAULT_LIMIT},offset=${offset},location=${location}`
}

export const buildJobDetailUrl = ({ siteNumber = SITE_NUMBERS[0], jobId }) =>
  `${PUBLIC_CAREERS_BASE_URL}/${siteNumber}/job/${jobId}`

export const buildJobDetailApiUrl = ({ siteNumber = SITE_NUMBERS[0], jobId }) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${siteNumber}`

const extractExperienceRequired = ({
  title,
  minimumQualification,
  jobDescription,
}) => (
  extractJobFilterSignals({
    title,
    minimumQualification,
    jobDescription,
    experienceRequired: null,
  }).experienceProfile?.evidence || null
)

const toJob = (record = {}, { siteNumber = SITE_NUMBERS[0] } = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const detailUrl = jobId ? buildJobDetailUrl({ siteNumber, jobId }) : null
  const title = normalizeWhitespace(record.Title)
  const minimumQualification = normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr)
  const jobDescription = joinDescriptionParts(
    record.ShortDescriptionStr,
    record.ExternalResponsibilitiesStr,
  )
  const location = getIndiaLocation(record)

  return {
    title,
    company: 'KPMG',
    department: normalizeWhitespace(record.Department || record.JobFunction || record.JobFamily),
    location: normalizeLocation(location),
    city: extractCity(location),
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: 'Full-time',
    experienceRequired: extractExperienceRequired({
      title,
      minimumQualification,
      jobDescription,
    }),
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(record.PostedDate),
    closingDate: normalizeWhitespace(record.PostingEndDate),
    jobDescription,
  }
}

export const extractSearchResults = (payload, options = {}) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toJob(record, options))

export const extractJobDetail = (payload, listing = {}, { siteNumber = SITE_NUMBERS[0] } = {}) => {
  const detail = getRequisitionDetail(payload)
  const title = normalizeWhitespace(detail.Title) || listing.title || null
  const minimumQualification = normalizeWhitespace(detail.StudyLevel || detail.ExternalQualificationsStr) || listing.minimumQualification || null
  const jobDescription = joinDescriptionParts(
    detail.ExternalDescriptionStr,
    detail.ShortDescriptionStr,
    detail.ExternalResponsibilitiesStr,
    detail.ExternalQualificationsStr,
  ) || listing.jobDescription || null
  const jobId = normalizeWhitespace(detail.Id) || listing.jobId || null
  const location = normalizeLocation(getIndiaLocation(detail)) || listing.location || null
  const detailUrl = jobId ? buildJobDetailUrl({ siteNumber, jobId }) : listing.sourceUrl || listing.applyUrl || null

  return {
    title,
    company: 'KPMG',
    department: normalizeWhitespace(detail.Department || detail.JobFunction || detail.JobFamily) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeWhitespace(detail.JobSchedule || detail.RequisitionType || detail.JobType || detail.WorkerType || detail.ContractType) || listing.employmentType || 'Full-time',
    experienceRequired: extractExperienceRequired({
      title,
      minimumQualification,
      jobDescription,
    }) || listing.experienceRequired || null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeWhitespace(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    jobDescription,
    publicExperienceChecked: true,
  }
}

export const extractPaginationSummary = (payload, { page = 0 } = {}) => {
  const summary = payload?.items?.[0] || {}
  const pageSize = Number(summary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(summary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

const incomplete = message => Object.assign(new Error(`[kpmg] ${message}`), {
  softFailure: true, upstreamOutage: false, failureKind: 'upstream_contract_changed', abortRetries: true,
})

const readResponse = async (url, fetchImpl, { signal } = {}, asPage = false) => {
  const requestSignal = composeAbortSignals(signal, AbortSignal.timeout(20000))
  try {
    return await readNativeWithSignal(async () => {
      const response = await fetchImpl(url, { headers: asPage
        ? { ...REQUEST_HEADERS, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } : REQUEST_HEADERS,
        signal: requestSignal, redirect: 'follow' })
      if (asPage) return { status: response.status ?? (response.ok ? 200 : null), url: response.url || url, body: await response.text() }
      if (!response.ok) throw buildHttpError(response, url)
      let sameOrigin = false
      try { sameOrigin = new URL(response.url || url).origin === new URL(url).origin } catch { /* A response without a native origin cannot qualify. */ }
      if (!sameOrigin) throw incomplete('Native API redirected away from its verified Oracle origin')
      return response.json()
    }, requestSignal)
  } catch (error) {
    signal?.throwIfAborted()
    throw error
  }
}

const verifyCorporateHandoffs = page => {
  if (page.status !== 200) throw buildHttpError({ status: page.status }, CAREERS_URL)
  let sameOrigin = false
  try { sameOrigin = new URL(page.url).origin === new URL(CAREERS_URL).origin } catch { /* Invalid response identity. */ }
  if (!sameOrigin || typeof page.body !== 'string') throw incomplete('Official corporate careers handoff is unavailable')
  const document = readNativeDocument(page.body)
  for (const [label, expected] of [
    ['Search and Apply - KI', INDIA_PRACTICE_URL],
    ['Search and Apply - KGS', `${PUBLIC_CAREERS_BASE_URL}/CX_3`],
    ['Search and Apply - KDN India', `${PUBLIC_CAREERS_BASE_URL}/CX_3001`],
  ]) {
    const targets = document.nodes(node => node.tag === 'a' && typeof node.attrs.href === 'string')
      .filter(anchor => normalizeWhitespace(document.text(anchor)) === label)
      .map(anchor => new URL(anchor.attrs.href, CAREERS_URL).href)
    if (!targets.length || targets.some(url => url !== expected)) throw incomplete(`Official corporate hiring surface changed: ${label}`)
  }
}

export const createKpmgScraper = ({
  maxPages = Infinity,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchImpl = fetch,
  siteNumbers = CURRENT_ORACLE_SITE_NUMBERS,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => ({
  async run({ signal } = {}) {
    signal?.throwIfAborted()
    if (!Array.isArray(siteNumbers) || !siteNumbers.length || new Set(siteNumbers).size !== siteNumbers.length
      || siteNumbers.some(site => !CURRENT_ORACLE_SITE_NUMBERS.includes(site))) throw incomplete('Only currently declared Oracle hiring surfaces can be collected')
    if (!(maxPages === Infinity || Number.isSafeInteger(maxPages) && maxPages > 0)
      || maxJobs != null && !(Number.isSafeInteger(maxJobs) && maxJobs > 0)
      || !Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 10) throw new RangeError('Invalid KPMG native collection limits')

    verifyCorporateHandoffs(await readResponse(CAREERS_URL, fetchImpl, { signal }, true))
    let practice
    try {
      const page = await readResponse(INDIA_PRACTICE_URL, fetchImpl, { signal }, true)
      practice = { surface: INDIA_PRACTICE_URL, status: page.status, finalUrl: page.url, listingComplete: false,
        reason: page.status === 200 ? 'unqualified-current-talentrecruit-native-inventory' : `talentrecruit-http-${page.status}` }
    } catch (error) {
      signal?.throwIfAborted()
      practice = { surface: INDIA_PRACTICE_URL, listingComplete: false, reason: 'talentrecruit-public-read-unavailable',
        error: String(error?.message || 'Public read failed').slice(0, 300) }
    }

    const jobs = []
    const seenIds = new Set(), surfaces = [practice]
    for (const siteNumber of siteNumbers) {
      if (maxJobs != null && jobs.length >= maxJobs) break
      const child = await collectOracleRequisitionJobs({ source: 'kpmg', siteNumber, maxPages,
        maxJobs: maxJobs == null ? null : maxJobs - jobs.length, detailConcurrency, signal,
        buildSearchUrl: options => buildSearchUrl({ ...options, siteNumber }),
        buildJobDetailApiUrl: jobId => buildJobDetailApiUrl({ siteNumber, jobId }),
        extractSearchResults: payload => extractSearchResults(payload, { siteNumber }),
        extractJobDetail: (payload, listing) => extractJobDetail(payload, listing, { siteNumber }),
        fetchJson: (url, options) => readResponse(url, fetchImpl, options),
        isNativeRoleId: id => /^(?:\d{1,32}|INTG\d{1,24})$/.test(String(id ?? '')),
      })
      surfaces.push({ siteNumber, ...readInventoryEvidence(child), returnedRecords: child.length })
      for (const job of child) {
        if (seenIds.has(job.jobId)) throw incomplete('Native Oracle identities overlap across declared hiring boards')
        seenIds.add(job.jobId)
        jobs.push({ ...job, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
      }
    }
    signal?.throwIfAborted()
    const evidence = { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false,
      pagesFetched: surfaces.reduce((sum, surface) => sum + (surface.pagesFetched || 0), 0),
      reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: `kpmg-current-hiring-surfaces-incomplete;${practice.reason}` }
    if (!jobs.length) throw Object.assign(incomplete('No verified India roles on the current hiring surfaces'), {
      failureKind: 'coverage_gap', inventoryEvidence: evidence,
    })
    const surfaceEvidence = Object.freeze({ source: 'kpmg', surfaces,
      omittedRetiredOracleSites: ['CX_1'], allDeclaredSurfacesQualified: false })
    jobs[0].nativeCollectionEvidence = surfaceEvidence
    Object.defineProperty(jobs, KPMG_SURFACE_EVIDENCE, { value: surfaceEvidence, configurable: true })
    return attachInventoryEvidence(jobs, evidence)
  },
})

export const run = async (options = {}) => createKpmgScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running KPMG scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'kpmg')
    console.log('DB result:', result)
    process.exit(0)
  }
}
