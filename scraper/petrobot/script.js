import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, mapJobsWithInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decodeNativeEntities, readNativeAttributeTokens } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'petrobot'
export const COMPANY = 'PetroBot'
export const CAREERS_URL = 'https://petrobot.co.in/company/careers'
export const SMARTRECRUITERS_BOARD_URL =
  'https://careers.smartrecruiters.com/PetroBotTechnologiesPvtLtd'
export const SMARTRECRUITERS_LISTING_API_URL =
  'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings'
export const SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE =
  'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings/{{jobId}}'
const SMARTRECRUITERS_COMPANY_IDENTIFIER = 'PetroBotTechnologiesPvtLtd'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  let document, body, titles
  try {
    document = readVisibleNativeDocument(String(html ?? ''), { strict: true })
    body = document.nodes(node => node.tag === 'body')
    titles = document.nodes(node => node.tag === 'title')
  } catch { return false }
  if (body.length !== 1 || titles.length !== 1) return false
  const page = document.text(body[0])

  return /^Careers at PetroBot - Robotics and NDT Inspection Jobs$/i.test(normalizeWhitespace(titles[0].raw) || '')
    && /Join our team and help build the future of robotic inspection technology\./i.test(page)
    && /\bOpen Positions\b/i.test(page)
    && /View all positions on SmartRecruiters/i.test(page)
    && /PetroBot, inspecting assets where humans shouldn't have to go\./i.test(page)
    && /Developed in India\./i.test(page)
    && /Funded by ONGC & HPCL\./i.test(page)
  }

// Only opening-attribute provenance. The shared reader owns DOM visibility and
// parsing; comments and raw bodies cannot provide a competing native href.
const anchorOpeningAttributes = html => {
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'])
  const tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const anchors = []
  let match
  while ((match = tags.exec(html))) {
    if (!match[1] || match[0].startsWith('</')) continue
    const tag = match[1].toLowerCase()
    if (tag === 'a') anchors.push(match[2])
    if (raw.has(tag)) {
      if (tag === 'plaintext') break
      const closing = new RegExp('</' + tag + '[\\t\\n\\f\\r ]*>', 'ig')
      closing.lastIndex = tags.lastIndex
      const end = closing.exec(html)
      tags.lastIndex = end ? closing.lastIndex : html.length
    }
  }
  return anchors
}

export const extractVerifiedJobsBoardUrl = (html) => {
  try {
    const page = String(html ?? ''), document = readVisibleNativeDocument(page, { strict: true })
    const root = document.nodes(node => node.tag === 'root')[0]
    if (!root) return null
    const allAnchors = [], parents = new Map()
    const collect = (node, parent = null) => {
      parents.set(node, parent)
      if (node.tag === 'a') allAnchors.push(node)
      for (const child of node.children || []) if (typeof child !== 'string') collect(child, node)
    }
    collect(root)
    const rawAttributes = anchorOpeningAttributes(page)
    if (rawAttributes.length !== allAnchors.length) return null
    const provenance = new Map(allAnchors.map((node, index) => [node, rawAttributes[index]]))
    const label = node => /^View all positions on SmartRecruiters$/i.test(document.text(node))
    const candidates = document.nodes(node => node.tag === 'a' && (label(node) || node.attrs.href === SMARTRECRUITERS_BOARD_URL))
    if (!candidates.length) return null
    const handler = node => Object.keys(node.attrs || {}).some(key => /^on/i.test(key))
    const descendantHandler = node => (node.children || []).some(child =>
      typeof child !== 'string' && !child.inert && (handler(child) || descendantHandler(child)))
    for (const node of candidates) {
      if (!label(node) || node.attrs.href !== SMARTRECRUITERS_BOARD_URL
        || Object.hasOwn(node.attrs, 'download') || descendantHandler(node)) return null
      for (let owner = node; owner; owner = parents.get(owner)) {
        if (handler(owner) || Object.hasOwn(owner.attrs, 'disabled')
          || owner.attrs['aria-disabled']?.trim().toLowerCase() === 'true') return null
      }
      const hrefs = readNativeAttributeTokens(provenance.get(node)).filter(([name]) => name === 'href')
      if (hrefs.length !== 1 || decodeNativeEntities(hrefs[0][1]) !== node.attrs.href) return null
    }
    return SMARTRECRUITERS_BOARD_URL
  } catch { return null }
}

const identityError = field => Object.assign(new Error('PetroBot native SmartRecruiters identity mismatch: ' + field), {
  incompleteScope: true, abortRetries: true,
})
const requireIdentity = (condition, field) => { if (!condition) throw identityError(field) }
const nativeId = value => {
  requireIdentity(typeof value === 'string' || typeof value === 'number' && Number.isSafeInteger(value), 'role ID')
  const id = String(value)
  requireIdentity(/^[1-9]\d*$/.test(id), 'role ID')
  return id
}
const nativeUrl = (value, field) => {
  requireIdentity(typeof value === 'string' && value !== '' && !/[\u0000-\u0020\u007f\\]/.test(value), field)
  let url
  try { url = new URL(value) } catch { throw identityError(field) }
  requireIdentity(url.protocol === 'https:' && !url.username && !url.password && !url.hash, field)
  return url
}
const assertApiRoleUrl = (value, id, field) => {
  const url = nativeUrl(value, field)
  requireIdentity(url.href === SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE.replace('{{jobId}}', id), field)
}
const assertPublicRoleUrl = (value, id, field) => {
  const url = nativeUrl(value, field), parts = url.pathname.split('/').slice(1)
  requireIdentity(url.origin === 'https://jobs.smartrecruiters.com' && parts.length === 2
    && parts[0] === SMARTRECRUITERS_COMPANY_IDENTIFIER
    && (parts[1] === id || parts[1].startsWith(id + '-') && /^[a-z0-9-]+$/i.test(parts[1].slice(id.length + 1))), field)
  // Preserve the supported native application query verbatim. Unknown role
  // selectors/duplicate values cannot be silently ignored for admission.
  requireIdentity(!url.search || url.search === '?oga=true', field)
}
const assertPublicationState = record => {
  if (Object.hasOwn(record, 'visibility')) requireIdentity(record.visibility === 'PUBLIC', 'native publication visibility')
  if (Object.hasOwn(record, 'active')) requireIdentity(record.active === true, 'native publication active state')
}
const nativeRegions = new Intl.DisplayNames(['en'], { type: 'region' })
const nativeCountryCode = value => {
  if (typeof value !== 'string' || !/^[a-z]{2}$/i.test(value)) return null
  const code = value.toUpperCase()
  return !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code) && nativeRegions.of(code) !== code ? code : null
}
const assertNativeCountryConsistency = record => {
  const location = record.location
  const code = nativeCountryCode(location?.country)
  if (code && code !== 'IN' && /\bIndia\b/i.test(normalizeWhitespace(location?.fullLocation) || '')) {
    throw identityError('native country/location contradiction')
  }
  if (code === 'IN' && getValidIndiaCityForJob({ country: 'India', location: location?.fullLocation }) === null) {
    throw identityError('native country/location contradiction')
  }
}
const assertListingIdentity = record => {
  requireIdentity(record && typeof record === 'object' && !Array.isArray(record), 'listing record')
  assertPublicationState(record)
  assertNativeCountryConsistency(record)
  const id = nativeId(record.id)
  requireIdentity(record.company && !Array.isArray(record.company)
    && record.company.identifier === SMARTRECRUITERS_COMPANY_IDENTIFIER, 'listing company')
  requireIdentity(typeof record.name === 'string' && normalizeWhitespace(record.name), 'listing title')
  assertApiRoleUrl(record.ref, id, 'listing ref')
  for (const field of ['postingUrl', 'applyUrl']) if (Object.hasOwn(record, field)) assertPublicRoleUrl(record[field], id, 'listing ' + field)
  return id
}
const assertDetailIdentity = (listing, detail, id) => {
  requireIdentity(detail && typeof detail === 'object' && !Array.isArray(detail), 'detail record')
  assertPublicationState(detail)
  assertNativeCountryConsistency(detail)
  requireIdentity(nativeId(detail.id) === id, 'detail ID')
  requireIdentity(normalizeWhitespace(detail.name) === normalizeWhitespace(listing.name), 'detail title')
  if (listing.refNumber != null || detail.refNumber != null) {
    requireIdentity(normalizeWhitespace(detail.refNumber) === normalizeWhitespace(listing.refNumber), 'detail requisition')
  }
  if (Object.hasOwn(detail, 'company')) {
    requireIdentity(detail.company && !Array.isArray(detail.company)
      && detail.company.identifier === SMARTRECRUITERS_COMPANY_IDENTIFIER, 'detail company')
  }
  if (Object.hasOwn(detail, 'ref')) assertApiRoleUrl(detail.ref, id, 'detail ref')
  for (const field of ['uuid', 'jobAdId', 'defaultJobAd']) {
    if (Object.hasOwn(listing, field) || Object.hasOwn(detail, field)) {
      requireIdentity(listing[field] != null && detail[field] === listing[field], 'detail ' + field)
    }
  }
  assertPublicRoleUrl(detail.postingUrl, id, 'detail postingUrl')
  assertPublicRoleUrl(detail.applyUrl, id, 'detail applyUrl')
  if (Object.hasOwn(detail, 'referralUrl')) {
    // Native publication UUID is a separate identity field, not the numeric
    // posting id or the distinct internal jobId. Keep every namespace literal.
    requireIdentity(typeof detail.uuid === 'string' && /^[0-9a-f-]+$/i.test(detail.uuid), 'referral publication UUID')
    const referral = nativeUrl(detail.referralUrl, 'detail referralUrl')
    requireIdentity(referral.href === 'https://jobs.smartrecruiters.com/external-referrals/company/'
      + SMARTRECRUITERS_COMPANY_IDENTIFIER + '/publication/' + detail.uuid + '?dcr_ci='
      + SMARTRECRUITERS_COMPANY_IDENTIFIER, 'detail referralUrl')
  }
  if (Object.hasOwn(detail, 'location')) {
    requireIdentity(detail.location && typeof detail.location === 'object' && !Array.isArray(detail.location), 'detail location')
    for (const field of ['city', 'region', 'country', 'fullLocation']) {
      if (detail.location[field] != null && listing.location?.[field] != null) {
        const expected = normalizeWhitespace(listing.location[field]), observed = normalizeWhitespace(detail.location[field])
        requireIdentity(field === 'country' ? observed?.toLowerCase() === expected?.toLowerCase() : observed === expected, 'detail location ' + field)
      }
    }
  }
  if (listing.releasedDate != null && Object.hasOwn(detail, 'releasedDate')) {
    requireIdentity(detail.releasedDate === listing.releasedDate, 'detail publication date')
  }
}

const createApiProvider = () => ({
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  countryFilter: 'India',
  config: {
    request: {
      method: 'GET',
      query: {
        limit: '100',
        country: 'in',
      },
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 100,
      offsetParam: 'offset',
      limitParam: 'limit',
      resultsPath: 'content',
      totalCountPath: 'totalFound',
    },
    mapping: {
      title: 'name',
      location: 'location.fullLocation',
      country: { path: 'location.country', valueMap: { in: 'India', IN: 'India', In: 'India', iN: 'India' } },
      jobId: 'id',
      requisitionId: 'refNumber',
      sourceUrl: 'postingUrl',
      applyUrl: 'applyUrl',
      department: 'department.label',
      employmentType: 'typeOfEmployment.label',
      experienceLevel: 'experienceLevel.label',
      postingDate: 'releasedDate',
    },
    detail: {
      enabled: true,
      urlTemplate: SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE,
      method: 'GET',
      mapping: {
        jobDescription: 'jobAd.sections.jobDescription.text',
        minimumQualification: 'jobAd.sections.qualifications.text',
        preferredQualification: 'jobAd.sections.additionalInformation.text',
      },
    },
    resultFilter: {
      // Native-country qualification below retains unresolved observations.
      // The search country and a city/location label are not country defaults.
      include: [],
    },
    discovery: {
      listingApiUrl: SMARTRECRUITERS_LISTING_API_URL,
    },
  },
})

// Caller cancellation stays authoritative even when a supplied reader ignores its signal.
const withPetroSignal = async (signal, operation) => {
  signal?.throwIfAborted()
  if (!signal) return operation()
  let onAbort
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }),
      aborted,
    ])
    signal.throwIfAborted()
    return value
  } catch (error) {
    signal.throwIfAborted()
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  signal: options.signal,
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPetroBotScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    const careersHtml = await withPetroSignal(signal, () => fetchText(CAREERS_URL, { signal }))

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('PetroBot official careers surface changed and no longer matches the verified first-party page')
    }

    const boardUrl = extractVerifiedJobsBoardUrl(careersHtml)
    if (boardUrl !== SMARTRECRUITERS_BOARD_URL) {
      throw new Error('PetroBot verified SmartRecruiters handoff changed on the official careers page')
    }

    const listings = new Map(), details = new Map()
    const fetchNativeJson = async (value, options) => {
      const url = nativeUrl(value, 'request URL'), listingPath = new URL(SMARTRECRUITERS_LISTING_API_URL).pathname
      requireIdentity(url.origin === 'https://api.smartrecruiters.com', 'request origin')
      const isListing = url.pathname === listingPath
      const id = isListing ? null : url.pathname.slice(listingPath.length + 1)
      if (!isListing) {
        requireIdentity(url.pathname.startsWith(listingPath + '/') && listings.has(id), 'unadvertised detail')
        assertApiRoleUrl(value, id, 'detail request URL')
      }
      const payload = await withPetroSignal(options?.signal || signal, () => fetchJson(value, options))
      if (!payload || typeof payload !== 'object' || payload.success === false || payload.error || payload.errors?.length) return payload
      if (isListing) {
        if (Array.isArray(payload.content)) for (const record of payload.content) {
          const recordId = assertListingIdentity(record)
          requireIdentity(!listings.has(recordId), 'duplicate listing ID')
          listings.set(recordId, record)
        }
      } else {
        assertDetailIdentity(listings.get(id), payload, id)
        details.set(id, payload)
      }
      return payload
    }
    const jobs = await runApiPortalScraper({
      provider: createApiProvider(),
      signal,
      fetchJson: fetchNativeJson,
    })

    signal?.throwIfAborted()
    const projectedJobs = mapJobsWithInventoryEvidence(jobs, job => {
      const listing = listings.get(String(job.jobId)), detail = details.get(String(job.jobId))
      const code = nativeCountryCode(detail?.location?.country) || nativeCountryCode(listing?.location?.country)
      const decorated = { ...job, department: typeof job.department === 'string' ? job.department : null }
      if (code && code !== 'IN') return { ...decorated, country: code }
      const location = job.location ?? detail?.location?.fullLocation ?? listing?.location?.fullLocation ?? null
      const city = job.city ?? detail?.location?.city ?? listing?.location?.city ?? null
      if (code === 'IN' && (location == null || typeof location === 'string')
        && (city == null || typeof city === 'string')
        && getValidIndiaCityForJob({ country: 'India', location, city }) !== null) {
        return { ...decorated, location, city, country: 'India' }
      }
      // Preserve the role and all native workplace statements, but withhold
      // public geography so shared city/remote defaults cannot manufacture IN.
      return {
        ...decorated, location: null, city: null, state: null, country: null,
        nativeGeographyQualified: false, sourceListingComplete: false,
        rawNativeWorkplaceEvidence: {
          source: SOURCE, jobId: job.jobId, publicGeographyQualified: false,
          listing: structuredClone(listing?.location ?? null),
          detail: structuredClone(detail?.location ?? null),
        },
      }
    })
    const unresolved = projectedJobs.some(job => job.nativeGeographyQualified === false)
    const normalizedJobs = projectedJobs.filter(job => job.country === 'India' || job.nativeGeographyQualified === false)
    const sourceEvidence = readInventoryEvidence(jobs)
    if (sourceEvidence) attachInventoryEvidence(normalizedJobs, unresolved ? {
      ...sourceEvidence, listingComplete: false, indiaFacetCount: null,
      status: ['complete-inventory', 'verified-empty'].includes(sourceEvidence.status) ? 'discovery-only' : sourceEvidence.status,
      reason: [sourceEvidence.reason, 'petrobot-native-geography-unresolved'].filter(Boolean).join(';'),
    } : sourceEvidence)

    if (!Number.isFinite(maxJobs)) return normalizedJobs
    const output = normalizedJobs.slice(0, maxJobs)
    for (const job of output) job.sourceListingComplete = false
    const evidence = readInventoryEvidence(normalizedJobs)
    if (evidence) attachInventoryEvidence(output, {
      ...evidence,
      status: ['complete-inventory', 'verified-empty'].includes(evidence.status) ? 'discovery-only' : evidence.status,
      listingComplete: false,
      reason: [evidence.reason, 'petrobot-explicit-bounded-run'].filter(Boolean).join(';'),
    })
    return output
  },
})

export const run = async (options = {}) => createPetroBotScraper(options).run(options)

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
