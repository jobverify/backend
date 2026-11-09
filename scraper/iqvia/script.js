import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { explicitWorkdayCountryScope } from '../../scraper-support/myworkday/countryInventoryProof.js'

export const IQVIA_ORIGIN = 'https://jobs.iqvia.com'
export const CAREERS_URL = `${IQVIA_ORIGIN}/en`
export const JOBS_PATH = '/en/jobs'
export const JOBS_URL = `${IQVIA_ORIGIN}${JOBS_PATH}`
export const INDIA_LOCATION_SIGNALS = [
  'india',
  'bengaluru',
  'gurugram',
  'hyderabad',
  'kochi',
  'kolkata',
  'mumbai',
  'pune',
]
const MAX_NATIVE_PAGES = 10
const MAX_PUBLIC_READS = 256
const SOURCE_DEADLINE_MS = 60000
const coverageError = message => Object.assign(new Error(message), {
  abortRetries: true, softFailure: true, failureKind: 'coverage_gap', upstreamOutage: false, lifecycleCleanupAllowed: false,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toIqviaUrl = (value) => {
  if (!value) return null
  try {
    const url = new URL(decodeHtmlEntities(value), IQVIA_ORIGIN)
    return url.origin === IQVIA_ORIGIN ? url.toString() : null
  } catch {
    return null
  }
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const extractJobId = (value) => extractFirst(
  /\/en\/jobs\/([^/?#]+)(?:[/?#]|$)/i,
  value,
  (match) => match[1],
)

const extractDefinitionFields = (html) => {
  const fields = new Map()
  for (const match of String(html ?? '').matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const label = stripTags(match[1])?.toLowerCase()
    const value = stripTags(match[2])
    if (label && value) fields.set(label, value)
  }
  return fields
}

const extractDescription = html => {
  const document = readVisibleNativeDocument(String(html ?? ''), { strict: true })
  const sections = document.nodes(node => node.tag === 'section' && document.hasClass(node, 'job-description'))
  if (sections.length !== 1) return { jobDescription: null, requiredSkills: [] }
  const requiredSkills = []
  const visit = node => {
    if (typeof node === 'string' || node.inert) return
    if (node.tag === 'li') {
      const skill = document.text(node)
      if (skill) requiredSkills.push(skill)
    }
    for (const child of node.children) visit(child)
  }
  visit(sections[0])
  return { jobDescription: document.text(sections[0]) || null, requiredSkills }
}

export const buildListingUrl = (page = 1) => {
  const url = new URL(JOBS_URL)
  if (Number.isInteger(page) && page > 1) {
    url.searchParams.set('page', String(page))
  }
  return url.toString()
}

export const isIndiaLocation = (location) => {
  return explicitWorkdayCountryScope(location) === 'india'
}

export const extractResultCount = (html) => {
  const countText = stripTags(
    extractFirst(/<[^>]*class=["'][^"']*results-count[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i, html)
    || '',
  )
  const count = /\bof\s+([\d,]+)\s+jobs\b/i.exec(countText || '')
  return count ? Number.parseInt(count[1].replace(/,/g, ''), 10) : null
}

const extractAllSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
)]
  .map((match) => {
    const card = match[1]
    const sourceUrl = toIqviaUrl(
      extractFirst(/<a\b[^>]*class=["'][^"']*job-title[^"']*["'][^>]*href=["']([^"']+)["']/i, card),
    )
    const title = stripTags(
      extractFirst(/<a\b[^>]*class=["'][^"']*job-title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i, card),
    )
    const location = stripTags(
      extractFirst(/<p\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/p>/i, card),
    )
    const workplaceType = stripTags(
      extractFirst(/<p\b[^>]*class=["'][^"']*job-workplace[^"']*["'][^>]*>([\s\S]*?)<\/p>/i, card),
    )
    const jobId = extractJobId(sourceUrl)

    if (!title || !location || !sourceUrl || !jobId) return null

    return {
      title,
      location,
      city: extractCity(location),
      country: isIndiaLocation(location) ? 'India' : null,
      workplaceType,
      jobId,
      requisitionId: jobId,
      sourceUrl,
    }
  })
  .filter(Boolean)

export const extractSearchResults = html => extractAllSearchResults(html).filter(job => job.country === 'India')

export const extractJobDetail = (html, listing = {}) => {
  const fields = extractDefinitionFields(html)
  const nativeLocation = fields.get('location') || null
  const nativeRequisitionId = fields.get('job id') || null
  const nativeTitle = stripTags(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html))
  const location = nativeLocation || listing.location || null
  const jobId = nativeRequisitionId || listing.jobId || extractJobId(listing.sourceUrl)

  const detail = {
    title: nativeTitle || listing.title || null,
    location,
    city: extractCity(location) || listing.city || null,
    country: isIndiaLocation(location) ? 'India' : listing.country || null,
    workplaceType: fields.get('workplace') || listing.workplaceType || null,
    jobId,
    requisitionId: jobId || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: toIqviaUrl(
      extractFirst(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i, html),
    ),
    postingDate: fields.get('date posted') || null,
    ...extractDescription(html),
  }
  // Preserve the public helper's enumerable shape while the runtime separately
  // requires fields observed on this own detail, never listing fallbacks.
  Object.defineProperties(detail, {
    nativeTitle: { value: nativeTitle }, nativeLocation: { value: nativeLocation },
    nativeRequisitionId: { value: nativeRequisitionId },
  })
  return detail
}

const defaultFetchText = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify IQVIA scraper)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {
      status: response.status, ...([401, 403, 429].includes(response.status) ? { abortRetries: true } : {}),
    })
  }
  const html = await response.text()
  signal?.throwIfAborted()
  if (/<title[^>]*>\s*(?:Just a moment|Attention Required|Access Denied|Forbidden|Robot Check|Security Verification|Verify you are human)/i.test(html)
    || /(?:cf-chl-|\/cdn-cgi\/challenge-platform|datadome\.co\/captcha|px-captcha|id=["']challenge-form)/i.test(html)) {
    throw Object.assign(new Error('IQVIA public careers access challenge; inventory remains unknown'), { abortRetries: true, failureKind: 'blocked_or_access_denied', softFailure: true })
  }
  return html
}

const toNormalizedJob = (detail) => ({
  title: detail.title,
  company: 'IQVIA',
  department: null,
  location: detail.location,
  city: detail.city,
  country: detail.country,
  workplaceType: detail.workplaceType,
  jobId: detail.jobId,
  requisitionId: detail.requisitionId,
  sourceUrl: detail.sourceUrl,
  applyUrl: detail.applyUrl,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: detail.requiredSkills,
  postingDate: detail.postingDate,
  closingDate: null,
  jobDescription: detail.jobDescription,
  source: 'iqvia',
  link: detail.applyUrl || detail.sourceUrl,
  sourceScopeComplete: false,
  sourceListingComplete: false,
  lifecycleCleanupAllowed: false,
  sourceDetailComplete: true,
  nativeDetailProjection: { ...structuredClone(detail), nativeTitle: detail.nativeTitle,
    nativeLocation: detail.nativeLocation, nativeRequisitionId: detail.nativeRequisitionId },
  sourcePostedDateRaw: detail.postingDate,
  firstEverPostedAt: null,
  scrapedAt: new Date().toISOString(),
})

export const createIqviaScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ maxPages = MAX_NATIVE_PAGES, fetchText: getHtml = fetchText, signal: callerSignal, sourceDeadlineMs = SOURCE_DEADLINE_MS } = {}) {
    callerSignal?.throwIfAborted()
    const totalPages = Number.isSafeInteger(maxPages) ? Math.max(0, Math.min(MAX_NATIVE_PAGES, maxPages)) : MAX_NATIVE_PAGES
    if (totalPages === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: JOBS_URL, firstParty: false,
      listingComplete: false, pagesFetched: 0, reportedTotal: null, indiaFacetCount: null, reason: 'caller-page-cap-zero-no-public-observations' })
    if (!Number.isSafeInteger(sourceDeadlineMs) || sourceDeadlineMs < 1) throw coverageError('IQVIA source deadline must be a positive finite duration')
    const deadline = new AbortController()
    const signal = callerSignal ? AbortSignal.any([callerSignal, deadline.signal]) : deadline.signal
    const timer = setTimeout(() => deadline.abort(Object.assign(coverageError('IQVIA source deadline exhausted'), { name: 'TimeoutError' })), Math.min(sourceDeadlineMs, SOURCE_DEADLINE_MS))
    timer.unref?.()
    let requests = 0, pagesFetched = 0
    const read = async url => {
      signal.throwIfAborted()
      if (requests >= MAX_PUBLIC_READS) throw coverageError('IQVIA native public-read-budget exhausted; inventory incomplete')
      requests++
      const html = await getHtml(url, { signal })
      signal.throwIfAborted()
      pagesFetched++
      return html
    }
    const enumerate = async () => {
      const rows = [], pages = [], seen = new Set(); let total = null
      for (let page = 1; page <= totalPages; page++) {
        const url = buildListingUrl(page), html = await read(url)
        const listings = extractAllSearchResults(html), pageTotal = extractResultCount(html)
        if (total === null) total = pageTotal
        if (pageTotal !== null && total !== pageTotal) throw coverageError('IQVIA native result total changed during pagination')
        pages.push({ url, pageTotal, rows: listings })
        if (!listings.length) {
          if (total !== null && seen.size < total) throw coverageError('IQVIA native listing is incomplete')
          break
        }
        for (const listing of listings) {
          if (seen.has(listing.jobId)) throw coverageError('IQVIA native pagination repeated a posting')
          seen.add(listing.jobId); rows.push(listing)
          if (total !== null && seen.size > total) throw coverageError('IQVIA native listing exceeds its advertised total')
        }
        if (total === null || seen.size === total) break
      }
      return { rows, pages, total }
    }
    const qualified = (detail, listing) => {
      if (detail.nativeRequisitionId !== listing.jobId || detail.nativeTitle !== listing.title) throw coverageError('IQVIA native listing and detail requisition/title identity disagree')
      if (!detail.sourceUrl || !isIndiaLocation(detail.nativeLocation)) return false
      if (!detail.jobDescription) throw coverageError('IQVIA full native description and criteria are unavailable')
      return true
    }
    try {
      const opening = await enumerate(), retained = []
      for (const listing of opening.rows) {
        signal.throwIfAborted()
        if (listing.country !== 'India') continue
        const detail = extractJobDetail(await read(listing.sourceUrl), listing)
        if (qualified(detail, listing)) retained.push({ listing, detail })
      }
      for (const { listing, detail } of retained) {
        const closing = extractJobDetail(await read(listing.sourceUrl), listing)
        if (!qualified(closing, listing) || JSON.stringify(detail) !== JSON.stringify(closing)) throw coverageError('IQVIA closing native detail identity, country, date or full criteria changed')
      }
      const closing = await enumerate()
      if (JSON.stringify(opening.pages) !== JSON.stringify(closing.pages)) throw coverageError('IQVIA closing native listing identities or counts changed')
      signal.throwIfAborted()
      const jobs = retained.map(row => toNormalizedJob(row.detail))
      Object.defineProperty(jobs, Symbol.for('jobverify.iqvia.native-inventory-observations'), { value: {
        nativeListingCount: opening.rows.length, nativeReportedGroupTotal: opening.total, visitedListingPages: opening.pages.length,
        publicReads: requests, maxPublicReads: MAX_PUBLIC_READS, sourceDeadlineMs: Math.min(sourceDeadlineMs, SOURCE_DEADLINE_MS),
        boundedAtNativePages: totalPages, listingIdentityReconciled: true, retainedOwnDetailsReconciled: true,
        retainedIndiaJobs: jobs.length, completeCompanyInventory: false, completeWorksiteCountryInventory: false,
      } })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: JOBS_URL, firstParty: true,
      listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: new Date().toISOString(), reason: 'bounded-current-native-listing-and-full-own-details-reconciled;whole-company-recruitment-and-worksite-country-scope-unverified' })
    } finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createIqviaScraper().run(options)
