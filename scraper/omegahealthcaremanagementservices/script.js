import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { collectOracleRequisitionJobs } from '../../scraper-support/utils/oracleRequisitionInventory.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readNativeWithSignal, nativePaginationLimits, loadNativePaginationDefaults } from '../../scraper-support/utils/nativePagination.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'omegahealthcaremanagementservices'
export const COMPANY_NAME = 'Omega Healthcare Management Services'
export const COMPANY_DOMAIN = 'omegahms.com'
export const GLOBAL_CAREERS_URL = 'https://www.omegahms.com/careers/'
export const INDIA_CAREERS_URL = 'https://www.omegahms.com/careers-india/'
export const ORACLE_HOST = 'https://fa-equm-saasfaprod1.fa.ocs.oraclecloud.com'
export const LISTING_API_BASE_URL = `${ORACLE_HOST}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`
export const DETAIL_API_BASE_URL = `${ORACLE_HOST}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`
export const GLOBAL_SITE_NUMBER = 'CX_1001'
export const INDIA_SITE_NUMBER = 'CX_2001'
export const SITE_NUMBERS = [GLOBAL_SITE_NUMBER, INDIA_SITE_NUMBER]
export const DEFAULT_LOCATION = null
export const DEFAULT_LIMIT = 24
export const OMEGA_INVENTORY_EVIDENCE = Symbol.for('jobverify.omega-inventory')

const contract = message => Object.assign(new Error(`[${SOURCE}] Oracle native contract changed: ${message}`), {
  softFailure: true, upstreamOutage: false, failureKind: 'upstream_contract_changed', abortRetries: true,
})
const roleSections = ['ExternalDescriptionStr', 'ExternalResponsibilitiesStr', 'ExternalQualificationsStr']
const sections = [...roleSections, 'CorporateDescriptionStr', 'OrganizationDescriptionStr']
const closingIsExact = value => typeof value === 'string' && /T\d{2}:\d{2}/i.test(value) && Number.isFinite(Date.parse(value))
const queryFields = ['Keyword', 'CorrectedKeyword', 'SuggestedKeyword', 'Location', 'LocationId', 'Latitude', 'Longitude',
  'SelectedTitlesFacet', 'SelectedCategoriesFacet', 'SelectedPostingDatesFacet', 'SelectedLocationsFacet', 'LastSelectedFacet',
  'JobFamilyId', 'PostingStartDate', 'PostingEndDate', 'SelectedWorkLocationsFacet', 'RequisitionId', 'CandidateNumber',
  'WorkLocationZipCode', 'WorkLocationCountryCode', 'SelectedFlexFieldsFacets', 'OrganizationId', 'SelectedOrganizationsFacet',
  'UserTargetFacetName', 'UserTargetFacetInputTerm', 'HotJobFlag', 'WorkplaceType', 'SelectedWorkplaceTypesFacet', 'BotQRShortCode']

const GLOBAL_TITLE_PATTERN = /<title>\s*Join Our Team \| Omega Healthcare Careers\s*<\/title>/i
const INDIA_TITLE_PATTERN = /<title>\s*Careers \| Omega Healthcare\s*<\/title>/i
const GLOBAL_CANONICAL_PATTERN = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.omegahms\.com\/careers\/?["']/i
const INDIA_CANONICAL_PATTERN = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.omegahms\.com\/careers-india\/?["']/i
const BRAND_PATTERN = /Omega Healthcare(?: Management Services)?/i
const CX_1001_PATTERN = /https:\/\/fa-equm-saasfaprod1\.fa\.ocs\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_1001\/?/i
const CX_2001_PATTERN = /https:\/\/fa-equm-saasfaprod1\.fa\.ocs\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_2001\/?/i

const decodeHtmlEntities = (value) => String(value ?? '')
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
  if (/^india$/i.test(normalized)) return 'India'

  return normalized
    .split(',')
    .map((part) => toTitleCase(part))
    .filter(Boolean)
    .join(', ')
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized || /^india$/i.test(normalized)) return null
  return normalized.split(',')[0] || null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const getSearchSummary = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }

  return payload || {}
}

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => (Array.isArray(item?.requisitionList) ? item.requisitionList : []))
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

const nativeLocations = (record = {}) => {
  const relations = [{ kind: 'primary', code: record.PrimaryLocationCountry, name: record.PrimaryLocation }]
  if (Array.isArray(record.secondaryLocations)) relations.push(...record.secondaryLocations.map(value => ({
    kind: 'secondary', code: value?.CountryCode, name: value?.Name || value?.LocationName,
  })))
  else relations.push({ kind: 'secondary-unresolved', code: null, name: null })
  return relations.map(value => {
    const codeCountry = nativeCountryName(value.code), labelCountry = nativeLocationCountryName(value.name)
    if (codeCountry && labelCountry && codeCountry !== labelCountry) throw contract('conflicting native location countries')
    return { kind: value.kind, countryCode: normalizeWhitespace(value.code)?.toUpperCase() || null,
      name: normalizeWhitespace(value.name), country: codeCountry || labelCountry,
      countryEvidence: codeCountry ? 'native-country-field' : labelCountry ? 'native-country-in-location-label' : null }
  })
}
const getEffectiveLocation = record => [...new Set(nativeLocations(record)
  .filter(value => value.country === 'India').map(value => value.name || 'India'))].join(' / ') || null
const isIndiaJob = record => nativeLocations(record).some(value => value.country === 'India')

const getEmploymentType = (record = {}) =>
  normalizeWhitespace(
    record.JobSchedule
      || record.RequisitionType
      || record.JobType
      || record.WorkerType
      || record.ContractType,
  )

const corporateHandoff = (html, corporateUrl) => {
  const doc = readNativeDocument(html)
  const titles = doc.nodes(node => node.tag === 'title').map(node => node.raw || '')
  const canonicals = doc.nodes(node => node.tag === 'link' && node.attrs.rel?.toLowerCase() === 'canonical')
  const sites = [...new Set(doc.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
    let url
    try { url = new URL(node.attrs.href, corporateUrl) } catch { return [] }
    const match = /^\/hcmUI\/CandidateExperience\/[^/]+\/sites\/(CX_\d+)(?:\/|$)/.exec(url.pathname)
    return url.origin === ORACLE_HOST && match ? [match[1]] : []
  }))]
  return { url: corporateUrl, verified: titles.some(value => BRAND_PATTERN.test(value))
    && canonicals.length === 1 && canonicals[0].attrs.href === corporateUrl && sites.length > 0, sites }
}
export const hasOfficialGlobalCareersSignal = html => corporateHandoff(html, GLOBAL_CAREERS_URL).verified
export const hasOfficialIndiaCareersSignal = html => corporateHandoff(html, INDIA_CAREERS_URL).verified

export const buildSearchUrl = ({
  siteNumber,
  page = 0,
  limit = DEFAULT_LIMIT,
  location = DEFAULT_LOCATION,
  expandSecondaryLocations = true,
} = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit
  const expandPart = expandSecondaryLocations ? 'expand=requisitionList.secondaryLocations&' : ''

  if (!SITE_NUMBERS.includes(siteNumber)) throw contract('unrecognized configured site')
  return `${LISTING_API_BASE_URL}?onlyData=true&${expandPart}finder=findReqs;siteNumber=${siteNumber},limit=${normalizedLimit},offset=${offset}${location ? `,location=${encodeURIComponent(location)}` : ''}`
}

export const buildJobDetailUrl = (siteNumber, jobId) =>
  `${ORACLE_HOST}/hcmUI/CandidateExperience/en/sites/${siteNumber}/job/${normalizeWhitespace(jobId) || ''}`

export const buildJobDetailApiUrl = (siteNumber, jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${siteNumber}`

const toListing = (record = {}, siteNumber) => {
  const jobId = normalizeWhitespace(record.Id)
  const sourceUrl = jobId ? buildJobDetailUrl(siteNumber, jobId) : null
  const location = getEffectiveLocation(record)

  return {
    title: normalizeWhitespace(record.Title),
    company: COMPANY_NAME,
    country: 'India',
    department: normalizeWhitespace(record.Department || record.JobFunction || record.JobFamily || record.Category),
    location,
    city: extractCity(location),
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(record),
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(record.StudyLevel || record.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeDate(record.PostedDate || record.ExternalPostedStartDate),
    closingDate: normalizeWhitespace(record.PostingEndDate || record.ExternalPostedEndDate),
    sourceClosingDateIsExact: closingIsExact(record.PostingEndDate || record.ExternalPostedEndDate),
    jobDescription: joinDescriptionParts(
      record.ShortDescriptionStr,
      record.ExternalResponsibilitiesStr,
    ),
    siteNumber,
    sourceDetailComplete: false,
    sourceNativeLocations: nativeLocations(record),
    sourceNativeListingRecord: record,
  }
}

export const extractSearchResults = (payload, { siteNumber } = {}) => getRequisitionList(payload)
  .filter((record) => isIndiaJob(record))
  .map((record) => toListing(record, siteNumber))
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractPaginationSummary = (payload, { page = 0 } = {}) => {
  const listingSummary = getSearchSummary(payload)
  const pageSize = Number(listingSummary.Limit) || DEFAULT_LIMIT
  const totalCount = Number(listingSummary.TotalJobsCount) || 0
  const nextOffset = (Math.max(0, Number(page) || 0) + 1) * pageSize

  return {
    hasNext: nextOffset < totalCount,
    pageSize,
    nextOffset,
    totalCount,
  }
}

export const extractJobDetail = (payload, listing = {}, { now = () => new Date().toISOString() } = {}) => {
  const detail = getRequisitionDetail(payload)
  const siteNumber = listing.siteNumber || detail.SiteNumber || GLOBAL_SITE_NUMBER
  const jobId = normalizeWhitespace(detail.Id), title = normalizeWhitespace(detail.Title)
  if (!/^\d{1,32}$/.test(jobId || '') || !title || !SITE_NUMBERS.includes(siteNumber)
    || listing.jobId != null && String(listing.jobId) !== jobId
    || listing.title != null && listing.title !== title
    || detail.SiteNumber != null && detail.SiteNumber !== siteNumber) throw contract('listing/detail role identity or site does not match')
  const locations = nativeLocations(detail), location = getEffectiveLocation(detail)
  if (listing.sourceNativeLocations && JSON.stringify(locations) !== JSON.stringify(listing.sourceNativeLocations)) {
    throw contract('listing/detail native worksite relations do not match')
  }
  for (const key of ['GeographyId', 'OrganizationId', 'LegalEmployerId']) {
    const expected = listing.sourceNativeListingRecord?.[key]
    if (expected != null && detail[key] != null && String(expected) !== String(detail[key])) throw contract(`listing/detail ${key} binding does not match`)
  }
  const sourceExternalSections = Object.fromEntries(sections.map(key => [key, detail[key] ?? null]))
  const sourceAuthoredSectionsComplete = sections.every(key => Object.hasOwn(detail, key)
    && (detail[key] === null || typeof detail[key] === 'string'))
  const description = sections.map(key => extractActiveDescription(detail[key])).filter(Boolean).join(' ') || null
  const hasRoleContent = roleSections.some(key => Boolean(extractActiveDescription(detail[key])))
  const endDate = detail.ExternalPostedEndDate
  const endMs = endDate == null ? null : Date.parse(endDate)
  const closed = Number.isFinite(endMs) && (closingIsExact(endDate)
    ? endMs <= Date.parse(now()) : normalizeDate(endDate) < normalizeDate(now()))
  const publicStateComplete = detail.ApplyWhenNotPostedFlag === false && Object.hasOwn(detail, 'ExternalPostedEndDate')
    && (endDate === null || typeof endDate === 'string' && Number.isFinite(endMs))
  const detailComplete = Boolean(hasRoleContent && sourceAuthoredSectionsComplete && publicStateComplete && !closed
    && location && locations.every(value => value.country))
  const sourceUrl = buildJobDetailUrl(siteNumber, jobId)

  return {
    title,
    company: COMPANY_NAME,
    country: location ? 'India' : null,
    department: normalizeWhitespace(
      detail.Department || detail.JobFunction || detail.JobFamily || detail.Category,
    ) || listing.department || null,
    location,
    city: extractCity(location) || listing.city || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: getEmploymentType(detail) || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: normalizeWhitespace(detail.StudyLevel || detail.ExternalQualificationsStr),
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : [],
    postingDate: normalizeDate(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    closingDate: normalizeWhitespace(detail.ExternalPostedEndDate || detail.PostingEndDate) || listing.closingDate || null,
    sourceClosingDateIsExact: closingIsExact(detail.ExternalPostedEndDate || detail.PostingEndDate || listing.closingDate),
    jobDescription: description,
    sourceDescription: description,
    sourceExternalSections,
    sourceAuthoredSectionsComplete,
    sourceNativeLocations: locations,
    sourceNativeListingRecord: listing.sourceNativeListingRecord || null,
    nativeRequisitionId: detail.RequisitionId ?? null,
    sourceNativePublicState: { listedOnConfiguredBoard: true, siteNumber,
      applyWhenNotPostedFlag: detail.ApplyWhenNotPostedFlag ?? null, externalPostedEndDate: endDate ?? null,
      state: closed ? 'closed' : publicStateComplete ? 'public-listed' : 'unresolved' },
    sourceDetailComplete: detailComplete,
    ...(!detailComplete ? { sourceDetailFailureKind: !sourceAuthoredSectionsComplete ? 'missing-authored-sections'
      : !hasRoleContent ? 'missing-content' : closed ? 'closed-native-posting'
        : !publicStateComplete ? 'public-state-unresolved' : 'native-location-scope-unresolved' } : {}),
    applicationVisited: false,
    siteNumber,
  }
}

const candidateSignal = (html, siteNumber) => {
  const doc = readNativeDocument(html), bases = doc.nodes(node => node.tag === 'base')
  const titles = doc.nodes(node => node.tag === 'title').map(node => normalizeWhitespace(node.raw))
  let base, api
  try {
    base = new URL(bases[0]?.attrs.href, ORACLE_HOST).href
    api = new URL(bases[0]?.attrs['data-apibaseurl']).origin
  } catch { return { verified: false, titles, reason: 'candidate-native-identity-missing' } }
  return { verified: bases.length === 1 && base === `${ORACLE_HOST}/hcmUI/CandidateExperience/en/sites/${siteNumber}`
    && bases[0].attrs['data-sitenumber'] === siteNumber && api === ORACLE_HOST
    && titles.some(title => /\bOmega\b.*\bCareer\s+site\b/i.test(title || ''))
    && !titles.some(title => /not (?:available|found)|unavailable|retired/i.test(title || '')), titles, base, api }
}

// The historical CX_1001/CX_2001 configuration is not an employer-wide or India
// binding. Their current public shells identify US and PH surfaces. Read them as
// observations while retaining any corporate denial and unknown hiring surface.
export const createOmegaHealthcareManagementServicesScraper = (options = {}) => ({
  async run() {
    const { fetchImpl = globalThis.fetch, fetchText, fetchJson, signal, detailConcurrency = 1,
      requestTimeoutMs = 12000, collectionBudgetMs = 240000, maxResponseBytes = 4 * 1024 * 1024,
      maxTotalBytes = 32 * 1024 * 1024, maxRequests = 2000, now = () => new Date().toISOString() } = options
    const limits = nativePaginationLimits(options, { maxPages: 250, maxJobs: 2000, ...loadNativePaginationDefaults(currentDir) })
    for (const [key, value] of Object.entries(limits)) {
      if (!Number.isSafeInteger(value) || value <= 0 || value > (key === 'maxPages' ? 1000 : 10000)) throw new RangeError(`${key} must be a bounded positive safe integer`)
    }
    if (!Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 10) throw new RangeError('detailConcurrency must be an integer from 1 to 10')
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0 || requestTimeoutMs > 120000) throw new RangeError('requestTimeoutMs must be positive and bounded')
    if (!Number.isFinite(collectionBudgetMs) || collectionBudgetMs < 0 || collectionBudgetMs > 600000) throw new RangeError('collectionBudgetMs must be nonnegative and bounded')
    for (const [key, value] of Object.entries({ maxResponseBytes, maxTotalBytes, maxRequests })) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${key} must be a positive safe integer`)
    }
    signal?.throwIfAborted()
    const budget = new AbortController(), byteStop = new AbortController()
    const collectionSignal = AbortSignal.any([budget.signal, byteStop.signal, ...(signal ? [signal] : [])])
    const gap = message => Object.assign(new Error(`[${SOURCE}] ${message}`), {
      softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', abortRetries: true, lifecycleCleanupAllowed: false,
    })
    const budgetReason = gap('Native collection budget exhausted')
    const collectionDeadline = performance.now() + collectionBudgetMs
    const checkCollection = () => {
      // Timers cannot run while a reader/parser owns the event loop. Elapsed
      // monotonic time still owns admission, with the caller's exact reason first.
      signal?.throwIfAborted()
      collectionSignal.throwIfAborted()
      if (performance.now() >= collectionDeadline) budget.abort(budgetReason)
      collectionSignal.throwIfAborted()
    }
    const timer = setTimeout(() => budget.abort(budgetReason), collectionBudgetMs)
    if (collectionBudgetMs === 0) budget.abort(budgetReason)
    const receipts = [], boards = {}, corporate = [], jobs = []
    let indiaCareerHTML = null
    let nativeHttpFailure = () => false
    let totalResponseBytes = 0, jobLimitReached = false
    const consume = (bytes, responseBytes) => {
      checkCollection()
      if (responseBytes + bytes > maxResponseBytes || totalResponseBytes + bytes > maxTotalBytes) {
        const error = gap('Native response byte budget exceeded')
        byteStop.abort(error); throw error
      }
      totalResponseBytes += bytes
    }
    const bodyBytes = async (response, readingSignal, checkRequest) => {
      if (!response.body?.getReader) {
        // text()/arrayBuffer() materialize the entire entity before a byte cap
        // can inspect it. Unsupported readers cannot enter this bounded source.
        const error = gap('Native byte budget requires a streaming response body')
        byteStop.abort(error); throw error
      }
      const reader = response.body.getReader(), chunks = []
      let size = 0, cancelled = false
      const cancel = () => {
        if (cancelled) return
        cancelled = true
        try { Promise.resolve(reader.cancel(readingSignal.reason)).catch(() => {}) } catch {}
      }
      readingSignal.addEventListener('abort', cancel, { once: true })
      try {
        checkRequest()
        while (true) {
          checkRequest()
          const chunk = await reader.read()
          checkRequest()
          if (chunk.done) break
          if (!(chunk.value instanceof Uint8Array)) throw contract('native body stream did not yield bytes')
          consume(chunk.value.byteLength, size); size += chunk.value.byteLength
          chunks.push(Buffer.from(chunk.value))
          checkRequest()
        }
        const body = Buffer.concat(chunks)
        checkRequest(); return body
      } catch (error) { cancel(); throw error }
      finally {
        readingSignal.removeEventListener('abort', cancel)
        try { reader.releaseLock() } catch {}
      }
    }
    const read = async (url, kind, requestSignal = collectionSignal) => {
      checkCollection(); requestSignal.throwIfAborted()
      if (receipts.length >= maxRequests) { const error = gap('Native request count budget exceeded'); byteStop.abort(error); throw error }
      const deadline = new AbortController()
      const readingSignal = AbortSignal.any([collectionSignal, requestSignal, deadline.signal])
      const timeoutReason = Object.assign(new Error(`[${SOURCE}] Native request timed out`), {
        softFailure: true, upstreamOutage: true, failureKind: 'upstream_timeout', abortRetries: true,
      })
      const requestDeadline = performance.now() + requestTimeoutMs
      const expireRequest = () => {
        if (!deadline.signal.aborted && performance.now() >= requestDeadline) deadline.abort(timeoutReason)
      }
      const checkRequest = () => {
        checkCollection(); requestSignal.throwIfAborted(); expireRequest(); readingSignal.throwIfAborted()
      }
      const requestTimer = setTimeout(() => deadline.abort(timeoutReason), requestTimeoutMs)
      const receipt = { url, kind, method: 'GET', requestedAt: now() }
      receipts.push(receipt)
      try {
        const result = await readNativeWithSignal(async () => {
          checkRequest()
          const decodedReader = kind === 'json' ? fetchJson : fetchText
          if (decodedReader) {
            receipt.transport = 'injected-decoded-reader'
            const value = await decodedReader(url, { signal: readingSignal })
            checkRequest()
            if (kind === 'text' && typeof value !== 'string') throw contract('text reader returned a non-string')
            const serialized = kind === 'json' ? JSON.stringify(value) : value
            checkRequest()
            const checkedBytes = Buffer.byteLength(serialized, 'utf8')
            checkRequest(); consume(checkedBytes, 0)
            Object.assign(receipt, { checkedBytes, completedAt: now() })
            checkRequest()
            return value
          }
          receipt.transport = 'fetch-response-bytes'
          const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: readingSignal, headers: {
            Accept: kind === 'json' ? 'application/json' : 'text/html,application/xhtml+xml',
          } })
          checkRequest()
          const bytes = await bodyBytes(response, readingSignal, checkRequest)
          checkRequest()
          const mime = response.headers?.get?.('content-type') || ''
          Object.assign(receipt, { status: response.status, finalUrl: response.url || url, mime, bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'), completedAt: now() })
          checkRequest()
          if (response.url && new URL(response.url).href !== new URL(url).href) throw contract('unexpected response redirect')
          if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), { status: response.status, abortRetries: true })
          if (kind === 'json' && !/^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(mime)) throw contract('unexpected native JSON response MIME')
          if (kind === 'text' && !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(mime)) throw contract('unexpected native document MIME')
          const text = bytes.toString('utf8')
          checkRequest()
          const value = kind === 'json' ? JSON.parse(text) : text
          checkRequest(); return value
        }, readingSignal)
        checkRequest(); return result
      } catch (error) {
        checkCollection(); requestSignal.throwIfAborted(); expireRequest()
        const failure = deadline.signal.aborted ? deadline.signal.reason : error
        receipt.error = { name: failure?.name || typeof failure, message: failure?.message || null, status: failure?.status ?? null }
        receipt.completedAt = now(); checkCollection(); throw failure
      } finally { clearTimeout(requestTimer) }
    }
    const observe = (payload, url, siteNumber) => {
      checkCollection()
      if (!url.startsWith(LISTING_API_BASE_URL)) return
      const summary = payload?.items?.[0], offset = Number(/,offset=(\d+)/.exec(url)?.[1])
      if (!Array.isArray(summary?.requisitionList) || summary.SiteNumber !== siteNumber || summary.Offset !== offset
        || !queryFields.every(key => Object.hasOwn(summary, key) && summary[key] === null)
        || summary.Radius !== 0 || summary.UseExactKeywordFlag !== false) throw contract('native query context, site or offset is missing or constrained')
      const board = boards[siteNumber]
      if (offset === 0) board.passes.push([])
      const records = structuredClone(summary.requisitionList)
      board.passes.at(-1).push({ offset, reportedTotal: summary.TotalJobsCount, rawCount: records.length, records })
      checkCollection()
    }
    const summarize = pages => {
      checkCollection()
      if (!pages) return null
      const records = pages.flatMap(page => page.records)
      const summary = { pages: pages.map(({ records: rows, ...page }) => ({ ...page, ids: rows.map(row => String(row.Id)) })),
        rawCount: records.length, ids: records.map(record => String(record.Id)), records,
        nativeLocations: records.map(record => ({ id: String(record.Id), locations: nativeLocations(record) })),
        unknownCountryIds: records.filter(record => nativeLocations(record).some(value => !value.country)).map(record => String(record.Id)) }
      checkCollection(); return summary
    }
    try {
      for (const url of [GLOBAL_CAREERS_URL, INDIA_CAREERS_URL]) {
        try {
          const corporateHTML = await read(url, 'text')
          if (url === INDIA_CAREERS_URL) indiaCareerHTML = corporateHTML
          const handoff = corporateHandoff(corporateHTML, url)
          checkCollection(); corporate.push(handoff)
        }
        catch (error) {
          checkCollection()
          corporate.push({ url, verified: false, sites: [], error: { message: error?.message || null, status: error?.status ?? null } })
        }
      }
      if (indiaCareerHTML !== null) {
        const native = await import('./nativePeopleStrong.js')
        nativeHttpFailure = native.isPeopleStrongHttpFailure
        checkCollection()
        const channel = native.discoverPeopleStrongIndiaChannel(indiaCareerHTML)
        checkCollection()
        if (channel) return await native.runPeopleStrongIndia({ channel, corporate, fetchImpl, now,
          signal: collectionSignal, callerSignal: signal, check: checkCollection, consume, receipts,
          requestTimeoutMs, maxResponseBytes, maxRequests, limits, detailConcurrency,
          readCorporate: () => read(INDIA_CAREERS_URL, 'text') })
      }
      for (const siteNumber of SITE_NUMBERS) {
        const board = boards[siteNumber] = { candidateUrl: `${ORACLE_HOST}/hcmUI/CandidateExperience/en/sites/${siteNumber}`, passes: [] }
        try {
          const candidate = candidateSignal(await read(board.candidateUrl, 'text'), siteNumber)
          checkCollection(); board.candidate = candidate
        }
        catch (error) {
          checkCollection()
          board.candidate = { verified: false, error: { message: error?.message || null, status: error?.status ?? null } }
        }
        const detailFailures = new Map()
        const selected = await collectOracleRequisitionJobs({ source: SOURCE, siteNumber,
          buildSearchUrl: ({ page = 0 } = {}) => buildSearchUrl({ siteNumber, page }),
          buildJobDetailApiUrl: id => buildJobDetailApiUrl(siteNumber, id),
          extractSearchResults: payload => {
            checkCollection()
            const matches = extractSearchResults(payload, { siteNumber })
            const remaining = Math.max(0, limits.maxJobs - jobs.length)
            if (matches.length > remaining) jobLimitReached = true
            const selected = matches.slice(0, remaining)
            checkCollection(); return selected
          },
          extractJobDetail: (payload, listing) => {
            checkCollection()
            const job = extractJobDetail(payload, listing, { now })
            if (!job.sourceDetailComplete) detailFailures.set(job.jobId, job.sourceDetailFailureKind)
            checkCollection(); return job
          },
          fetchJson: async (url, init) => { const payload = await read(url, 'json', init?.signal); observe(payload, url, siteNumber); return payload },
          maxPages: limits.maxPages, signal: collectionSignal, detailConcurrency,
        })
        checkCollection()
        for (const job of selected) if (detailFailures.has(job.jobId)) {
          job.sourceDetailComplete = false; job.sourceDetailFailureKind = detailFailures.get(job.jobId)
        }
        board.opening = summarize(board.passes[0]); board.closing = summarize(board.passes[1]); delete board.passes
        board.configuredInventoryReconciled = Boolean(board.opening && board.closing
          && board.opening.rawCount === board.opening.pages[0]?.reportedTotal
          && JSON.stringify(board.opening.records) === JSON.stringify(board.closing.records))
        jobs.push(...selected)
      }
      const bindingVerified = corporate.every(value => value.verified)
        && SITE_NUMBERS.every(site => corporate.some(value => value.sites.includes(site)))
      const candidateVerified = SITE_NUMBERS.every(site => boards[site].candidate.verified)
      const observationCount = SITE_NUMBERS.reduce((total, site) => total + (boards[site].opening?.rawCount || 0), 0)
      const evidence = { source: SOURCE, recordKind: 'vacancy-rows', sourceScopeComplete: false,
        companyGlobalTotal: null, companyIndiaTotal: null, configuredBoardObservationCount: observationCount,
        corporate, currentCorporateBindingVerified: bindingVerified, boards, selectedTypedIndiaCount: jobs.length,
        limits, jobLimitReached, detailConcurrency, requestTimeoutMs, collectionBudgetMs, maxRequests,
        byteBounds: { maxResponseBytes, maxTotalBytes, totalResponseBytes }, receipts, verifiedAt: now(),
        scope: 'configured-public-board-observations;current-company-India-hiring-surface-unproven' }
      for (const [index, job] of jobs.entries()) Object.assign(job, { source: SOURCE,
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
        link: job.applyUrl || job.sourceUrl, scrapedAt: now(),
        nativeCollectionEvidence: index === 0 ? evidence : { source: SOURCE, sourceScopeComplete: false,
          companyGlobalTotal: null, companyIndiaTotal: null, configuredBoardObservationCount: observationCount,
          fullEvidenceOnFirstRole: jobs[0]?.jobId || null } })
      Object.defineProperty(jobs, OMEGA_INVENTORY_EVIDENCE, { value: evidence })
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
        observedRecordCount: observationCount, observedVacancyCount: observationCount, sourceScopeComplete: false,
        companyGlobalTotal: null, companyIndiaTotal: null })
      const result = attachInventoryEvidence(jobs, { status: 'discovery-only', surface: INDIA_CAREERS_URL, firstParty: true,
        listingComplete: false, reportedTotal: null, indiaFacetCount: null,
        pagesFetched: SITE_NUMBERS.reduce((sum, site) => sum + (boards[site].opening?.pages.length || 0) + (boards[site].closing?.pages.length || 0), 0),
        verifiedAt: now(), reason: [!bindingVerified && 'corporate-handoff-unverified', !candidateVerified && 'candidate-site-unverified',
          jobLimitReached && 'native-job-limit-reached', SITE_NUMBERS.some(site => !boards[site].configuredInventoryReconciled) && 'configured-inventory-unclosed-or-unreconciled',
          SITE_NUMBERS.some(site => boards[site].opening?.unknownCountryIds.length) && 'native-typed-country-scope-unresolved',
          !jobs.length && 'no-typed-India-roles-on-configured-boards', 'company-India-hiring-scope-unverified'].filter(Boolean).join(';') })
      checkCollection(); return result
    } catch (error) {
      signal?.throwIfAborted()
      if (nativeHttpFailure(error)) throw error
      checkCollection(); throw error
    }
    finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createOmegaHealthcareManagementServicesScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Omega Healthcare Management Services scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
