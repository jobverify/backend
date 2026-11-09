import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { collectOracleRequisitionJobs } from '../../scraper-support/utils/oracleRequisitionInventory.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadNativePaginationDefaults, nativePaginationLimits, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'onsemiindia'
export const COMPANY_NAME = 'onsemi India'
export const CORPORATE_CAREERS_URL = 'https://www.onsemi.com/careers'
export const CANDIDATE_EXPERIENCE_URL =
  'https://hctz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs'
export const LISTING_API_BASE_URL =
  'https://hctz.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL =
  'https://hctz.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
export const PUBLIC_JOBS_BASE_URL =
  'https://hctz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/'
export const SITE_NUMBER = 'CX_1001'
export const DEFAULT_LIMIT = 24
export const ONSEMI_INVENTORY_EVIDENCE = Symbol.for('jobverify.onsemi-inventory')

const CANDIDATE_SITE_URL = CANDIDATE_EXPERIENCE_URL.replace(/\/jobs$/, '')
const EXTERNAL_SECTIONS = ['ExternalDescriptionStr', 'ExternalResponsibilitiesStr', 'ExternalQualificationsStr']
const GLOBAL_QUERY_FIELDS = ['Keyword', 'CorrectedKeyword', 'SuggestedKeyword', 'Location', 'LocationId', 'Latitude', 'Longitude',
  'SelectedTitlesFacet', 'SelectedCategoriesFacet', 'SelectedPostingDatesFacet', 'SelectedLocationsFacet', 'LastSelectedFacet',
  'JobFamilyId', 'PostingStartDate', 'PostingEndDate', 'SelectedWorkLocationsFacet', 'RequisitionId', 'CandidateNumber',
  'WorkLocationZipCode', 'WorkLocationCountryCode', 'SelectedFlexFieldsFacets', 'OrganizationId', 'SelectedOrganizationsFacet',
  'UserTargetFacetName', 'UserTargetFacetInputTerm', 'HotJobFlag', 'WorkplaceType', 'SelectedWorkplaceTypesFacet', 'BotQRShortCode']
const contract = message => Object.assign(new Error(`[${SOURCE}] Oracle native contract changed: ${message}`), {
  softFailure: true, upstreamOutage: false, failureKind: 'upstream_contract_changed',
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+:/g, ':'),
)

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' '),
)

const extractLines = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|hr)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const isDecorativeQualificationLine = (value) => /^(?:qualifications?|what you['’]ll need|requirements?)$/i.test(String(value || ''))

const extractMinimumQualification = (record = {}) =>
  extractLines(record.ExternalQualificationsStr).find((line) => (
    !isDecorativeQualificationLine(line)
    && !/\b(?:years?|months?|yrs?)\b/i.test(line)
  ))
  || normalizeWhitespace(record.StudyLevel)
  || null

const extractExperienceRequired = (record = {}) =>
  extractLines(record.ExternalQualificationsStr).find((line) => (
    !isDecorativeQualificationLine(line)
    && /\b(?:years?|months?|yrs?)\b/i.test(line)
  ))
  || null

const getRequisitionList = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items.flatMap((item) => (
      Array.isArray(item?.requisitionList) ? item.requisitionList : []
    ))
  }
  return Array.isArray(payload?.requisitionList) ? payload.requisitionList : []
}

const getRequisitionDetail = (payload) => {
  if (Array.isArray(payload?.items) && payload.items[0]) {
    return payload.items[0]
  }
  return payload || {}
}

const nativeLocations = (record = {}) => {
  const relations = [{ kind: 'primary', code: record.PrimaryLocationCountry, name: record.PrimaryLocation }]
  if (Array.isArray(record.secondaryLocations)) relations.push(...record.secondaryLocations.map(location => ({
    kind: 'secondary', code: location?.CountryCode, name: location?.Name || location?.LocationName,
  })))
  else relations.push({ kind: 'secondary-unresolved', code: null, name: null })
  return relations.map(location => {
    const country = nativeCountryName(location.code), labelCountry = nativeLocationCountryName(location.name)
    if (country && labelCountry && country !== labelCountry) throw contract('conflicting native location countries')
    return { kind: location.kind, countryCode: normalizeWhitespace(location.code)?.toUpperCase() || null,
      name: normalizeWhitespace(location.name), country }
  })
}
const getLocation = (record = {}) => {
  const india = nativeLocations(record).find(location => location.country === 'India')
  return india ? india.name || 'India' : null
}

export const buildSearchUrl = ({ page = 0, limit = DEFAULT_LIMIT, location = 'India' } = {}) => {
  const normalizedLimit = Number(limit) || DEFAULT_LIMIT
  const offset = Math.max(0, Number(page) || 0) * normalizedLimit
  return `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${normalizedLimit},offset=${offset}${location ? `,location=${encodeURIComponent(location)}` : ''}`
}

export const buildJobDetailUrl = (jobId) => `${PUBLIC_JOBS_BASE_URL}${jobId}`
export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${normalizeWhitespace(jobId) || ''}%22,siteNumber=${SITE_NUMBER}`

export const extractSearchResults = (payload) => getRequisitionList(payload)
  .filter((record) => {
    return Boolean(getLocation(record))
  })
  .map((record) => {
    const jobId = normalizeWhitespace(record.Id)
    const location = normalizeWhitespace(getLocation(record))
    const detailUrl = jobId ? buildJobDetailUrl(jobId) : null
    return {
      title: normalizeWhitespace(record.Title),
      company: COMPANY_NAME,
      location,
      city: location?.split(',')[0]?.trim() || null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      department: normalizeWhitespace(record.Organization || record.Department || record.JobFunction),
      employmentType: normalizeWhitespace(record.JobSchedule || record.JobType || record.WorkerType),
      postingDate: normalizeWhitespace(record.ExternalPostedStartDate || record.PostedDate),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      jobDescription: joinDescriptionParts(record.ShortDescriptionStr),
      sourceDetailComplete: false,
      sourceNativeLocations: nativeLocations(record),
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

export const extractJobDetail = (payload, listing = {}) => {
  const detail = getRequisitionDetail(payload)
  const jobId = normalizeWhitespace(detail.Id), title = normalizeWhitespace(detail.Title)
  if (!/^\d{1,32}$/.test(jobId || '') || !title
    || listing.jobId != null && String(listing.jobId) !== jobId
    || listing.title != null && listing.title !== title) throw contract('listing/detail role identity does not match')
  const locations = nativeLocations(detail), location = getLocation(detail)
  if (listing.sourceNativeLocations && JSON.stringify(listing.sourceNativeLocations) !== JSON.stringify(locations)) {
    throw contract('listing/detail native worksite relations do not match')
  }
  const sourceUrl = buildJobDetailUrl(jobId)
  const sourceExternalSections = Object.fromEntries(EXTERNAL_SECTIONS.map(key => [key, detail[key] ?? null]))
  const description = EXTERNAL_SECTIONS.map(key => extractActiveDescription(detail[key])).filter(Boolean).join(' ') || null
  const sectionsPresent = EXTERNAL_SECTIONS.every(key => Object.hasOwn(detail, key)
    && (detail[key] === null || typeof detail[key] === 'string'))

  return {
    title,
    company: COMPANY_NAME,
    location,
    city: location?.split(',')[0]?.trim() || null,
    country: location ? 'India' : null,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    department: normalizeWhitespace(
      detail.Organization || detail.Department || detail.JobFunction,
    ) || listing.department || null,
    employmentType: normalizeWhitespace(
      detail.JobSchedule || detail.JobType || detail.WorkerType,
    ) || listing.employmentType || null,
    postingDate: normalizeWhitespace(detail.ExternalPostedStartDate || detail.PostedDate) || listing.postingDate || null,
    experienceRequired: extractExperienceRequired(detail) || listing.experienceRequired || null,
    minimumQualification: extractMinimumQualification(detail) || listing.minimumQualification || null,
    preferredQualification: listing.preferredQualification || null,
    requiredSkills: Array.isArray(detail.skills)
      ? detail.skills
        .map((skill) => normalizeWhitespace(skill?.Skill))
        .filter(Boolean)
      : listing.requiredSkills || [],
    jobDescription: description,
    sourceDescription: description,
    sourceExternalSections,
    sourceAuthoredSectionsComplete: sectionsPresent,
    sourceNativeLocations: locations,
    sourceDetailComplete: Boolean(description && sectionsPresent && location && locations.every(item => item.country)),
  }
}

const verifyCorporateHandoff = html => {
  const doc = readNativeDocument(html)
  const sites = new Set()
  for (const anchor of doc.nodes(node => node.tag === 'a' && node.attrs.href)) {
    let url
    try { url = new URL(anchor.attrs.href, CORPORATE_CAREERS_URL) } catch { continue }
    const match = /^\/hcmUI\/CandidateExperience\/[^/]+\/sites\/([^/]+)/.exec(url.pathname)
    if (match) sites.add(`${url.origin}/hcmUI/CandidateExperience/en/sites/${match[1]}`)
  }
  if (sites.size !== 1 || !sites.has(CANDIDATE_SITE_URL)) throw contract('current corporate Oracle hiring handoff is missing or changed')
  return [...sites]
}
const verifyCandidateSite = html => {
  const doc = readNativeDocument(html)
  const bases = doc.nodes(node => node.tag === 'base')
  const titles = doc.nodes(node => node.tag === 'title')
  let base, api
  try {
    base = new URL(bases[0]?.attrs.href, CANDIDATE_SITE_URL).href
    api = new URL(bases[0]?.attrs['data-apibaseurl']).origin
  } catch { throw contract('current candidate site identity is missing') }
  if (bases.length !== 1 || base !== CANDIDATE_SITE_URL || bases[0].attrs['data-sitenumber'] !== SITE_NUMBER
    || api !== new URL(CANDIDATE_SITE_URL).origin || !titles.some(title => /\bonsemi\b/i.test(title.raw || ''))) {
    throw contract('current candidate site identity does not match the corporate handoff')
  }
}

export const createOnsemiIndiaScraper = (options = {}) => ({
  async run() {
    const { fetchImpl = globalThis.fetch, fetchJson, fetchText, signal, detailConcurrency = 1,
      requestTimeoutMs = 20000, collectionBudgetMs = 360000,
      maxResponseBytes = 4 * 1024 * 1024, maxTotalBytes = 16 * 1024 * 1024 } = options
    const limits = nativePaginationLimits(options, loadNativePaginationDefaults(currentDir))
    for (const [name, value] of Object.entries(limits)) {
      if (value !== Infinity && !Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer or unlimited`)
    }
    if (!Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 10) throw new RangeError('detailConcurrency must be an integer from 1 to 10')
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) throw new RangeError('requestTimeoutMs must be positive')
    if (!Number.isFinite(collectionBudgetMs) || collectionBudgetMs < 0) throw new RangeError('collectionBudgetMs must be nonnegative')
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0
      || !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes <= 0) throw new RangeError('native byte budgets must be positive safe integers')
    signal?.throwIfAborted()
    const budget = new AbortController()
    const byteStop = new AbortController()
    const collectionSignal = AbortSignal.any([budget.signal, byteStop.signal, ...(signal ? [signal] : [])])
    const budgetReason = Object.assign(new Error(`[${SOURCE}] Native collection budget exhausted`), {
      softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false,
    })
    const timer = setTimeout(() => budget.abort(budgetReason), collectionBudgetMs)
    if (collectionBudgetMs === 0) budget.abort(budgetReason)
    const receipts = [], passes = []
    let totalResponseBytes = 0
    const consumeBytes = (chunkBytes, responseBytes) => {
      if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 0) throw contract('native response stream did not yield a bounded byte chunk')
      if (chunkBytes > maxResponseBytes - responseBytes || chunkBytes > maxTotalBytes - totalResponseBytes) {
        const error = Object.assign(new Error(`[${SOURCE}] Native ${chunkBytes > maxResponseBytes - responseBytes ? 'response' : 'aggregate'} byte budget exhausted`), {
          code: 'ONSEMI_BODY_BYTE_LIMIT', failureKind: 'coverage_gap', softFailure: true, upstreamOutage: false,
          abortRetries: true, lifecycleCleanupAllowed: false,
        })
        byteStop.abort(error)
        throw error
      }
      totalResponseBytes += chunkBytes
    }
    const readBody = async (response, readingSignal) => {
      if (!response.body?.getReader) {
        const body = await response.text()
        readingSignal.throwIfAborted()
        consumeBytes(Buffer.byteLength(body), 0)
        return body
      }
      const reader = response.body.getReader(), chunks = []
      let responseBytes = 0, readerCancelled = false
      const cancelReader = () => {
        if (readerCancelled) return
        readerCancelled = true
        try { Promise.resolve(reader.cancel(readingSignal.reason)).catch(() => {}) } catch {}
      }
      readingSignal.addEventListener('abort', cancelReader, { once: true })
      try {
        readingSignal.throwIfAborted()
        while (true) {
          const item = await reader.read()
          readingSignal.throwIfAborted()
          if (item.done) break
          if (!(item.value instanceof Uint8Array)) throw contract('native response stream did not yield a byte view')
          // Check the native byte length before copying an incoming chunk.
          consumeBytes(item.value.byteLength, responseBytes)
          responseBytes += item.value.byteLength
          chunks.push(Buffer.from(item.value))
        }
        return Buffer.concat(chunks).toString('utf8')
      } catch (error) { cancelReader(); throw error }
      finally {
        readingSignal.removeEventListener('abort', cancelReader)
        try { reader.releaseLock() } catch {}
      }
    }
    const read = async (url, kind, requestSignal = collectionSignal) => {
      const deadline = new AbortController()
      const readingSignal = AbortSignal.any([collectionSignal, requestSignal, deadline.signal])
      const requestTimer = setTimeout(() => deadline.abort(Object.assign(new Error(`[${SOURCE}] Native request timed out`), {
        failureKind: 'upstream_timeout', softFailure: true, upstreamOutage: true,
      })), requestTimeoutMs)
      const receipt = { url, kind, method: 'GET', requestedAt: new Date().toISOString() }
      receipts.push(receipt)
      try {
        return await readNativeWithSignal(async () => {
          if (kind === 'json' && fetchJson || kind === 'text' && fetchText) {
            receipt.transport = 'injected-decoded-reader'
            const value = await (kind === 'json' ? fetchJson : fetchText)(url, { signal: readingSignal })
            readingSignal.throwIfAborted()
            const checkedBytes = Buffer.byteLength(kind === 'json' ? JSON.stringify(value) : value)
            consumeBytes(checkedBytes, 0)
            receipt.checkedBytes = checkedBytes
            receipt.completedAt = new Date().toISOString()
            return value
          }
          const response = await fetchImpl(url, { method: 'GET', signal: readingSignal, headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
            Accept: kind === 'json' ? 'application/json,text/plain,*/*' : 'text/html,*/*',
          } })
          readingSignal.throwIfAborted()
          if (response.url && new URL(response.url).href !== new URL(url).href) throw contract('unexpected native response redirect')
          if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), { status: response.status })
          const body = await readBody(response, readingSignal)
          readingSignal.throwIfAborted()
          Object.assign(receipt, { finalUrl: response.url || null, status: response.status, bytes: Buffer.byteLength(body),
            sha256: createHash('sha256').update(body).digest('hex'), completedAt: new Date().toISOString() })
          return kind === 'json' ? JSON.parse(body) : body
        }, readingSignal)
      } catch (error) {
        signal?.throwIfAborted()
        collectionSignal.throwIfAborted()
        requestSignal.throwIfAborted()
        throw error
      } finally { clearTimeout(requestTimer) }
    }
    const observe = (payload, url) => {
      if (!url.startsWith(LISTING_API_BASE_URL)) return
      const summary = payload?.items?.[0]
      if (!Array.isArray(summary?.requisitionList)) return
      const offset = Number(/,offset=(\d+)/.exec(url)?.[1])
      if (summary.SiteNumber !== SITE_NUMBER || summary.Offset !== offset
        || !GLOBAL_QUERY_FIELDS.every(key => Object.hasOwn(summary, key) && summary[key] === null)
        || summary.Radius !== 0 || summary.UseExactKeywordFlag !== false) {
        throw contract('native global query context, site or offset is missing or constrained')
      }
      if (offset === 0 || !passes.length) passes.push([])
      const records = summary.requisitionList.map(record => {
        if (!record || typeof record !== 'object') throw contract('invalid native role identity')
        return { id: String(record.Id), title: normalizeWhitespace(record.Title), locations: nativeLocations(record) }
      })
      passes.at(-1).push({ offset, reportedTotal: summary.TotalJobsCount, rawCount: records.length,
        globalQuery: Object.fromEntries(GLOBAL_QUERY_FIELDS.map(key => [key, summary[key]])), records })
    }
    const summarize = pages => {
      if (!pages) return null
      const records = pages.flatMap(page => page.records)
      return { pages: pages.map(({ records: rows, ...page }) => ({ ...page, ids: rows.map(row => row.id) })),
        rawCount: records.length, ids: records.map(row => row.id), records,
        unknownCountryIds: records.filter(row => row.locations.some(location => !location.country)).map(row => row.id) }
    }
    try {
      const hiringSites = verifyCorporateHandoff(await read(CORPORATE_CAREERS_URL, 'text'))
      verifyCandidateSite(await read(CANDIDATE_SITE_URL, 'text'))
      const jobs = await collectOracleRequisitionJobs({ source: SOURCE, siteNumber: SITE_NUMBER,
        buildSearchUrl: ({ page = 0 } = {}) => buildSearchUrl({ page, location: null }),
        buildJobDetailApiUrl, extractSearchResults, extractJobDetail,
        fetchJson: async (url, init) => { const payload = await read(url, 'json', init?.signal); observe(payload, url); return payload },
        maxPages: limits.maxPages, maxJobs: limits.maxJobs === Infinity ? null : limits.maxJobs,
        signal: collectionSignal, detailConcurrency,
      })
      const opening = summarize(passes[0]), closing = summarize(passes[1]), nativeEvidence = readInventoryEvidence(jobs)
      const countryScopeComplete = Boolean(opening && closing && !opening.unknownCountryIds.length && !closing.unknownCountryIds.length)
      const complete = Boolean(nativeEvidence?.listingComplete && countryScopeComplete)
      for (const job of jobs) {
        if (job.sourceDescription && job.sourceAuthoredSectionsComplete
          && job.sourceNativeLocations.some(location => !location.country)) {
          job.sourceDetailComplete = false
          job.sourceDetailFailureKind = 'native-location-scope-unresolved'
        }
      }
      const detailsComplete = jobs.every(job => job.sourceDetailComplete)
      for (const job of jobs) Object.assign(job, { sourceListingComplete: complete, sourceScopeComplete: complete,
        lifecycleCleanupAllowed: complete && detailsComplete })
      Object.defineProperty(jobs, ONSEMI_INVENTORY_EVIDENCE, { value: {
        queryScope: 'global-site', corporateUrl: CORPORATE_CAREERS_URL, hiringSites, candidateSite: CANDIDATE_SITE_URL,
        opening, closing, countryScopeComplete, selectedIndiaCount: jobs.length, limits, detailConcurrency,
        requestTimeoutMs, collectionBudgetMs, receipts,
        byteBounds: { maxResponseBytes, maxTotalBytes, totalResponseBytes },
      } })
      return attachInventoryEvidence(jobs, { ...nativeEvidence, status: complete ? 'complete-inventory' : 'discovery-only',
        listingComplete: complete, indiaFacetCount: complete ? jobs.length : null,
        reason: complete ? 'current-corporate-global-site-inventory-closed-and-country-reconciled'
          : !countryScopeComplete ? 'native-typed-country-scope-unresolved-or-unclosed' : nativeEvidence.reason })
    } catch (error) {
      signal?.throwIfAborted()
      throw error
    } finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createOnsemiIndiaScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
