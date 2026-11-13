import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals, fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { NATIVE_API_URL, check, checkCohort, isCohortDrift, digest, norm, ownCountries, readCorporateInventory, reconcileNativeInventory, reviewDescription } from './native.js'
import SENTRY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const CURRENT_CAREERS_URL = 'https://sentry.io/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = SENTRY_CATALOG.source
export const COMPANY = SENTRY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SENTRY_CATALOG.officialBrandName
export const VERIFIED_ON = SENTRY_CATALOG.verifiedOn
export const PROVIDER_METADATA = SENTRY_CATALOG
export const CAREERS_PAGE_URL = SENTRY_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*careers\s*\|\s*sentry\s*<\/title>/i.test(page)
    && normalized.includes('work at sentry')
    && normalized.includes('browse our openings')
    && normalized.includes('open positions across')
    && normalized.includes('all offices')
    && normalized.includes('all teams')
    && /id=["']openings-list["']/i.test(page)
    && /href=["'][^"']*\/careers\/[0-9a-f-]{36}\/?["']/i.test(page)
}

export const extractRoleSummaries = (html = '') => {
  const roles = []

  for (const match of String(html ?? '').matchAll(
    /<a[^>]*href=["']([^"']*\/careers\/[0-9a-f-]{36}\/?)["'][^>]*class=["'][^"']*_jobLink_[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*_jobTitle_[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class=["'][^"']*_jobLocation_[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/a>/gi,
  )) {
    const url = toAbsoluteUrl(match[1])
    const title = normalizeWhitespace(match[2])
    const location = normalizeWhitespace(match[3])

    if (!url || !title || !location) continue

    roles.push({
      title,
      location,
      label: `${title} ${location}`,
      url,
    })
  }

  return [...new Map(roles.map((role) => [role.url, role])).values()]
}

const hasIndiaRole = (roles = []) =>
  roles.some((role) => /\bindia\b/i.test(String(role.label ?? '')))

const allRolesStayOnFirstPartyDomain = (roles = []) =>
  roles.every((role) => {
    try {
      return new URL(role.url).hostname === 'sentry.io'
    } catch {
      return false
    }
  })

export const createSentryScraper = ({ fetchImpl = globalThis.fetch } = {}) => ({
  async run({
    signal, maxJobs = null, totalBudgetMs = 90000, requestTimeoutMs = 20000,
  } = {}) {
    signal?.throwIfAborted()
    check(Number.isFinite(totalBudgetMs) && totalBudgetMs > 0 && Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0, 'request budget must be finite and positive')
    const bounded = composeAbortSignals(signal, AbortSignal.timeout(totalBudgetMs)), deadline = Date.now() + totalBudgetMs
    const receipts = [], discardedCohorts = []
    let cohortAttempt = 0
    const request = async (url, json = false) => {
      signal?.throwIfAborted(); bounded.throwIfAborted()
      const result = await (json ? fetchJsonWithRetry : fetchTextWithRetry)(url, { fetchImpl, signal: bounded, timeoutMs: Math.max(1, Math.min(requestTimeoutMs, deadline - Date.now())), attempts: 1,
        includeResponseMetadata: true, headers: { 'User-Agent': USER_AGENT, Accept: json ? 'application/json' : 'text/html,application/xhtml+xml',
          ...(cohortAttempt > 1 ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}) }, label: SOURCE })
      signal?.throwIfAborted(); bounded.throwIfAborted()
      check(result.status === 200 && result.url === url, 'public response redirected away from the exact employer identity')
      const body = json ? result.payload : result.html
      receipts.push({ url, finalUrl: result.url, status: result.status, observedAt: new Date().toISOString(), parsedBodySHA256: digest(body), cohortAttempt })
      return body
    }
    const acquireCohort = async () => {
      const corporate = readCorporateInventory(await request(CURRENT_CAREERS_URL))
      const payload = await request(NATIVE_API_URL, true)
      let drift = null
      const reconcile = (owner, native) => {
        try { return reconcileNativeInventory(owner, native) } catch (error) {
          if (!isCohortDrift(error)) throw error
          drift ||= error
          return null
        }
      }
      const reconciliation = reconcile(corporate, payload)
      const inner = await createPublishingGapAtsScraper({ source: SOURCE, companyName: COMPANY, atsPlatform: 'ashby', boardToken: 'sentry', companyCareerPage: CAREERS_PAGE_URL, sourceScopeComplete: false })
        .run({ signal: bounded, fetchJson: async url => { check(url === NATIVE_API_URL, 'unexpected native endpoint'); return payload } })
      const evidence = readInventoryEvidence(inner)
      const closingPayload = await request(NATIVE_API_URL, true), closingCorporate = readCorporateInventory(await request(CURRENT_CAREERS_URL))
      reconcile(closingCorporate, closingPayload)
      if (drift) throw drift
      checkCohort(digest(payload) === digest(closingPayload) && digest(corporate.props) === digest(closingCorporate.props), 'closing corporate/native full inventory, criteria, geography or publication changed')
      return { corporate, payload, reconciliation, inner, evidence, closingPayload, closingCorporate }
    }
    let cohort
    for (cohortAttempt = 1; cohortAttempt <= 2; cohortAttempt++) {
      const receiptStart = receipts.length
      try { cohort = await acquireCohort(); break } catch (error) {
        signal?.throwIfAborted(); bounded.throwIfAborted()
        if (cohortAttempt === 2 || !isCohortDrift(error)) throw error
        discardedCohorts.push({ attempt: cohortAttempt, reason: error.message, receipts: receipts.slice(receiptStart) })
      }
    }
    const { corporate, payload, inner, evidence, closingPayload, closingCorporate } = cohort
    const { records, ...reconciliation } = cohort.reconciliation
    const nativeById = new Map(records.map(record => [record.id, record]))
    const unresolvedCountryRoleIds = records.filter(record => !ownCountries(record).known).map(record => record.id)
    const observations = { ...reconciliation,
      unresolvedCountryRoleIds, closingInventoryAndCriteriaMatch: true, nativeRecords: records, hydratedProps: corporate.props,
      nativePropsRaw: corporate.nativePropsRaw, componentUrl: corporate.componentUrl, receipts, cohortAttempts: cohortAttempt, discardedCohorts, sourceScopeComplete: false }
    const nativeCollectionEvidence = structuredClone({
      source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: records.length, observedVacancyCount: records.length,
      ...reconciliation,
      nativeRecords: records, opening: { corporate, payload }, closing: { corporate: closingCorporate, payload: closingPayload },
      unresolvedCountryRoleIds, receipts, cohortAttempts: cohortAttempt, discardedCohorts, closingInventoryAndCriteriaMatch: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    })
    const selected = inner.filter(job => { const country = ownCountries(nativeById.get(job.jobId)); return corporate.rows.has(job.jobId) && country.known && country.india })
    const capped = Number.isSafeInteger(maxJobs) && maxJobs > 0 ? selected.slice(0, maxJobs) : selected
    const jobs = capped.map(job => {
      const native = nativeById.get(job.jobId), row = corporate.rows.get(job.jobId), description = reviewDescription(job.sourceDescription)
      const postingDate = native.publishedAt == null ? null : new Date(native.publishedAt).toISOString()
      return { ...job, source: SOURCE, company: COMPANY, country: 'India', postingDate, sourcePostingDate: postingDate,
        sourceDateEvidence: postingDate ? 'ashby-native-published-at' : null, sourceNativeDates: { publishedAt: native.publishedAt ?? null },
        compensationRange: norm(row.info.compensationTierSummary) || null, workplaceType: norm(row.info.workplaceType) || null,
        jobDescription: description, sourceDescription: description, sourceDetailComplete: !!description,
        sourceNativeListingRecord: native, sourceNativeCorporateRole: row, sourceNativeInventory: observations,
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
    })
    signal?.throwIfAborted(); bounded.throwIfAborted()
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: records.length, observedVacancyCount: records.length, sourceScopeComplete: false })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: nativeCollectionEvidence, configurable: true })
    return attachInventoryEvidence(jobs, { ...evidence, status: 'discovery-only', listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: receipts.length / 2,
      reportedTotal: records.length, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: `${evidence.reason};active-corporate-hydration-and-Ashby-role-binding;closing-full-native-inventory-match;whole-source-scope-unproved${!reconciliation.corporateNativeCountAgreement ? ';corporate-native-count-disagreement' : ''}${!reconciliation.corporateNativeInventoryAgreement ? ';corporate-native-inventory-disagreement' : ''}${unresolvedCountryRoleIds.length ? ';unresolved-own-native-country' : ''}` })
  },
})

export const run = async (options = {}) => createSentryScraper(options).run(options)

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
