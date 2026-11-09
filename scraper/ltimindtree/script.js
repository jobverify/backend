import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { createRipplehireInventoryScraper } from '../altimetrik/ripplehireInventory.js'

import {
  extractSearchSummary,
  extractJobDetail as parseRipplehireDetail,
} from '../altimetrik/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ltimindtree'
export const COMPANY = 'LTIMindtree'
const BASE_URL = 'https://ltimindtree.ripplehire.com'
const TOKEN = 'xviyQvbnyYZdGtozXoNm'
const CAREER_SOURCE = 'CAREERSITE'
const DEFAULT_PAGE_SIZE = 10
const DEFAULT_DETAIL_CONCURRENCY = 6

// The India link on https://www.ltm.com/careers supplies this token and geo filter.
export const buildIndiaSearchUrl = () => `${BASE_URL}/candidate/?token=${TOKEN}&lang=en&source=${CAREER_SOURCE}#list/geo=India`
export const buildSearchRequestPayload = (page = 0, pageSize = DEFAULT_PAGE_SIZE) => ({
  page,
  search: '*:*',
  token: TOKEN,
  source: CAREER_SOURCE,
  pagesize: pageSize,
  geo: 'India',
})
export const buildDetailUrl = (jobSeq) =>
  `${BASE_URL}/candidate/?token=${TOKEN}&source=${CAREER_SOURCE}#detail/job/${encodeURIComponent(jobSeq)}`
export const buildApplyUrl = (jobSeq) =>
  `${BASE_URL}/candidate/?token=${TOKEN}&source=${CAREER_SOURCE}#apply/job/${encodeURIComponent(jobSeq)}`

const searchUrl = `${BASE_URL}/candidate/candidatejobsearch`
const detailUrl = (jobSeq) => {
  const params = new URLSearchParams({ token: TOKEN, jobSeq, source: CAREER_SOURCE, lang: 'en' })
  return `${BASE_URL}/candidate/candidatejobdetail?${params}`
}

const checkSignal = signal => { if (signal?.aborted) throw signal.reason }

// A caller can stop even an injected transport/body reader which ignores signal.
// Its late result is observed but cannot resume the collector or queue more work.
const readWithSignal = (read, signal, cancel) => new Promise((resolve, reject) => {
  let finished = false
  const finish = (callback, value) => {
    if (finished) return
    finished = true
    signal?.removeEventListener('abort', aborted)
    callback(value)
  }
  const aborted = () => {
    try { Promise.resolve(cancel?.()).catch(() => {}) } catch {}
    finish(reject, signal.reason)
  }
  if (signal?.aborted) { aborted(); return }
  signal?.addEventListener('abort', aborted, { once: true })
  Promise.resolve().then(() => { checkSignal(signal); return read() }).then(
    value => signal?.aborted ? aborted() : finish(resolve, value),
    error => signal?.aborted ? aborted() : finish(reject, error),
  )
})

const nativeValue = (tag, xml) => {
  const matches = [...String(xml).matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
  if (matches.length > 1) throw new Error(`LTIMindtree duplicate native ${tag}`)
  return matches[0]?.[1]?.trim() || null
}
const textValue = value => value?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/\s+/g, ' ').trim() || null
const workplace = value => !value || /^select location$/i.test(value) ? null : value

const parseIndiaPage = (xml, page, pageSize, expectedTotal) => {
  if (typeof xml !== 'string' || !/^\s*(?:<\?xml[^>]*\?>\s*)?<JobPageVO>[\s\S]*<\/JobPageVO>\s*$/.test(xml)) {
    throw new Error('LTIMindtree invalid India listing response')
  }
  const summary = extractSearchSummary(xml)
  for (const tag of ['totalJobCount', 'startJobIndex', 'maxJobSize']) {
    if (!/^\d+$/.test(nativeValue(tag, xml) || '')) throw new Error('LTIMindtree incomplete India listing summary')
  }
  const total = summary.totalJobCount
  if (!Number.isInteger(total) || total < 0 || summary.startJobIndex !== page * pageSize
    || summary.pageSize !== pageSize || (expectedTotal != null && total !== expectedTotal)) {
    throw new Error('LTIMindtree incomplete or changed India listing count')
  }
  const blocks = [...xml.matchAll(/<jobVoList>\s*<jobSeq>[\s\S]*?<\/jobVoList>/gi)].map(match => match[0])
  const expectedPageCount = Math.min(pageSize, total - page * pageSize)
  if (blocks.length !== expectedPageCount || expectedPageCount < 0) {
    throw new Error('LTIMindtree incomplete India listing page')
  }
  const listings = blocks.map(block => {
    const jobId = nativeValue('jobSeq', block)
    const title = textValue(nativeValue('jobTitle', block))
    if (!jobId || !/^\d+$/.test(jobId) || !title) throw new Error('LTIMindtree incomplete native listing identity')
    const rawCountry = textValue(nativeValue('jobLocation', block))
    const rawWorkplace = textValue(nativeValue('locations', block))
    // This typed country belongs to this role. A query, employer label or another
    // role's city is not a country relation for a blank native field.
    const country = /^India$/i.test(rawCountry || '') ? 'India' : null
    const city = workplace(rawWorkplace)
    return { jobId, title, rawCountry, rawWorkplace, country, city,
      location: city ? (country ? `${city}, India` : city) : country,
      requisitionId: textValue(nativeValue('jobId', block)) || jobId,
      experienceRequired: textValue(nativeValue('jobReqExp', block)),
      postingDate: textValue(nativeValue('jobPostingDate', block)), department: null,
      sourceUrl: buildDetailUrl(jobId), applyUrl: buildApplyUrl(jobId) }
  })
  if (new Set(listings.map(job => job.jobId)).size !== listings.length) {
    throw new Error('LTIMindtree incomplete or duplicate listing page')
  }
  return { total, listings }
}

const createLegacyXmlScraper = () => ({
  async run({ fetchText, pageSize = DEFAULT_PAGE_SIZE, detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
    maxPages = Infinity, maxJobs = Infinity, requestTimeoutMs = 20000, signal } = {}) {
    checkSignal(signal)
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid LTIMindtree page size')
    if (!Number.isInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 10) {
      throw new Error('Invalid LTIMindtree detail concurrency')
    }

    const stopped = new AbortController()
    const activeSignal = signal ? AbortSignal.any([signal, stopped.signal]) : stopped.signal
    let pagesFetched = 0
    // Reconciliation qualifies this configured query only. The current evidence
    // does not establish all employer hiring surfaces or authorize source cleanup.
    const evidence = reason => ({
      status: 'coverage-gap',
      surface: buildIndiaSearchUrl(), firstParty: true, listingComplete: false,
      pagesFetched, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: new Date().toISOString(), reason,
    })
    const request = async (url, options = {}) => {
      const timeout = new AbortController()
      const requestSignal = AbortSignal.any([activeSignal, timeout.signal])
      const timer = setTimeout(() => timeout.abort(new Error('LTIMindtree XML request timeout')), requestTimeoutMs)
      try { return await readWithSignal(() => fetchText(url, { ...options, signal: requestSignal }), requestSignal) }
      finally { clearTimeout(timer) }
    }
    const collectListings = async expectedOpeningTotal => {
      const listings = []
      const seenIds = new Set()
      let expectedTotal = expectedOpeningTotal ?? null
      for (let page = 0; page === 0 || page * pageSize < expectedTotal; page += 1) {
        checkSignal(activeSignal)
        if (page >= maxPages) throw new Error('LTIMindtree maxPages limit leaves an incomplete XML inventory')
        const body = new URLSearchParams({
          careerSiteUrlParams: JSON.stringify(buildSearchRequestPayload(page, pageSize)),
          lang: 'en',
        })
        const xml = await request(searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body,
        })
        pagesFetched += 1
        const result = parseIndiaPage(xml, page, pageSize, expectedTotal)
        expectedTotal = result.total
        if (expectedTotal > maxJobs) throw new Error('LTIMindtree maxJobs limit leaves an incomplete XML inventory')
        for (const listing of result.listings) {
          if (seenIds.has(listing.jobId)) throw new Error(`LTIMindtree duplicate job ${listing.jobId} across pages`)
          seenIds.add(listing.jobId)
          listings.push(listing)
        }
      }
      if (listings.length !== expectedTotal) throw new Error('LTIMindtree incomplete India listing snapshot')
      return { total: expectedTotal, listings }
    }

    try {
      const opening = await collectListings()
      const { listings } = opening
      const jobs = new Array(listings.length)
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < listings.length) {
          checkSignal(activeSignal)
          const index = nextIndex++
          const listing = listings[index]
          const xml = await request(detailUrl(listing.jobId))
          checkSignal(activeSignal)
          if (typeof xml !== 'string' || !/^\s*(?:<\?xml[^>]*\?>\s*)?<CandidateJobVO>[\s\S]*<\/CandidateJobVO>\s*$/.test(xml)) {
            throw new Error(`LTIMindtree invalid job detail ${listing.jobId}`)
          }
          const jobBlocks = [...xml.matchAll(/<jobVO>([\s\S]*?)<\/jobVO>/gi)]
          if (jobBlocks.length !== 1 || nativeValue('jobSeq', jobBlocks[0][1]) !== listing.jobId) {
            throw new Error(`LTIMindtree invalid native detail identity ${listing.jobId}`)
          }
          if (!/<companyCd>\s*LTIMINDIA\s*<\/companyCd>/i.test(xml)) {
            throw new Error(`LTIMindtree unverified India company for job ${listing.jobId}`)
          }
          const detail = parseRipplehireDetail(xml, listing)
          if (!detail.jobDescription || detail.jobId !== listing.jobId) {
            throw new Error(`LTIMindtree incomplete job detail ${listing.jobId}`)
          }
          jobs[index] = {
            jobId: listing.jobId,
            requisitionId: detail.requisitionId || listing.requisitionId,
            title: detail.title || listing.title,
            company: COMPANY,
            country: listing.country,
            department: detail.department || listing.department,
            location: listing.country ? (detail.location || listing.location) : workplace(textValue(nativeValue('locations', jobBlocks[0][1]))),
            city: /^select location$/i.test(detail.city || '') ? null : detail.city || listing.city,
            link: listing.applyUrl,
            applyUrl: listing.applyUrl,
            sourceUrl: listing.sourceUrl,
            source: SOURCE,
            sourceListingComplete: false,
            sourceScopeComplete: false,
            lifecycleCleanupAllowed: false,
            employmentType: detail.employmentType,
            experienceRequired: detail.experienceRequired,
            jobDescription: detail.jobDescription,
            minimumQualification: detail.minimumQualification,
            preferredQualification: detail.preferredQualification,
            requiredSkills: detail.requiredSkills,
            postingDate: detail.postingDate || listing.postingDate,
            closingDate: detail.closingDate,
            rawListingCountry: listing.rawCountry,
            rawListingWorkplace: listing.rawWorkplace,
            rawDetailWorkplace: textValue(nativeValue('jobLocation', jobBlocks[0][1])),
            scrapedAt: new Date().toISOString(),
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(detailConcurrency, listings.length) }, () => worker().catch(error => {
        stopped.abort(error)
        throw error
      })))
      const closing = await collectListings(opening.total)
      const openingRows = new Map(listings.map(listing => [listing.jobId, JSON.stringify(listing)]))
      if (closing.listings.length !== listings.length || closing.listings.some(listing => openingRows.get(listing.jobId) !== JSON.stringify(listing))) {
        throw new Error('LTIMindtree changed closing India listing snapshot')
      }
      checkSignal(activeSignal)
      const verifiedJobs = jobs.filter(job => job.country === 'India')
      const unresolvedIds = jobs.filter(job => job.country === null).map(job => job.jobId)
      const countriesResolved = unresolvedIds.length === 0
      // Detach observations before attaching them to a returned job. Otherwise
      // the first job would point through nativeRoles back to itself on JSON save.
      const nativeRoles = Object.freeze(jobs.map(job => Object.freeze({
        ...job, requiredSkills: Object.freeze([...(job.requiredSkills || [])]),
      })))
      const nativeInventory = Object.freeze({
        source: SOURCE,
        queryScope: buildIndiaSearchUrl(), queryReportedTotal: opening.total,
        queryEnumeratedCount: listings.length, queryDetailedCount: jobs.length,
        queryIndiaTypedCount: verifiedJobs.length, queryUnknownCountryCount: unresolvedIds.length,
        queryPagesFetched: pagesFetched, queryCountryScopeComplete: countriesResolved,
        enumeratedIds: Object.freeze(listings.map(job => job.jobId)),
        detailedIds: Object.freeze(jobs.map(job => job.jobId)),
        nativeRoles, unresolvedIds: Object.freeze(unresolvedIds), closingStable: true, queryEnumerationComplete: true,
        companyGlobalTotal: null, companyIndiaTotal: null,
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      })
      Object.defineProperty(verifiedJobs, 'nativeInventory', { value: nativeInventory })
      attachSourceObservationEvidence(verifiedJobs, {
        source: SOURCE, recordKind: 'vacancy-rows',
        observedRecordCount: listings.length, observedVacancyCount: listings.length,
        sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
      })
      if (verifiedJobs.length) verifiedJobs[0].nativeCollectionEvidence = nativeInventory
      return attachInventoryEvidence(verifiedJobs, evidence(countriesResolved
        ? 'ltimindtree-native-india-query-opening-details-and-closing-reconciled;company-totals-and-cleanup-unverified'
        : 'ltimindtree-native-india-query-enumerated-but-typed-job-countries-unresolved;company-totals-and-cleanup-unverified'))
    } catch (error) {
      stopped.abort(error)
      checkSignal(signal)
      if (error && (typeof error === 'object' || typeof error === 'function') && Object.isExtensible(error)) {
        error.abortRetries = true
        error.softFailure = true
        error.failureKind = 'coverage_gap'
        error.inventoryEvidence = evidence('ltimindtree-native-india-query-not-reconciled')
      }
      throw error
    }
  },
})

const createNativeJsonScraper = () => createRipplehireInventoryScraper({
  source: SOURCE, company: COMPANY, origin: BASE_URL, token: TOKEN,
  parentCompanyId: 51, companyIds: [72], companyCodes: ['LTIMINDIA'],
  // These are the filters of the current corporate India link. Their successful
  // reconciliation does not prove employer-wide inventory or resolve blank countries.
  searchParameters: { geo: 'India', campaignSeq: undefined },
})

export const createLtimindtreeScraper = () => ({
  async run(options = {}) {
    // The public Backbone client negotiates JSON. An injected historical XML
    // reader remains supported; it must pass the same validation and time bounds.
    if (typeof options.fetchText !== 'function') return createNativeJsonScraper().run(options)
    const maxResponseBytes = options.maxResponseBytes ?? 4 * 1024 * 1024
    const maxTotalBytes = options.maxTotalBytes ?? 16 * 1024 * 1024
    for (const value of [maxResponseBytes, maxTotalBytes]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new TypeError('Invalid LTIMindtree native byte limit')
    }
    let totalResponseBytes = 0
    const readInjected = async (url, request) => {
      const body = await options.fetchText(url, request)
      checkSignal(request.signal)
      if (typeof body === 'string') {
        const size = Buffer.byteLength(body, 'utf8')
        totalResponseBytes += size
        if (size > maxResponseBytes || totalResponseBytes > maxTotalBytes) {
          throw Object.assign(new Error('LTIMindtree native response byte budget exceeded'), { code: 'LTIMINDTREE_NATIVE_BYTE_LIMIT' })
        }
      }
      return body
    }
    const started = performance.now()
    const switchToXml = Object.freeze({ protocol: 'injected-legacy-xml' })
    let firstResponse
    let firstRequest = true
    const requestKey = (url, request) => JSON.stringify([url, request.method || 'GET', request.body?.toString() || null])
    try {
      return await createNativeJsonScraper().run({ ...options, fetchText: async (url, request) => {
        const body = await readInjected(url, request)
        if (firstRequest) {
          firstRequest = false
          if (typeof body === 'string' && /^\s*</.test(body)) {
            firstResponse = { key: requestKey(url, request), body }
            throw switchToXml
          }
        }
        return body
      } })
    } catch (error) {
      if (error !== switchToXml) throw error
    }
    checkSignal(options.signal)
    const budget = new AbortController()
    const budgetReason = new Error('LTIMindtree XML collection budget exhausted')
    const remaining = Math.max(0, (options.collectionBudgetMs ?? 300000) - (performance.now() - started))
    const timer = setTimeout(() => budget.abort(budgetReason), remaining)
    if (remaining === 0) budget.abort(budgetReason)
    const signal = options.signal ? AbortSignal.any([options.signal, budget.signal]) : budget.signal
    try {
      return await createLegacyXmlScraper().run({ ...options, signal,
        maxPages: options.maxPages === 0 ? Infinity : options.maxPages,
        maxJobs: options.maxJobs === 0 ? Infinity : options.maxJobs,
        fetchText: async (url, request) => {
          checkSignal(signal)
          if (firstResponse) {
            const cached = firstResponse
            firstResponse = null
            if (cached.key !== requestKey(url, request)) throw new Error('LTIMindtree changed first native query during protocol selection')
            return cached.body
          }
          return readInjected(url, request)
        },
      })
    } catch (error) { checkSignal(options.signal); throw error }
    finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createLtimindtreeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running LTIMindtree scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
  }
}
