import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

export const COMPANY_NAME = 'Optum'
export const SOURCE = 'optum'
export const ATS_PLATFORM = 'talentbrew-radancy+oracle-taleo'
export const BASE_URL = 'https://careers.unitedhealthgroup.com'
export const CAREER_PAGE_URL = BASE_URL + '/location/india-jobs/34088/1269750/2'
const config = loadConfig(path.dirname(fileURLToPath(import.meta.url)))
const MAX_NATIVE_PAGES = 10
const MAX_NATIVE_ROLES = 150
const MAX_PUBLIC_READS = 400
const SOURCE_DEADLINE_MS = 90000
// The default registered live read consumed 67,390,562 bytes, above 64 MiB.
const MAX_TOTAL_RESPONSE_BYTES = 96 * 1024 * 1024
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const hash = body => createHash('sha256').update(body).digest('hex')
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('Optum current native inventory: ' + message), {
    abortRetries: true, softFailure: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false,
  })
}
const descendants = (node, predicate) => typeof node === 'string' || node.inert ? []
  : [...(predicate(node) ? [node] : []), ...node.children.flatMap(child => descendants(child, predicate))]
const absolute = value => {
  let url
  try { url = new URL(value, BASE_URL) } catch { need(false, 'invalid native URL') }
  need(url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'invalid native URL identity')
  return url
}
const roleUrl = value => {
  const url = absolute(value)
  need(url.origin === BASE_URL && !url.search && /^\/job\/[^/?#]+\/[^/?#]+\/34088\/\d+$/.test(url.pathname), 'native role URL identity changed')
  return url.href
}
const listingUrl = value => {
  const url = absolute(value)
  need(url.origin === BASE_URL && !url.search && (url.href === CAREER_PAGE_URL || url.href.startsWith(CAREER_PAGE_URL + '/')
    && /^\/[1-9]\d*$/.test(url.href.slice(CAREER_PAGE_URL.length))), 'native listing URL left the advertised India search')
  return url.href
}
export const buildSearchUrl = ({ page = 1 } = {}) => {
  need(Number.isSafeInteger(Number(page)) && Number(page) >= 1, 'invalid requested page')
  return Number(page) === 1 ? CAREER_PAGE_URL : CAREER_PAGE_URL + '/' + Number(page)
}

const parseListings = html => {
  const document = readVisibleNativeDocument(String(html), { strict: true })
  const sections = document.nodes(node => node.tag === 'section' && node.attrs.id === 'search-results-list')
  need(sections.length === 1, 'native listing section unavailable or ambiguous')
  return descendants(sections[0], node => node.tag === 'a' && Object.hasOwn(node.attrs, 'data-job-id')).map(node => {
    const sourceUrl = roleUrl(node.attrs.href), jobId = node.attrs['data-job-id']
    const titles = descendants(node, item => item.tag === 'h2')
    const ids = descendants(node, item => item.tag === 'span' && document.hasClass(item, 'job-id'))
    const places = descendants(node, item => item.tag === 'span' && document.hasClass(item, 'job-location'))
    const title = titles.length === 1 ? document.text(titles[0]) : '', requisitionId = ids.length === 1 ? document.text(ids[0]) : ''
    const location = places.length === 1 ? document.text(places[0]) : ''
    need(/^\d+$/.test(jobId || '') && new URL(sourceUrl).pathname.endsWith('/' + jobId)
      && title && /^\d+$/.test(requisitionId) && location, 'native listing identity, formal requisition or location changed')
    const optum = document.hasClass(node, 'brand-facet__optum')
    return { title, company: COMPANY_NAME, jobId, requisitionId, location, city: location.split(',')[0].trim(),
      country: null, sourceUrl, applyUrl: sourceUrl, nativeBrand: optum ? 'Optum' : null,
      nativeBrandClass: optum ? 'brand-facet__optum' : null }
  })
}
export const extractSearchResults = html => parseListings(html).filter(row => row.nativeBrand === 'Optum')

export const extractPaginationSummary = html => {
  const document = readVisibleNativeDocument(String(html), { strict: true })
  const nodes = document.nodes(node => node.tag === 'section' && node.attrs.id === 'search-results')
  need(nodes.length === 1, 'native pagination scope unavailable or ambiguous')
  const node = nodes[0]
  const integer = key => { const text = node.attrs[key]; need(/^\d+$/.test(text || ''), 'native pagination ' + key + ' unavailable'); return Number(text) }
  const currentPage = integer('data-current-page'), totalPages = integer('data-total-pages')
  const totalJobCount = integer('data-total-results'), pageSize = integer('data-records-per-page')
  need([currentPage, totalPages, totalJobCount, pageSize].every(Number.isSafeInteger) && currentPage >= 1 && pageSize > 0
    && (totalJobCount > 0 ? totalPages === Math.ceil(totalJobCount / pageSize) && currentPage <= totalPages : totalPages <= 1), 'native pagination counts disagree')
  const next = descendants(node, item => item.tag === 'a' && document.hasClass(item, 'next'))
  need(next.length <= 1, 'ambiguous native next page')
  const nextUrl = next.length ? listingUrl(next[0].attrs.href) : null, hasNext = currentPage < totalPages
  need(hasNext === Boolean(nextUrl) && (!nextUrl || nextUrl === buildSearchUrl({ page: currentPage + 1 })), 'native next page identity changed')
  return { hasNext, currentPage, totalPages, totalJobCount, pageSize, nextUrl }
}

const nativeModels = html => {
  const document = readNativeDocument(String(html)), models = []
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') {
      if (value['@type'] === 'JobPosting' || Array.isArray(value['@type']) && value['@type'].includes('JobPosting')) models.push(value)
      if (value['@graph']) walk(value['@graph'])
    }
  }
  for (const node of document.nodes(item => item.tag === 'script' && item.attrs.type?.toLowerCase() === 'application/ld+json')) {
    try { walk(JSON.parse(node.raw || '')) } catch { need(!/JobPosting/.test(node.raw || ''), 'malformed native JobPosting model') }
  }
  return { document, models }
}
const nativeDate = (value, name, verify = need) => {
  verify(typeof value === 'string', 'native ' + name + ' date unavailable')
  const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value), instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  verify((calendar || instant) && Number.isFinite(Date.parse(value)) && (!calendar || new Date(value).toISOString().slice(0, 10) === value), 'invalid native ' + name + ' date')
  return { value, precision: calendar ? 'calendar-date' : 'instant' }
}
const indiaCountry = value => {
  const fields = typeof value === 'string' ? [value] : [value?.name, value?.alternateName, value?.identifier].filter(value => value != null)
  return fields.length > 0 && fields.every(field => typeof field === 'string' && /^(?:India|IN|IND)$/i.test(field.trim()))
}
const qualificationFields = html => {
  const document = readVisibleNativeDocument(html, { strict: true }), required = [], preferred = []
  let section = null
  const walk = node => {
    if (typeof node === 'string' || node.inert) return
    if (/^(?:p|h[1-6])$/.test(node.tag)) {
      const label = document.text(node).replace(/:$/, '').toLowerCase()
      if (/^required (?:qualifications|skills)$/.test(label)) section = required
      else if (/^preferred (?:qualifications|skills)$/.test(label)) section = preferred
    }
    if (node.tag === 'li' && section) section.push(document.text(node))
    node.children.forEach(walk)
  }
  document.nodes(node => node.tag === 'root').forEach(walk)
  return { requiredSkills: required.filter(Boolean), preferredQualification: preferred.length ? preferred.join('; ') : null,
    minimumQualification: required.find(value => /\b(?:Bachelor|Master|B\.Tech|B\.E\.|M\.Tech|MBA)/i.test(value)) || null }
}

export const extractJobDetail = (html, listing = {}) => {
  need(listing.nativeBrand === 'Optum' && listing.nativeBrandClass === 'brand-facet__optum', 'explicit native Optum brand provenance unavailable')
  const expectedUrl = roleUrl(listing.sourceUrl), { document, models } = nativeModels(html)
  const matching = models.filter(model => model.url === expectedUrl)
  need(matching.length === 1, 'native role model URL identity unavailable or ambiguous')
  const model = matching[0], title = normalize(model.title)
  const roleNeed = (condition, reason, message) => {
    if (!condition) throw Object.assign(new Error('Optum current native inventory: ' + message), {
      code: 'OPTUM_NATIVE_ROLE_UNVERIFIED', roleSpecificHold: true, reason, abortRetries: true,
      softFailure: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false,
      nativeSourceRecord: structuredClone(model),
    })
  }
  const requisitionId = typeof model.identifier === 'string' ? model.identifier : model.identifier?.value
  const meta = name => {
    const values = document.nodes(node => node.tag === 'meta' && node.attrs.name === name).map(node => node.attrs.content)
    need(values.length === 1 && typeof values[0] === 'string', 'native ' + name + ' identity unavailable')
    return values[0]
  }
  roleNeed(title && title === listing.title && /^\d+$/.test(requisitionId || '') && requisitionId === listing.requisitionId
    && meta('job-ats-req-id') === requisitionId, 'native-listing-detail-identity-conflict', 'native listing and detail title/requisition identity disagree')
  const headings = document.nodes(node => node.tag === 'h1')
  need(headings.length === 1, 'native visible title envelope unavailable or ambiguous')
  roleNeed(document.text(headings[0]) === title, 'native-listing-detail-identity-conflict', 'native visible title identity changed')
  const sourceDescription = model.description, jobDescription = extractActiveDescription(sourceDescription)
  roleNeed(typeof sourceDescription === 'string' && jobDescription && jobDescription.length >= 100,
    'full-native-criteria-unavailable', 'full native description and criteria unavailable')
  const employer = normalize(model.hiringOrganization?.name)
  roleNeed(employer === 'Optum' || employer === 'UnitedHealth Group',
    'native-employer-context-unverified', 'native employer and Optum brand context disagree')
  const ownBrandContext = employer === 'Optum' || /^Optum is a global organization\b/.test(jobDescription)
  const nativeLocations = Array.isArray(model.jobLocation) ? model.jobLocation : model.jobLocation ? [model.jobLocation] : []
  const india = nativeLocations.map(place => place?.address).filter(address => address && indiaCountry(address.addressCountry))
  const definiteForeign = nativeLocations.some(place => typeof place?.address?.addressCountry === 'string'
    && normalize(place.address.addressCountry) && !indiaCountry(place.address.addressCountry))
  roleNeed(india.length > 0, definiteForeign ? 'native-country-outside-India' : 'native-India-country-unavailable',
    'typed native India country and worksite unavailable')
  roleNeed(india.every(address => normalize(address.addressLocality)), 'native-India-worksite-unavailable',
    'typed native India country and worksite unavailable')
  const locations = india.map(address => [address.addressLocality, address.addressRegion, 'India'].filter(Boolean).map(normalize).join(', '))
  const applyUrl = absolute(meta('search-job-apply-url'))
  roleNeed(applyUrl.origin === 'https://uhg.taleo.net' && applyUrl.pathname === '/careersection/10780/jobapply.ftl'
    && applyUrl.searchParams.get('job') === requisitionId && applyUrl.searchParams.getAll('job').length === 1,
  'native-application-identity-unverified', 'native Taleo application requisition identity changed')
  const applyLinks = document.nodes(node => node.tag === 'a' && document.hasClass(node, 'job-apply'))
  roleNeed(applyLinks.length > 0 && applyLinks.every(node => node.attrs['data-job-id'] === listing.jobId
    && node.attrs['data-job-organization-id'] === '34088' && node.attrs.href === applyUrl.href),
  'native-application-identity-unverified', 'active native application link and posting identity disagree')
  const publication = nativeDate(model.datePosted, 'publication', (valid, message) => roleNeed(valid, 'native-publication-date-unavailable', message))
  const closing = model.validThrough == null ? null : nativeDate(model.validThrough, 'closing', (valid, message) => roleNeed(valid, 'native-closing-date-unavailable', message))
  const category = document.nodes(node => node.tag === 'meta' && node.attrs.name === 'gtm_tbcn_jobcategory').map(node => node.attrs.content)
  roleNeed(ownBrandContext, 'native-Optum-brand-context-unavailable', 'independent native Optum own-brand context unavailable')
  return { source: SOURCE, company: COMPANY_NAME, title, jobId: listing.jobId, requisitionId, nativeJobPostingId: listing.jobId,
    country: 'India', city: normalize(india[0].addressLocality), location: locations[0], locations,
    sourceUrl: expectedUrl, applyUrl: applyUrl.href, link: applyUrl.href, sourceDescription, jobDescription,
    ...qualificationFields(sourceDescription), department: category.length === 1 ? normalize(category[0]) : null,
    employmentType: model.employmentType ?? null, experienceRequired: null, remoteStatus: model.jobLocationType ?? null,
    postingDate: publication.value, postedAt: publication.value, postingDatePrecision: publication.precision,
    sourcePostedDateRaw: model.datePosted, firstEverPostedAt: null,
    closingDate: closing?.value ?? null, closingDatePrecision: closing?.precision ?? null,
    sourceClosingDateIsExact: closing?.precision === 'instant', nativeEmployer: employer,
    nativeHiringOrganization: structuredClone(model.hiringOrganization), nativeSourceRecord: structuredClone(model),
    nativeBrandProvenance: { brand: 'Optum', brandClass: listing.nativeBrandClass, listingPage: listing.nativeListingPageUrl || CAREER_PAGE_URL,
      listingUrl: expectedUrl, formalRequisition: requisitionId, hiringOrganization: employer },
    applicationVisited: false, sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
}

const defaultFetchPage = async (url, signal, consumeBytes) => {
  const response = await fetch(url, { signal, redirect: 'error', credentials: 'omit',
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify public careers reader)' } })
  if ([401, 403, 429].includes(response.status)) {
    await response.body?.cancel().catch(() => {})
    throw Object.assign(new Error('Optum public access stop HTTP ' + response.status), { abortRetries: true, status: response.status, failureKind: 'blocked_or_access_denied', softFailure: true })
  }
  const reader = response.body?.getReader(), chunks = []; let size = 0
  if (reader) {
    try {
      for (;;) {
        const next = await reader.read(); if (next.done) break
        size += next.value.byteLength
        consumeBytes(next.value.byteLength)
        need(size <= MAX_RESPONSE_BYTES, 'native response-byte-budget exhausted')
        chunks.push(Buffer.from(next.value))
      }
    } finally { await reader.cancel().catch(() => {}) }
  }
  return { status: response.status, url: response.url, headers: response.headers, html: Buffer.concat(chunks).toString('utf8') }
}
const canonicalJson = value => JSON.stringify(value, (_key, field) => field && typeof field === 'object' && !Array.isArray(field)
  ? Object.fromEntries(Object.keys(field).sort().map(key => [key, field[key]])) : field)
const listingSignature = pages => hash(canonicalJson(pages.map(page => ({ url: page.url, summary: page.summary, rows: page.rows }))))
const nativeClosed = (job, observedAt) => job.closingDate != null && (job.sourceClosingDateIsExact
  ? Date.parse(job.closingDate) <= Date.parse(observedAt) : job.closingDate < observedAt.slice(0, 10))

export const createOptumScraper = ({ maxPages = config.maxPages ?? 10, maxJobs = config.maxJobs ?? null, detailConcurrency = 4 } = {}) => ({
  async run(options = {}) {
    options.signal?.throwIfAborted()
    const requestedPages = options.maxPages ?? maxPages, requestedJobs = options.maxJobs ?? maxJobs
    need(Number.isSafeInteger(requestedPages) && requestedPages >= 0, 'invalid native page cap')
    need(requestedJobs == null || Number.isSafeInteger(requestedJobs) && requestedJobs >= 0, 'invalid native role cap')
    const pageCap = Math.min(requestedPages, MAX_NATIVE_PAGES), jobCap = requestedJobs == null ? MAX_NATIVE_ROLES : Math.min(requestedJobs, MAX_NATIVE_ROLES)
    if (pageCap === 0 || jobCap === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: CAREER_PAGE_URL,
      firstParty: false, listingComplete: false, pagesFetched: 0, reportedTotal: null, indiaFacetCount: null, reason: 'caller-cap-zero-no-public-observations' })
    const bounded = (value, maximum, name) => {
      const requested = value ?? maximum
      need(Number.isSafeInteger(requested) && requested > 0, 'invalid native ' + name)
      return Math.min(requested, maximum)
    }
    const sourceDeadlineMs = bounded(options.sourceDeadlineMs, SOURCE_DEADLINE_MS, 'source deadline')
    const requestBudget = bounded(options.maxPublicReads, MAX_PUBLIC_READS, 'public read budget')
    const byteBudget = bounded(options.maxTotalResponseBytes, MAX_TOTAL_RESPONSE_BYTES, 'total response byte budget')
    const workerConcurrency = bounded(options.detailConcurrency ?? detailConcurrency, 4, 'detail concurrency')
    const controller = new AbortController(), signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
    const deadlineError = Object.assign(new Error('Optum native source deadline exhausted'), { name: 'TimeoutError', abortRetries: true, softFailure: true, failureKind: 'coverage_gap', lifecycleCleanupAllowed: false })
    const timer = setTimeout(() => controller.abort(deadlineError), sourceDeadlineMs); timer.unref?.()
    let requests = 0, totalResponseBytes = 0
    const consumeBytes = size => {
      totalResponseBytes += size
      need(totalResponseBytes <= byteBudget, 'native response-byte-budget exhausted')
    }
    const currentNow = () => {
      const value = options.now ? options.now() : new Date().toISOString()
      need(Number.isFinite(new Date(value).getTime()), 'invalid native observation clock')
      return new Date(value).toISOString()
    }
    const read = async url => {
      signal.throwIfAborted()
      need(requests < requestBudget, 'native public-read-budget exhausted')
      requests++
      const boundary = AbortSignal.any([signal, AbortSignal.timeout(15000)])
      const page = options.fetchPage ? await options.fetchPage(url, { signal: boundary })
        : options.fetchText ? { status: 200, url, headers: { 'content-type': 'text/html' }, html: await options.fetchText(url, { signal: boundary }) }
          : await defaultFetchPage(url, boundary, consumeBytes)
      boundary.throwIfAborted()
      const type = page.headers?.get?.('content-type') || page.headers?.['content-type'] || page.contentType || ''
      need(page.status === 200 && page.url === url && /^text\/html\b/i.test(type) && typeof page.html === 'string'
        && Buffer.byteLength(page.html) <= MAX_RESPONSE_BYTES, 'invalid native HTTP response identity or size')
      if (options.fetchPage || options.fetchText) consumeBytes(Buffer.byteLength(page.html))
      if (/<title[^>]*>\s*(?:Just a moment|Attention Required|Access Denied|Forbidden|Robot Check|Security Verification|Verify you are human)/i.test(page.html)
        || /(?:cf-chl-|\/cdn-cgi\/challenge-platform|datadome\.co\/captcha|px-captcha|id=["']challenge-form)/i.test(page.html)) {
        throw Object.assign(new Error('Optum public access challenge stop; inventory unknown'), { abortRetries: true, failureKind: 'blocked_or_access_denied', softFailure: true })
      }
      return page.html
    }
    const enumerate = async () => {
      const pages = [], ids = new Set(); let url = CAREER_PAGE_URL, total = null, totalPages = null
      for (let number = 1; url && number <= pageCap; number++) {
        const html = await read(url), summary = extractPaginationSummary(html), rows = parseListings(html)
        need(summary.currentPage === number, 'native page number disagrees with the advertised pagination')
        total ??= summary.totalJobCount; totalPages ??= summary.totalPages
        need(summary.totalJobCount === total && summary.totalPages === totalPages, 'native group search count changed during pagination')
        need(rows.length === Math.min(summary.pageSize, Math.max(0, total - (number - 1) * summary.pageSize)), 'native page is incomplete')
        for (const row of rows) { need(!ids.has(row.jobId), 'native pagination repeated a posting'); ids.add(row.jobId); row.nativeListingPageUrl = url }
        pages.push({ url, summary, rows }); url = summary.nextUrl
      }
      return { pages, total, totalPages, limited: Boolean(url) }
    }
    const mapDetails = async (rows, mapper) => {
      const result = new Array(rows.length); let next = 0
      const workers = Array.from({ length: Math.min(rows.length, workerConcurrency) }, async () => {
        try { while (next < rows.length) { signal.throwIfAborted(); const index = next++; result[index] = await mapper(rows[index], index) } }
        catch (error) { controller.abort(error); throw error }
      })
      const settled = await Promise.allSettled(workers), failure = settled.find(row => row.status === 'rejected')
      if (failure) throw failure.reason
      return result
    }
    try {
      currentNow()
      const opening = await enumerate(), all = opening.pages.flatMap(page => page.rows), optum = all.filter(row => row.nativeBrand === 'Optum')
      const selected = optum.slice(0, jobCap)
      const heldNativeRoles = []
      const qualified = (await mapDetails(selected, async listing => {
        const html = await read(listing.sourceUrl)
        const observedAt = currentNow()
        try {
          const job = extractJobDetail(html, listing)
          if (nativeClosed(job, observedAt)) throw Object.assign(new Error('Optum own native closing date has elapsed'), {
            roleSpecificHold: true, reason: 'native-role-known-closed', nativeSourceRecord: job.nativeSourceRecord,
          })
          return { listing, job }
        }
        catch (error) {
          // Only parsing/qualification of this successfully read role is held.
          // Transport/access and every closing read remain outside this boundary.
          heldNativeRoles.push({ reason: error?.roleSpecificHold === true ? error.reason : 'native-role-detail-envelope-unqualified', sourceUrl: listing.sourceUrl, jobId: listing.jobId,
            requisitionId: listing.requisitionId, title: listing.title, nativeListing: structuredClone(listing),
            nativeSourceRecord: error?.nativeSourceRecord == null ? null : structuredClone(error.nativeSourceRecord),
            nativeDetailBody: html, detailBodySha256: hash(html),
            nativeDetailError: { name: error?.name || 'Error', message: error?.message || String(error) },
            lifecycleCleanupAllowed: false })
          return null
        }
      })).filter(Boolean)
      const jobs = qualified.map(row => row.job)
      await mapDetails(qualified, async ({ listing, job }) => {
        const closing = extractJobDetail(await read(listing.sourceUrl), listing)
        need(canonicalJson([job.nativeSourceRecord, job.applyUrl]) === canonicalJson([closing.nativeSourceRecord, closing.applyUrl]), 'closing native detail identity, country, dates or full criteria changed')
        need(!nativeClosed(closing, currentNow()), 'closing native role expiry elapsed during reconciliation')
      })
      const closing = await enumerate(), openingHash = listingSignature(opening.pages), closingHash = listingSignature(closing.pages)
      need(openingHash === closingHash, 'closing native listing identities or counts changed')
      signal.throwIfAborted()
      const now = currentNow()
      need(!jobs.some(job => nativeClosed(job, now)), 'closing native role expiry elapsed before return')
      for (const job of jobs) job.scrapedAt = now
      const audit = { source: SOURCE, requestCount: requests, nativeRecords: all.length, reportedGroupSearchTotal: opening.total,
        totalResponseBytes, maxTotalResponseBytes: byteBudget, maxPublicReads: requestBudget, sourceDeadlineMs,
        hardNativePageCap: MAX_NATIVE_PAGES, hardNativeRoleCap: MAX_NATIVE_ROLES, detailConcurrency: workerConcurrency,
        reportedGroupSearchPages: opening.totalPages, visitedListingPages: opening.pages.length, observedOptumListingRows: optum.length,
        selectedOptumListingRows: selected.length,
        listingCapReached: opening.limited, roleCapReached: selected.length < optum.length, returnedIndiaJobs: jobs.length,
        heldNativeRoleCount: heldNativeRoles.length, heldNativeRoles: heldNativeRoles.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl)),
        listingReconciled: true, retainedNativeDetailsReconciled: true, openingListingSha256: openingHash, closingListingSha256: closingHash,
        sourceScopeComplete: false, lifecycleCleanupAllowed: false, unresolved: ['whole-company-recruitment-scope-unverified',
          ...(opening.limited ? ['native-listing-page-cap'] : []), ...(selected.length < optum.length ? ['caller-role-cap'] : []),
          ...new Set(heldNativeRoles.map(row => row.reason))], failures: [],
        nativeInventoryReads: [{ kind: 'current-first-party-India-group-search-with-explicit-Optum-brand', surface: CAREER_PAGE_URL, reportedTotal: opening.total }] }
      Object.defineProperty(jobs, Symbol.for('jobverify.verified-recruitment-observations'), { value: audit })
      options.onAudit?.(structuredClone(audit))
      signal.throwIfAborted()
      return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREER_PAGE_URL, firstParty: true, listingComplete: false,
        pagesFetched: requests, reportedTotal: null, indiaFacetCount: null, verifiedAt: now,
        reason: 'current-Optum-brand-listings+native-India-full-criteria-and-Taleo-requisition+closing-reconciliation;bounded-group-search-and-whole-company-scope-incomplete' })
    } catch (error) { controller.abort(error); options.signal?.throwIfAborted(); throw error }
    finally { clearTimeout(timer) }
  },
})
export const run = options => createOptumScraper(options).run(options)
