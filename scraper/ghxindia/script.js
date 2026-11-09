import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachGreenhouseSourceEvidence } from '../../scraper-support/utils/greenhouseSourceEvidence.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { greenhouseCountryLabels } from '../../scraper-support/utils/greenhouseLocations.js'
import { identifyPublicAtsBoard } from '../../scraper-support/utils/publicAtsIdentity.js'
import { publicAtsInventoryError } from '../../scraper-support/utils/publishingGapAts.js'
import { verifyCurrentUnavailableGhxRole } from './currentUnavailableRole.js'
import { GHX_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = GHX_INDIA_CATALOG.source
export const COMPANY = GHX_INDIA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = GHX_INDIA_CATALOG.officialBrandName
export const CAREERS_URL = GHX_INDIA_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_URL = GHX_INDIA_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = GHX_INDIA_CATALOG.greenhouseJobsApiUrl
export const PROVIDER_METADATA = GHX_INDIA_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/(?:^|,\s*)India(?:$|[\s,)(-])/i.test(normalized)) return true

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value, officeLocations))

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  return officeIndiaLocation || null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [location, ...officeLocations, stripTags(decodedDescription)]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const escapedBoardUrl = GREENHOUSE_BOARD_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boardUrlPattern = new RegExp(`href=["']${escapedBoardUrl}["']`, 'i')

  return (
    /<title>\s*(?:Careers at GHX|GHX Careers\s*\|\s*GHX)\s*<\/title>/i.test(page)
    || normalized.includes('ghx careers')
  )
    && /View all positions/i.test(page)
    && (
      boardUrlPattern.test(page)
      || new RegExp(`${escapedBoardUrl}/jobs/\\d+`, 'i').test(page)
    )
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/globalhealthcareexchangeinc/jobs/${canonicalJobId}`

    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

const normalizeGreenhouseApplyUrl = (value, jobId) => {
  const sourceUrl = normalizeGreenhouseJobUrl(value, jobId)
  return sourceUrl ? `${sourceUrl}#application` : null
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('GHX India Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const applyUrl = normalizeGreenhouseApplyUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('GHX India Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !link || !applyUrl || !title) {
        throw new Error('GHX India Greenhouse payload no longer exposes the verified public Greenhouse job detail URLs')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        link,
        applyUrl,
        sourceUrl: link,
        source: SOURCE,
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        employmentType: extractMetadataValue(job, 'Employment Type'),
        experienceRequired: null,
        jobDescription: decodedDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        remoteStatus,
        scrapedAt,
      }
    })
}

const exactTransport = async (url, options) => {
  const response = await fetch(url, options)
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const expected = new URL(url).hostname === 'boards-api.greenhouse.io'
    ? contentType === 'application/json' : ['text/html', 'application/xhtml+xml'].includes(contentType)
  if (response.ok && (response.url !== url || !expected)) {
    await response.body?.cancel().catch(() => {})
    const error = new Error('GHX response URL or content-type identity changed')
    error.abortRetries = true
    throw error
  }
  return response
}

const exactResponse = (response, url, field) => {
  if (response?.status !== 200 || response.url !== url) throw new Error('GHX response URL identity changed')
  return response[field]
}

const defaultFetchText = async (url, options = {}) => exactResponse(await fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  signal: options.signal,
  label: SOURCE,
  timeoutMs: 15000,
  includeResponseMetadata: true,
  fetchImpl: exactTransport,
}), url, 'html')

const defaultFetchJson = async (url, options = {}) => exactResponse(await fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  signal: options.signal,
  label: SOURCE,
  timeoutMs: 15000,
  includeResponseMetadata: true,
  fetchImpl: exactTransport,
}), url, 'payload')

const requireActiveBoardHandoff = html => {
  let matched = false
  const jobIds = new Set()
  for (const node of readVisibleNativeDocument(html, { strict: true }).nodes(node => node.tag === 'a' && node.attrs.href
    || node.tag === 'button' && node.attrs['data-bs-joburl'])) {
    if (node.tag === 'button') {
      if (node.attrs.type !== 'button' || node.attrs['data-bs-toggle'] !== 'modal'
        || node.attrs['data-bs-target'] !== '#greenModal') continue
      const value = node.attrs['data-bs-joburl']
      const id = value.match(/^https:\/\/job-boards\.greenhouse\.io\/globalhealthcareexchangeinc\/jobs\/([1-9]\d*)$/)?.[1]
      if (!id || !normalizeGreenhouseJobUrl(value, id)) throw new Error('GHX official modal has a foreign native handoff URL')
      jobIds.add(id)
      matched = true
      continue
    }
    let url
    try { url = new URL(node.attrs.href, CAREERS_URL) } catch { continue }
    const board = identifyPublicAtsBoard(url.href)
    if (board?.atsPlatform !== 'greenhouse') continue
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || board.boardToken !== 'globalhealthcareexchangeinc') {
      throw new Error('GHX official careers handoff has foreign board scope')
    }
    if (url.href.replace(/\/$/, '') === GREENHOUSE_BOARD_URL) matched = true
  }
  if (!matched) throw new Error('GHX official careers handoff requires an active exact native board or job link')
  return [...jobIds]
}

const validatedInventoryView = payload => {
  if (publicAtsInventoryError(payload) || payload?.hasMore === true || !Array.isArray(payload?.jobs)
    || !Number.isSafeInteger(payload.meta?.total) || payload.meta.total < 0
    || payload.meta.total !== payload.jobs.length) throw new Error('Incomplete GHX native inventory or published total')
  const identities = new Set(), interpreted = []
  const nativeLocation = 'Office Location or Remote - USA'
  const jobs = payload.jobs.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)
      || !Number.isSafeInteger(record.id) || record.id <= 0 || identities.has(record.id)
      || typeof record.title !== 'string' || !record.title.trim()) throw new Error('Malformed GHX native inventory identity')
    identities.add(record.id)
    if (record.isListed === false || Object.hasOwn(record, 'isListed') && typeof record.isListed !== 'boolean') {
      throw new Error('GHX native inventory has an unlisted or unknown active role')
    }
    if (record.company_name != null && (typeof record.company_name !== 'string'
      || record.company_name.trim().toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase())) {
      throw new Error('GHX native inventory has a foreign declared employer')
    }
    if (!normalizeGreenhouseJobUrl(record.absolute_url, record.id)) throw new Error('GHX native inventory has an invalid board or role URL identity')
    const office = record.offices?.[0]
    if (record.location?.name !== nativeLocation || !Array.isArray(record.offices) || record.offices.length !== 1
      || office?.id !== 4007048005 || office.name !== nativeLocation || office.location !== null
      || office.parent_id !== null || !Array.isArray(office.child_ids) || office.child_ids.length) return record
    interpreted.push(String(record.id))
    // This source publishes the country explicitly in both labels. Interpret
    // only its observed template; the original payload remains unchanged.
    return { ...record, location: { ...record.location, name: 'USA' },
      offices: [{ ...office, location: 'USA' }] }
  })
  return { payload: { ...payload, jobs }, proof: { method: 'ghx-explicit-usa-office-template',
    field: 'location.name and offices[0].name', officeId: 4007048005, nativeLocation,
    interpretedCountry: 'United States', jobIds: interpreted } }
}

export const createGhxIndiaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const requestOptions = signal ? { signal } : {}
    const careersHtml = await fetchText(CAREERS_URL, requestOptions)
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('GHX India verified GHX careers page no longer matches the official first-party handoff')
    }
    const officialJobIds = requireActiveBoardHandoff(careersHtml)

    const payload = await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET', ...requestOptions })
    signal?.throwIfAborted()
    const validation = validatedInventoryView(payload)
    const nativeIds = new Set(payload.jobs.map(record => String(record.id)))
    let unmatchedOfficialJobIds = officialJobIds.filter(id => !nativeIds.has(id))
    validation.proof.officialJobIds = officialJobIds
    validation.proof.unmatchedOfficialJobIds = [...unmatchedOfficialJobIds]
    const unavailableAudit = unmatchedOfficialJobIds.length ? await verifyCurrentUnavailableGhxRole({
      jobIds: unmatchedOfficialJobIds, payload, officialHtml: careersHtml, nativeUrl: buildGreenhouseJobsApiUrl(),
      officialUrl: CAREERS_URL, fetchJson, fetchText, validateNative: validatedInventoryView, signal,
      readOfficialJobIds: html => {
        if (!hasOfficialCareersSignal(html)) throw new Error('GHX closing official employer identity changed')
        return requireActiveBoardHandoff(html)
      },
    }) : null
    signal?.throwIfAborted()
    if (unavailableAudit?.verified) unmatchedOfficialJobIds = []
    validation.proof.unreconciledOfficialJobIds = [...unmatchedOfficialJobIds]
    validation.proof.unavailableAdvertisedRoles = unavailableAudit?.proofs || []
    const jobs = extractIndiaJobsFromGreenhousePayload(
      payload,
      { scrapedAt: now() },
    )
    const nativeById = new Map(payload.jobs.map(record => [String(record.id), record]))
    const unprovedIndiaIds = new Set(jobs.filter(job => {
      const record = nativeById.get(String(job.jobId))
      return ![record.location?.name, ...(record.offices || []).flatMap(office => [office.name, office.location]),
        ...greenhouseCountryLabels(record)].some(label => typeof label === 'string' && /\bindia\b/i.test(label))
    }).map(job => String(job.jobId)))
    const selected = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const evidenced = await attachGreenhouseSourceEvidence(selected, { source: SOURCE, companyName: COMPANY,
      companyCareerPage: CAREERS_URL, boardToken: 'globalhealthcareexchangeinc',
      payload: validation.payload, officialHtml: careersHtml, signal })
    signal?.throwIfAborted()
    for (const job of evidenced) {
      const native = nativeById.get(String(job.jobId))
      job.sourceNativeLocation = structuredClone(native.location)
      job.sourceNativeOffices = structuredClone(native.offices)
      job.sourceNativeInventoryEvidence = structuredClone(validation.proof)
      if (unprovedIndiaIds.has(String(job.jobId))) { job.country = null; job.sourceCountryComplete = false }
      if (unmatchedOfficialJobIds.length || unprovedIndiaIds.size) {
        job.sourceScopeComplete = false
        job.lifecycleCleanupAllowed = false
        job.sourceListingComplete = false
      }
      const content = extractActiveDescription(job.jobDescription)
      job.sourceDetailComplete = Boolean(content && content.length >= 200 && content.split(/\s+/).length >= 30)
      if (!job.sourceDetailComplete) { job.sourceDetailFailureKind = 'missing-content'; job.sourceListingComplete = false }
    }
    const incompleteDetails = evidenced.some(job => job.sourceDetailComplete === false)
    if (unavailableAudit) Object.defineProperty(evidenced, 'nativeCollectionEvidence', {
      value: { source: SOURCE, method: 'ghx-current-advertised-unavailability-audit', ...structuredClone(unavailableAudit) }, configurable: true,
    })
    let evidence = readInventoryEvidence(evidenced)
    if (unavailableAudit?.verified) {
      evidence = { ...evidence, pagesFetched: 2 + unavailableAudit.responsesReceived,
        reason: evidence.reason + ':ghx-advertised-unavailable-verified:4730895005@' + unavailableAudit.proofs[0].opening.api.sha256 }
      attachInventoryEvidence(evidenced, evidence)
    }
    if (!incompleteDetails && !unmatchedOfficialJobIds.length && !unprovedIndiaIds.size) return evidenced
    return attachInventoryEvidence(evidenced, { ...evidence,
      status: unmatchedOfficialJobIds.length || unprovedIndiaIds.size ? 'coverage-gap' : 'discovery-only', listingComplete: false,
      ...(unmatchedOfficialJobIds.length || unprovedIndiaIds.size ? { indiaFacetCount: null, lifecycleCleanupAllowed: false } : {}),
      reason: evidence.reason
        + (unmatchedOfficialJobIds.length ? ':ghx-featured-roles-not-in-native-inventory:' + unmatchedOfficialJobIds.join(',') : '')
        + (unavailableAudit && !unavailableAudit.verified ? ':ghx-unavailability-not-verified:' + unavailableAudit.failures.map(row => row.reason).join(';') : '')
        + (unprovedIndiaIds.size ? ':ghx-country-not-explicitly-native:' + [...unprovedIndiaIds].join(',') : '')
        + (incompleteDetails ? ':ghx-selected-role-description-not-substantive' : '') })
  },
})

export const run = async (options = {}) => createGhxIndiaScraper(options).run(options)

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
