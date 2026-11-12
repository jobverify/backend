import { disposeResponseBody } from '../../scraper-support/shared/responseBodyDisposal.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { extractCity } from '../../scraper-support/myworkday/engine.js'
import { extractWorkdayDetailLocations } from '../../scraper-support/myworkday/locationDetails.js'
import { EVEREST_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { explicitWorkdayCountryScope } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EVEREST_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_OVERVIEW_URL = PROVIDER_METADATA.careerOverviewUrl
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const SAMPLE_JOB_DETAIL_URL = PROVIDER_METADATA.sampleJobDetailUrl

const PAGE_SIZE = 20
const MAX_NATIVE_PAGES = 10
const MAX_PUBLIC_READS = 512
const SOURCE_DEADLINE_MS = 60000
const coverageError = message => Object.assign(new Error(message), {
  abortRetries: true, softFailure: true, failureKind: 'coverage_gap', upstreamOutage: false, lifecycleCleanupAllowed: false,
})
const nativeDatePrecision = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? 'calendar-date'
  : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value)) ? 'instant' : null
const nativeClosed = (date, precision, observedAt) => date != null && (precision === 'instant'
  ? Date.parse(date) <= Date.parse(observedAt) : date < observedAt.slice(0, 10))
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_LOCATION_PATTERN =
  /\b(?:india|bengaluru|bangalore|gurgaon|gurugram|mumbai|pune|hyderabad|chennai|noida|new delhi|delhi|kolkata|ahmedabad)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const extractLinks = (html = '') => (
  [...String(html ?? '').matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
)

const startOfTodayIst = () => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const nowIst = new Date(Date.now() + istOffsetMs)
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()))
}

const toUtcMidnight = (dateStr) => {
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()))
}

const parsePostedOn = (raw) => {
  if (!raw) return null

  const text = String(raw).trim().toLowerCase()
  const today = startOfTodayIst()
  const daysAgo = (days) => {
    const value = new Date(today)
    value.setUTCDate(value.getUTCDate() - days)
    return value
  }

  if (/\btoday\b/.test(text)) return daysAgo(0)
  if (/\byesterday\b/.test(text)) return daysAgo(1)

  const relativeMatch = text.match(/(\d+)\s+days?\s+ago/)
  if (relativeMatch) {
    return daysAgo(Number.parseInt(relativeMatch[1], 10))
  }

  if (/30\+/.test(text)) return daysAgo(30)

  return toUtcMidnight(String(raw).replace(/^posted\s+/i, '').trim())
}

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url, body, { signal, disposalSignal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://wd5.myworkdaysite.com',
      referer: WORKDAY_BOARD_URL,
      'user-agent': USER_AGENT,
    },
    body,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    await disposeResponseBody(response, { signal: disposalSignal, bestEffort: true })
    throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {
      status: response.status, ...([401, 403, 429].includes(response.status) ? { abortRetries: true } : {}),
    })
  }

  return response.json()
}

export const hasOfficialHomepageSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 200
    && extractTitle(rawHtml) === 'Welcome to Everest | Everest'
    && /https:\/\/www\.everestglobal\.com\/us-en/i.test(String(page?.url ?? ''))
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.everestglobal\.com\/us-en["']/i.test(rawHtml)
    && normalized.includes('We underwrite opportunity.')
    && rawHtml.includes('/us-en/career-opportunities')
    && rawHtml.includes('/us-en/about-us')
}

export const hasOfficialCareersSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hasLegacyHero = /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(rawHtml)
  const hasCurrentHero = normalized.includes('Your opportunity starts here')
  const hasTrustedCopy = normalized.includes('Ready to take your next step?')
    || normalized.includes('Where could your career take you?')

  return Number(page?.status) === 200
    && extractTitle(rawHtml) === 'Careers | Everest'
    && String(page?.url ?? '') === CAREERS_OVERVIEW_URL
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.everestglobal\.com\/us-en\/career-opportunities\/overview["']/i.test(rawHtml)
    && (hasLegacyHero || hasCurrentHero)
    && hasTrustedCopy
    && /(Search Jobs|View Job Openings)/i.test(normalized)
}

const isVerifiedWorkdayBoardUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://wd5.myworkdaysite.com'
      && url.pathname === '/recruiting/everestre/careers'
  } catch {
    return false
  }
}

export const extractVerifiedWorkdayBoardUrl = (html = '') => {
  for (const link of extractLinks(html)) {
    if (isVerifiedWorkdayBoardUrl(link)) {
      return new URL(link).toString()
    }
  }

  return null
}

export const hasOfficialWorkdayBoardSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')

  return Number(page?.status) === 200
    && String(page?.url ?? '') === WORKDAY_BOARD_URL
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Careers["']/i.test(rawHtml)
    && rawHtml.includes('https://wd5.myworkdaysite.com/recruiting/everestre/careers')
    && rawHtml.includes('tenant: "everestre"')
    && /Beware of recruitment fraud/i.test(rawHtml)
    && /EVEREST is a leading international reinsurance and insurance group/i.test(rawHtml)
}

export const isIndiaLocation = (value = '') => INDIA_LOCATION_PATTERN.test(String(value ?? ''))

export const isGroupedLocationLabel = (value = '') => /^\d+\s+Locations?$/i.test(String(value ?? '').trim())

export const buildJobsRequestBody = ({
  offset = 0,
  limit = PAGE_SIZE,
  searchText = '',
} = {}) => JSON.stringify({
  appliedFacets: {},
  limit,
  offset,
  searchText,
})

export const buildJobDetailUrl = (externalPath = '') => {
  if (!externalPath) return null
  return externalPath.startsWith('/')
    ? `${WORKDAY_BOARD_URL}${externalPath}`
    : new URL(externalPath, `${WORKDAY_BOARD_URL}/`).toString()
}

const extractJobId = (posting = {}) => {
  const requisition = Array.isArray(posting?.bulletFields)
    ? posting.bulletFields.find((value) => /^R\d+(?:-\d+)?$/i.test(String(value)))
    : null

  if (requisition) return requisition

  const match = String(posting?.externalPath ?? '').match(/_(R\d+(?:-\d+)?)(?:\/)?$/i)
  return match?.[1] ?? null
}

const selectPrimaryLocation = (summaryLocation, detailLocations = []) =>
  detailLocations.find((value) => isIndiaLocation(value)) || summaryLocation

const hasValidJobsPayload = (payload) =>
  payload != null
  && Number.isSafeInteger(payload.total) && payload.total >= 0
  && Array.isArray(payload.jobPostings)
  && payload.jobPostings.length <= PAGE_SIZE

const extractDetailPayload = async (jobUrl, fetchPage, expectedRequisition) => {
  const page = await fetchPage(jobUrl)
  if (Number(page?.status) !== 200 || page.url !== jobUrl) {
    throw new Error(`HTTP ${page?.status} for ${jobUrl}`)
  }

  const html = String(page?.html ?? '')
  const detail = await extractJobDetail({ provider: 'workday', html })
  const models = [], document = readNativeDocument(html)
  const visit = model => {
    if (Array.isArray(model)) return model.forEach(visit)
    if (!model || typeof model !== 'object') return
    if (model['@type'] === 'JobPosting' || Array.isArray(model['@type']) && model['@type'].includes('JobPosting')) models.push(model)
    if (model['@graph']) visit(model['@graph'])
  }
  for (const node of document.nodes(node => node.tag === 'script' && node.attrs.type?.toLowerCase() === 'application/ld+json')) {
    try { visit(JSON.parse(node.raw || '')) }
    catch { if (/JobPosting/.test(node.raw || '')) throw coverageError('Everest native detail JobPosting model is malformed') }
  }
  const matching = models.filter(model => (typeof model.identifier === 'string' ? model.identifier : model.identifier?.value) === expectedRequisition)
  const model = matching.length === 1 ? matching[0] : null
  const visible = readVisibleNativeDocument(html, { strict: true })
  const sections = visible.nodes(node => node.attrs['data-automation-id'] === 'jobPostingDescription')
  if (sections.length > 1) throw coverageError('Everest full native criteria section is ambiguous')
  const visibleCriteria = sections.length ? visible.text(sections[0]) : null
  const sourceDescription = visibleCriteria || (typeof model?.description === 'string' ? model.description : null)
  const payload = {
    locations: extractWorkdayDetailLocations(html),
    ...detail, jobDescription: extractActiveDescription(sourceDescription), sourceDescription,
    nativeSourceRecord: model == null ? null : structuredClone(model),
    nativeModelIdentityValid: models.length === 0 || matching.length === 1,
    nativeCriteriaSource: visibleCriteria ? 'active-jobPostingDescription' : model ? 'native-JobPosting-description' : null,
  }
  Object.defineProperty(payload, 'nativeDetailBody', { value: html })
  return payload
}

export const createEverestScraper = ({
  maxPages = MAX_NATIVE_PAGES,
} = {}) => ({
  async run(options = {}) {
    const callerSignal = options.signal
    callerSignal?.throwIfAborted()
    const requestedPages = options.maxPages ?? maxPages
    const pageCap = Number.isSafeInteger(requestedPages) ? Math.max(0, Math.min(MAX_NATIVE_PAGES, requestedPages)) : MAX_NATIVE_PAGES
    if (pageCap === 0) return attachInventoryEvidence([], { status: 'coverage-gap', surface: WORKDAY_BOARD_URL, firstParty: false,
      listingComplete: false, pagesFetched: 0, reportedTotal: null, indiaFacetCount: null, reason: 'caller-page-cap-zero-no-public-observations' })
    const requestedDeadline = options.sourceDeadlineMs ?? SOURCE_DEADLINE_MS
    if (!Number.isSafeInteger(requestedDeadline) || requestedDeadline < 1) throw coverageError('Everest source deadline must be a positive finite duration')
    const deadline = new AbortController()
    const signal = callerSignal ? AbortSignal.any([callerSignal, deadline.signal]) : deadline.signal
    const timer = setTimeout(() => deadline.abort(Object.assign(coverageError('Everest source deadline exhausted'), { name: 'TimeoutError' })), Math.min(requestedDeadline, SOURCE_DEADLINE_MS))
    timer.unref?.()
    const currentNow = () => {
      const value = options.now ? options.now() : new Date().toISOString()
      if (!Number.isFinite(new Date(value).getTime())) throw coverageError('Everest invalid native observation clock')
      return new Date(value).toISOString()
    }
    let pagesFetched = 0, requests = 0
    const beforeRead = () => {
      signal.throwIfAborted()
      if (requests >= MAX_PUBLIC_READS) throw coverageError('Everest native public-read-budget exhausted; inventory incomplete')
      requests++
    }
    const fetchPage = async url => {
      beforeRead()
      const page = await (options.fetchPage || defaultFetchPage)(url, { signal })
      signal?.throwIfAborted(); pagesFetched++
      if ([401, 403, 429].includes(Number(page?.status))) throw Object.assign(new Error(`HTTP ${page.status} for ${url}`), { abortRetries: true, status: Number(page.status) })
      if (/<title[^>]*>\s*(?:Just a moment|Attention Required|Access Denied|Forbidden|Robot Check|Security Verification|Verify you are human)/i.test(String(page?.html || ''))
        || /(?:cf-chl-|\/cdn-cgi\/challenge-platform|datadome\.co\/captcha|px-captcha|id=["']challenge-form)/i.test(String(page?.html || ''))) {
        throw Object.assign(new Error('Everest public careers access challenge; inventory remains unknown'), { abortRetries: true, failureKind: 'blocked_or_access_denied', softFailure: true })
      }
      return page
    }
    const fetchJson = async (url, body) => {
      beforeRead()
      const payload = await (options.fetchJson || defaultFetchJson)(url, body, options.fetchJson ? { signal } : { signal, disposalSignal: callerSignal })
      signal?.throwIfAborted(); pagesFetched++
      return payload
    }

    try {
    currentNow()
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepage)) {
      throw new Error('Everest official homepage changed materially')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersPage)) {
      throw new Error('Everest official careers page changed materially')
    }

    const verifiedBoardUrl = extractVerifiedWorkdayBoardUrl(careersPage.html)
    if (verifiedBoardUrl !== WORKDAY_BOARD_URL) {
      throw new Error('Everest verified Workday handoff changed materially')
    }

    const workdayBoardPage = await fetchPage(WORKDAY_BOARD_URL)
    if (hasWorkdayOutageSignal(workdayBoardPage)) {
      throw new WorkdayUpstreamOutageError(`[${SOURCE}] Workday is currently unavailable upstream at ${WORKDAY_BOARD_URL}`)
    }
    if (workdayBoardPage.status !== 200) {
      throw new Error(`HTTP ${workdayBoardPage.status} for ${WORKDAY_BOARD_URL}`)
    }
    if (!hasOfficialWorkdayBoardSignal(workdayBoardPage)) {
      throw new Error('Everest official Workday board changed materially')
    }

    const enumerate = async () => {
      const postings = [], seenPaths = new Set()
      let total = null
      for (let pageNumber = 1; pageNumber <= pageCap; pageNumber++) {
        const payload = await fetchJson(JOBS_API_URL, buildJobsRequestBody({ offset: postings.length }))
        if (!hasValidJobsPayload(payload)) throw new Error('Everest Workday jobs api payload changed materially')
        if (total === null) total = payload.total
        // Workday's public continuation pages use total:0 while still returning
        // postings. The opening page's total remains the inventory boundary.
        if (payload.total !== 0 && payload.total !== total) throw new Error('Everest native total changed during pagination')
        if (!payload.jobPostings.length && postings.length < total) throw new Error('Everest native listing exhausted before its advertised total; incomplete inventory')
        for (const posting of payload.jobPostings) {
          if (typeof posting?.title !== 'string' || !posting.title.trim()
            || typeof posting.externalPath !== 'string' || !/^\/job\/[^?#]+$/.test(posting.externalPath)) throw new Error('Everest native posting identity changed')
          if (seenPaths.has(posting.externalPath)) throw new Error('Everest native listing contains duplicate postings')
          seenPaths.add(posting.externalPath); postings.push(posting)
        }
        if (postings.length > total) throw new Error('Everest native listing exceeds its advertised total')
        if (postings.length === total) return postings
      }
      throw coverageError('Everest native listing page cap left an incomplete inventory')
    }
    const opening = await enumerate()
    const jobs = [], retainedDetails = [], heldNativeRoles = []
    for (const posting of opening) {
        signal?.throwIfAborted()
        const summaryLocation = String(posting?.locationsText ?? '').trim() || 'Unknown'
        const isDirectIndia = isIndiaLocation(summaryLocation)
        const needsGroupedCheck = isGroupedLocationLabel(summaryLocation)

        if (!isDirectIndia && !needsGroupedCheck) {
          continue
        }

        const link = buildJobDetailUrl(posting?.externalPath)
        if (!link) throw new Error('Everest native detail URL unavailable')
        const jobId = extractJobId(posting)
        const detailPayload = await extractDetailPayload(link, fetchPage, jobId)

        if (!detailPayload.locations.some(value => explicitWorkdayCountryScope(value) === 'india')) {
          continue
        }

        if (!jobId || detailPayload.requisitionId !== jobId || !detailPayload.nativeModelIdentityValid) throw coverageError('Everest native detail and listing requisition identity disagree')
        const criteria = String(detailPayload.jobDescription || '').trim()
        if (!criteria || normalizeWhitespace(criteria) === normalizeWhitespace(posting.title)
          || normalizeWhitespace(criteria).toLowerCase() === ('Title: ' + normalizeWhitespace(posting.title)).toLowerCase()) throw coverageError('Everest full native description and criteria are unavailable')
        if (detailPayload.nativeSourceRecord?.title && normalizeWhitespace(detailPayload.nativeSourceRecord.title) !== normalizeWhitespace(posting.title)) throw coverageError('Everest native detail and listing title identity disagree')
        const rawClosingDate = detailPayload.nativeSourceRecord?.validThrough ?? null
        const closingPrecision = nativeDatePrecision(rawClosingDate)
        if (rawClosingDate != null && (!closingPrecision || nativeClosed(rawClosingDate, closingPrecision, currentNow()))) {
          heldNativeRoles.push({ sourceUrl: link, jobId, reason: closingPrecision ? 'native-role-known-closed' : 'native-closing-date-unverified',
            nativeSourceRecord: structuredClone(detailPayload.nativeSourceRecord), nativeDetailBody: detailPayload.nativeDetailBody,
            detailBodySha256: createHash('sha256').update(detailPayload.nativeDetailBody).digest('hex'), sourceClosingDateRaw: rawClosingDate })
          continue
        }
        retainedDetails.push({ link, jobId, detailPayload })
        const location = selectPrimaryLocation(summaryLocation, detailPayload.locations)
        const rawPostedDate = detailPayload.nativeSourceRecord?.datePosted || detailPayload.postingDate || null
        const datePrecision = nativeDatePrecision(rawPostedDate)

        jobs.push({
          jobId,
          title: posting.title,
          company: COMPANY,
          department: detailPayload.department,
          location,
          city: extractCity(location),
          locations: detailPayload.locations,
          link,
          source: SOURCE,
          country: 'India',
          sourceScopeComplete: false,
          sourceListingComplete: false,
          lifecycleCleanupAllowed: false,
          postedAt: datePrecision ? rawPostedDate : null,
          postingDate: datePrecision ? rawPostedDate : null,
          postingDatePrecision: datePrecision,
          sourcePostedDateRaw: rawPostedDate,
          firstEverPostedAt: null,
          closingDate: rawClosingDate,
          closingDatePrecision: closingPrecision,
          sourceClosingDateIsExact: closingPrecision === 'instant',
          jobDescription: detailPayload.jobDescription,
          sourceDescription: detailPayload.sourceDescription,
          nativeSourceRecord: detailPayload.nativeSourceRecord,
          nativeCriteriaSource: detailPayload.nativeCriteriaSource,
          sourceDetailComplete: true,
          minimumQualification: detailPayload.minimumQualification,
          preferredQualification: detailPayload.preferredQualification,
          requiredSkills: detailPayload.requiredSkills,
          experienceRequired: detailPayload.experienceRequired,
          requisitionId: detailPayload.requisitionId,
          scrapedAt: new Date().toISOString(),
        })
    }
    for (const { link, jobId, detailPayload } of retainedDetails) {
      const closing = await extractDetailPayload(link, fetchPage, jobId)
      if (JSON.stringify(detailPayload) !== JSON.stringify(closing)) throw coverageError('Everest closing native detail identity, country, dates or full criteria changed')
    }
    const closing = await enumerate()
    const signature = postings => JSON.stringify(postings.map(row => [row.externalPath, row.title, row.bulletFields || [], row.locationsText || null]).sort((a,b) => a[0].localeCompare(b[0])))
    if (signature(opening) !== signature(closing)) throw new Error('Everest closing native inventory changed')
    const closingCareers = await fetchPage(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(closingCareers) || extractVerifiedWorkdayBoardUrl(closingCareers.html) !== WORKDAY_BOARD_URL) throw new Error('Everest closing corporate Workday handoff changed')
    const observedAt = currentNow()
    if (jobs.some(job => nativeClosed(job.closingDate, job.closingDatePrecision, observedAt))) throw coverageError('Everest closing native role expiry elapsed during reconciliation')
    for (const job of jobs) job.scrapedAt = observedAt
    signal?.throwIfAborted()
    Object.defineProperty(jobs, Symbol.for('jobverify.everest.native-inventory-observations'), { value: {
      nativeListingCount: opening.length, closingListingCount: closing.length, listingIdentityReconciled: true,
      retainedIndiaJobs: jobs.length, completeWorksiteCountryInventory: false, completeCompanyInventory: false,
      retainedOwnDetailsReconciled: true, publicReads: requests, maxPublicReads: MAX_PUBLIC_READS,
      sourceDeadlineMs: Math.min(requestedDeadline, SOURCE_DEADLINE_MS), boundedAtNativePages: pageCap,
      heldNativeRoles,
    } })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: WORKDAY_BOARD_URL, firstParty: true,
      listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: 'current-corporate-handoff-and-native-listing-reconciled;complete-worksite-country-and-whole-company-recruitment-scope-unverified' })
    } finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createEverestScraper().run(options)

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
