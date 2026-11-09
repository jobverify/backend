import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as wait } from 'node:timers/promises'

import { APPINESS_INTERACTIVE_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractNativeDetail, extractNativeListings } from './nativeDetails.js'

export { extractNativeDetail, extractNativeListings }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APPINESS_INTERACTIVE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)),
  })

  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), { status: response.status })
  }

  if (Number(response.headers.get('content-length')) > 1500000) throw new Error('Appiness native response exceeds the bounded size limit')
  const html = await response.text()
  signal?.throwIfAborted()
  if (Buffer.byteLength(html) > 1500000) throw new Error('Appiness native response exceeds the bounded size limit')
  return { status: response.status, url: response.url, html }
}

const receiveWithAbort = async (action, signal) => {
  signal.throwIfAborted()
  let onAbort, settlementTimer
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  const operation = Promise.resolve().then(action)
  try { return await Promise.race([operation, aborted]) }
  catch (error) {
    if (!signal.aborted) throw error
    // Give cooperative request/body cleanup100ms. An uncooperative injected
    // transport may outlive this grace; its late result can never resume parsing.
    await Promise.race([operation.catch(() => {}), new Promise(resolve => { settlementTimer = setTimeout(resolve, 100) })])
    throw signal.reason
  } finally {
    signal.removeEventListener('abort', onAbort)
    clearTimeout(settlementTimer)
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Jobs at Appiness Interactive/i.test(page)
    && text.includes('Current Openings')
    && /\bRole\b/i.test(text)
    && /\bExperience\b/i.test(text)
    && /\bLocation\b/i.test(text)
}

const buildJob = (title, experienceRequired, city) => {
  const normalizedTitle = normalizeWhitespace(title)
  const normalizedExperience = normalizeWhitespace(experienceRequired)
  const normalizedCity = normalizeWhitespace(city)
  const jobId = slugify(normalizedTitle)

  return {
    title: normalizedTitle,
    company: COMPANY,
    department: null,
    location: `${normalizedCity}, India`,
    city: normalizedCity,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: normalizedExperience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  }
}

export const extractJobs = (html = '') => {
  const page = String(html ?? '')
  const matches = [...page.matchAll(
    /Role\s+([^<\n]+?)\s*<\/div>\s*<div>\s*Experience\s+([^<\n]+?)\s*<\/div>\s*<div>\s*Location\s+([^<\n]+?)\s*<\/div>/gi,
  )]

  if (matches.length > 0) {
    return matches.map((match) => buildJob(match[1], match[2], match[3]))
  }

  const text = normalizeWhitespace(
    page
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

  if (!text) return []

  return [...text.matchAll(
    /(?:Current Openings|Submit Application)\s+Role\s+(.+?)\s+Experience\s+(.+?)\s+Location\s+(.+?)\s+Job Details Apply/gi,
  )].map((match) => buildJob(match[1], match[2], match[3]))
}

export const createAppinessInteractiveScraper = ({ maxJobs = null, now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage, fetchText, signal, maxJobs: runMaxJobs = maxJobs, now: currentTime = now,
    requestIntervalMs = 500, sourceBudgetMs = 120000,
  } = {}) {
    signal?.throwIfAborted()
    if ((typeof fetchText === 'function' && typeof fetchPage !== 'function')
      || (fetchPage != null && typeof fetchPage !== 'function')) throw new Error('Appiness native runtime requires response receipts; text-only hooks are unsupported')
    if ((runMaxJobs != null && (!Number.isSafeInteger(runMaxJobs) || runMaxJobs < 1))
      || !Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0 || requestIntervalMs > 5000
      || !Number.isSafeInteger(sourceBudgetMs) || sourceBudgetMs < 1 || sourceBudgetMs > 120000) throw new Error('Appiness native bounded run options are invalid')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error(`Appiness native ${sourceBudgetMs}ms source deadline exhausted`)), sourceBudgetMs)
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    let lastStart = 0
    const loadPage = async url => {
      combined.throwIfAborted()
      const remaining = requestIntervalMs - (Date.now() - lastStart)
      if (remaining > 0) {
        try { await wait(remaining, undefined, { signal: combined }) } catch (error) { combined.throwIfAborted(); throw error }
      }
      combined.throwIfAborted()
      lastStart = Date.now()
      const response = await receiveWithAbort(() => (fetchPage || defaultFetchPage)(url, { signal: combined }), combined)
      combined.throwIfAborted()
      if (response?.status !== 200 || response.url !== url || typeof response.html !== 'string') throw new Error(`Appiness native response identity changed at ${url}`)
      return response.html
    }
    try {
      const listings = extractNativeListings(await loadPage(CAREERS_URL))
      const selected = runMaxJobs == null ? listings : listings.slice(0, runMaxJobs)
      const jobs = [], errors = []
      for (const listing of selected) {
        try {
          const job = extractNativeDetail(await loadPage(listing.sourceUrl), listing, { url: listing.sourceUrl })
          jobs.push({ ...job, source: SOURCE, link: job.applyUrl, scrapedAt: currentTime(),
            companyDomain: PROVIDER_METADATA.companyDomain, companyCareerPage: CAREERS_URL, sourceListingComplete: false,
          })
        } catch (error) { combined.throwIfAborted(); errors.push(error) }
      }
      combined.throwIfAborted()
      // The observed single page advertises no total. Even all28 successful
      // details cannot authorize lifecycle cleanup of unseen/retired roles.
      return attachInventoryEvidence(jobs, { status: jobs.length ? 'discovery-only' : 'coverage-gap',
        surface: CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched: 1,
        reportedTotal: null, indiaFacetCount: null, verifiedAt: currentTime(),
        reason: `native-listing-total-unreported;observed-roles=${listings.length};selected-details=${selected.length};verified-details=${jobs.length};detail-failures=${errors.length}${errors.length ? ';' + errors.map(error => String(error.message).slice(0, 180)).join(';') : ''}`,
      })
    } finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createAppinessInteractiveScraper(options).run(options)

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
