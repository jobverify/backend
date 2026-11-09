import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals, fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { withRetry } from '../../scraper-support/utils/retry.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NEW_VISION_SOFTWARE_CONSULTANCY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const JOB_LISTINGS_URL = PROVIDER_METADATA.jobListingsUrl
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_SEARCH_BODY = {}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PAGE_REQUEST_TIMEOUT_MS = 30000
const API_REQUEST_TIMEOUT_MS = 30000
const DETAIL_PARTS = 'basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'
const LEGAL_EMPLOYER = 'New Vision Softcom & Consultancy Pvt. Ltd'
const TENANT_ORGANIZATION_ROOTS = new Set(['NewVison', 'NewVision'])
const fail = message => { throw new Error(`NewVision ${message}`) }
const hasExpectedEmployerPrefix = value => {
  if (typeof value !== 'string') return false
  const parts = value.split('>')
  return parts.every(part => part.trim()) && TENANT_ORGANIZATION_ROOTS.has(parts[0]) && parts[1] === LEGAL_EMPLOYER
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const dedupeParts = (parts = []) => parts.filter(
  (part, index) => index === 0 || part.toLowerCase() !== parts[index - 1].toLowerCase(),
)

const isRemoteStatusPart = (value) => /^(remote|hybrid|on-?site|work from home|work from office)$/i.test(
  normalizeWhitespace(value) || '',
)

const isOfficeDescriptor = (value) => /\boffice\b/i.test(String(value ?? ''))

const extractStructuredLocation = (value) => {
  const parts = dedupeParts(
    String(value ?? '')
      .split('>')
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean),
  )

  if (parts.length === 0) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
      remoteStatus: null,
    }
  }

  const remoteStatus = firstNonEmpty(parts.find((part) => isRemoteStatusPart(part)))
  const indiaIndex = parts.findIndex((part) => /^india$/i.test(part))
  const relevantParts = dedupeParts(
    (indiaIndex >= 0 ? parts.slice(indiaIndex + 1) : parts)
      .filter((part) => !isRemoteStatusPart(part))
      .filter((part) => !isOfficeDescriptor(part)),
  )

  const country = indiaIndex >= 0 ? 'India' : null
  const city = relevantParts[0] || null
  let state = relevantParts.length > 1 ? relevantParts[relevantParts.length - 1] : null

  if (state && city && state.toLowerCase() === city.toLowerCase()) {
    state = null
  }

  const location = [city, state, country].filter(Boolean).join(', ') || null

  return {
    location,
    city,
    state,
    country,
    remoteStatus,
  }
}

const extractCountry = (record = {}, location = null) => {
  const explicitCountry = firstNonEmpty(record.country, record.countryName)
  if (explicitCountry) return explicitCountry
  if (/\bindia\b/i.test(String(record.locationHierarchyComplete ?? ''))) return 'India'
  if (/\bindia\b/i.test(String(record.locationHierarchy ?? ''))) return 'India'
  if (/\bindia\b/i.test(String(location ?? ''))) return 'India'
  return null
}

const flattenSkills = (skills = {}) => {
  if (Array.isArray(skills)) {
    return [...new Set(skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean))]
  }

  return [...new Set(
    [skills.mustTohave, skills.goodtohave]
      .flatMap((group) => Array.isArray(group) ? group : [])
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean),
  )]
}

export const buildApiUrl = ({ offset = 0, limit = DEFAULT_PAGE_SIZE } = {}) => (
  `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/jobs/v1?offset=${offset}&limit=${limit}`
)

export const buildJobDetailUrl = (jobCode) => (
  jobCode ? `${PORTAL_ORIGIN}/job/detail/${encodeURIComponent(jobCode.replaceAll('/', '_'))}` : null
)

export const buildJobDetailsApiUrl = jobCode => `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/job/${encodeURIComponent(jobCode.replaceAll('/', '_'))}/v2?part=${DETAIL_PARTS}&isReqId=false`

const assertListingRecord = record => {
  if (!record || !firstNonEmpty(record.jobTitle) || !/^NVS\/[^/]+\/\d+$/.test(record.jobCode || '')
    || !hasExpectedEmployerPrefix(record.organizationUnitComplete)
    || typeof record.locationHierarchyComplete !== 'string' || !record.locationHierarchyComplete.trim()
    || (record.jobDetailUrl && record.jobDetailUrl !== buildJobDetailUrl(record.jobCode))) fail('listing employer, location or application identity is malformed')
  const parts = record.locationHierarchyComplete.split('>').map(normalizeWhitespace)
  if (!['APAC', 'USA'].includes(parts[0]) || !parts[1]) fail('listing country hierarchy is unrecognized')
  if (parts[0] === 'APAC' && parts[1] !== 'India') fail('listing country hierarchy is unrecognized')
  if (record.country && /^India$/i.test(record.country) !== (parts[1] === 'India')) fail('listing country conflicts with its location hierarchy')
}

const assertDetail = (listing, payload) => {
  const detail = payload?.response
  if (payload?.messageCode?.code !== 200 || !detail || detail.requisitionCode !== listing.jobCode
    || String(detail.requisitionId) !== listing.jobCode.split('/').at(-1) || String(detail.entityID) !== '1397'
    || detail.jobTitle !== listing.jobTitle
    || (detail.organizationUnitComplete != null && !hasExpectedEmployerPrefix(detail.organizationUnitComplete))
    || detail.locationHierarchyComplete !== listing.locationHierarchyComplete || detail.requisitionStatus !== 'OPEN') {
    fail('detail identity, employer, open status or location conflicts with the listing')
  }
  if (!extractActiveDescription(detail.jobDescription)) fail('detail published description is missing')
  return detail
}

const mapConcurrent = async (values, concurrency, action) => {
  const results = new Array(values.length)
  let cursor = 0
  let failure = null
  await Promise.allSettled(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length && !failure) {
      const index = cursor++
      try { results[index] = await action(values[index]) }
      catch (error) { failure ??= error }
    }
  }))
  if (failure) throw failure
  return results
}

export const buildPublicHeaders = () => ({
  Origin: PORTAL_ORIGIN,
  Referer: JOB_LISTINGS_URL,
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  'Content-Type': 'application/json',
})

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url, { signal } = {}) =>
  withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: composeAbortSignals(
        signal,
        createTimeoutSignal(PAGE_REQUEST_TIMEOUT_MS),
      ),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }, {
    attempts: 3,
    baseDelayMs: 2000,
    label: `${SOURCE}-page`,
    signal,
  })

const defaultFetchJson = (url, options = {}) =>
  fetchJsonWithRetry(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    label: `${SOURCE}-json`,
    timeoutMs: API_REQUEST_TIMEOUT_MS,
    signal: options.signal,
  })

export const extractPeopleStrongHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    new RegExp(`${escapeRegExp(PORTAL_ORIGIN)}\\/?`, 'i'),
  )

  if (!match) return null
  return match[0].endsWith('/') ? match[0] : `${match[0]}/`
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return normalized.includes('People-first culture, AI-first careers.')
    && normalized.includes('See Open Roles')
    && normalized.includes('Explore Career')
    && normalized.includes('career@newvision-software.com')
    && extractPeopleStrongHandoffUrl(rawHtml) === JOB_LISTINGS_URL
}

export const hasPublicPortalShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Candidate Portal\s*<\/title>/i.test(rawHtml)
    && /<app-root\b[^>]*data-testid=["']src-index-app-root-page-1["']/i.test(rawHtml)
    && /candidate-portal/i.test(rawHtml)
    && /main-[A-Z0-9]+\.js/i.test(rawHtml)
}

const extractLocationDetails = (record = {}) => {
  const structured = extractStructuredLocation(
    firstNonEmpty(record.locationHierarchyComplete, record.locationHierarchy),
  )
  const fallbackLocation = firstNonEmpty(record.locationName, record.location)
  const location = structured.location || fallbackLocation

  return {
    location,
    city: structured.city || firstNonEmpty(String(fallbackLocation ?? '').split(',')[0]),
    state: structured.state,
    country: structured.country || extractCountry(record, location),
    remoteStatus: structured.remoteStatus,
  }
}

export const extractSearchResults = (payload = {}) => (
  Array.isArray(payload.response) ? payload.response : []
)
  .map((record) => {
    const title = firstNonEmpty(record.jobTitle, record.title, record.designation, record.name)
    const jobCode = firstNonEmpty(record.jobCode, record.reqCode, record.requisitionId, record.jobId)
    const sourceUrl = firstNonEmpty(record.jobDetailUrl, buildJobDetailUrl(jobCode))
    const locationDetails = extractLocationDetails(record)

    if (!title || !jobCode || !sourceUrl) return null

    return {
      title,
      company: COMPANY,
      department: firstNonEmpty(record.organizationUnit, record.department, record.departmentName),
      location: locationDetails.location,
      city: locationDetails.city,
      state: locationDetails.state,
      country: locationDetails.country,
      jobId: firstNonEmpty(record.jobCode, record.jobId, record.requisitionId),
      requisitionId: firstNonEmpty(record.requisitionId, record.jobCode, record.jobId),
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: firstNonEmpty(
        record.employmentTenureType,
        record.employmentType,
        record.jobType,
      ),
      experienceRequired: firstNonEmpty(record.expRange, record.experience, record.experienceRange),
      minimumQualification: firstNonEmpty(record.minimumQualification, record.minQualification),
      preferredQualification: firstNonEmpty(record.preferredQualification, record.prefQualification),
      requiredSkills: flattenSkills(record.skills),
      postingDate: firstNonEmpty(record.jobPostedDate, record.postingDate, record.postedOn),
      closingDate: firstNonEmpty(record.jobClosureDate, record.closingDate, record.expiryDate),
      jobDescription: firstNonEmpty(record.jobDescription, record.description),
      remoteStatus: locationDetails.remoteStatus,
    }
  })
  .filter(Boolean)

export const createNewVisionSoftwareConsultancyScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = null,
    detailConcurrency = 6,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
      || !Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 12
      || !(maxPages === Number.POSITIVE_INFINITY || (Number.isSafeInteger(maxPages) && maxPages > 0))
      || (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 1))) fail('inventory pagination or concurrency options are invalid')
    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('NewVision Software & Consultancy verified official careers page no longer matches the known public surface')
    }

    const handoffUrl = extractPeopleStrongHandoffUrl(careersPage.html)
    if (handoffUrl !== JOB_LISTINGS_URL) {
      throw new Error('NewVision Software & Consultancy verified careers page no longer exposes the known PeopleStrong handoff')
    }

    const portalPage = await fetchPage(JOB_LISTINGS_URL, { signal })
    signal?.throwIfAborted()
    if (portalPage.status !== 200 || !hasPublicPortalShell(portalPage.html)) {
      throw new Error('NewVision Software & Consultancy verified public PeopleStrong portal no longer matches the known public surface')
    }

    const jobs = []
    const seen = new Set()
    let total = null
    let fetched = 0
    let pagesFetched = 0
    let complete = false

    for (let page = 0; page < maxPages; page += 1) {
      signal?.throwIfAborted()
      const offset = page * pageSize
      const payload = await fetchJson(buildApiUrl({ offset, limit: pageSize }), {
        method: 'POST',
        headers: buildPublicHeaders(),
        body: JSON.stringify(DEFAULT_SEARCH_BODY),
        signal,
      })
      signal?.throwIfAborted()
      if (payload?.messageCode?.code !== 200 || !Array.isArray(payload.response)
        || !Number.isSafeInteger(payload.totalRecords) || payload.totalRecords < 0
        || (total != null && total !== payload.totalRecords)) fail('listing inventory or total is unavailable, malformed or changed during pagination')
      total = payload.totalRecords
      if (payload.response.length !== Math.min(pageSize, Math.max(total - offset, 0))) fail('listing inventory page count does not reconcile with its total')
      for (const record of payload.response) {
        assertListingRecord(record)
        if (seen.has(record.jobCode)) fail('listing inventory repeats a requisition across pages')
        seen.add(record.jobCode)
      }
      fetched += payload.response.length
      pagesFetched += 1
      let indiaListings = payload.response.filter(record => record.locationHierarchyComplete.split('>')[1] === 'India')
      if (Number.isFinite(maxJobs)) indiaListings = indiaListings.slice(0, Math.max(0, maxJobs - jobs.length))
      const scrapedAt = now()
      const pageJobs = await mapConcurrent(indiaListings, detailConcurrency, async record => {
        signal?.throwIfAborted()
        const detail = assertDetail(record, await fetchJson(buildJobDetailsApiUrl(record.jobCode), {
          method: 'GET', headers: buildPublicHeaders(), signal,
        }))
        signal?.throwIfAborted()
        const job = extractSearchResults({response:[record]})[0]
        const description = extractActiveDescription(detail.jobDescription)
        return {
          ...job, source: SOURCE, link: job.applyUrl || job.sourceUrl, scrapedAt,
          requisitionId: String(detail.requisitionId),
          employmentType: firstNonEmpty(detail.employmentType, job.employmentType),
          jobDescription: description, sourceDescription: description, jobDescriptionHtml: detail.jobDescription,
          ...(detail.organizationUnitComplete !== record.organizationUnitComplete ? { sourceNativeOrganizationEvidence: {
            listingPath: record.organizationUnitComplete, detailPath: detail.organizationUnitComplete ?? null,
            legalEmployer: LEGAL_EMPLOYER, entityID: String(detail.entityID),
          } } : {}),
        }
      })
      jobs.push(...pageJobs)
      if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
      if (fetched === total) { complete = true; break }
    }

    signal?.throwIfAborted()
    for (const job of jobs) job.sourceListingComplete = complete
    return attachInventoryEvidence(jobs, {
      status: complete ? (total === 0 ? 'verified-empty' : 'complete-inventory') : 'discovery-only',
      surface: buildApiUrl({limit:pageSize}), firstParty:true, listingComplete:complete,
      pagesFetched, reportedTotal:total, indiaFacetCount:complete ? jobs.length : null,
      verifiedAt:now(),
      reason: complete
        ? 'Employer-linked PeopleStrong listing reconciled with its reported total; each India detail matched the requisition, legal employer, open status and country hierarchy.'
        : 'Caller limited the listing; positive India details were verified but complete inventory was not established.',
    })
  },
})

export const run = async (options = {}) => createNewVisionSoftwareConsultancyScraper().run(options)

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
