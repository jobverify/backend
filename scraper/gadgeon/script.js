import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { inspectGadgeonPage, declaredRegionRequests, reconcileGadgeonPages } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'gadgeon'
export const COMPANY = 'Gadgeon'
export const CAREERS_PAGE_URL = 'https://www.gadgeon.com/joinus/'
export const VERIFIED_PAGE_SIGNAL = 'Current Openings'

const NAVIGATION_TIMEOUT_MS = 45000

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const extractVisibleText = (html = '') => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

export const hasVerifiedCareersSurface = (pageData) => {
  const title = normalizeWhitespace(pageData?.title)
  const text = String(pageData?.text ?? '')

  return Boolean(title)
    && /gadgeon/i.test(title)
    && new RegExp(VERIFIED_PAGE_SIGNAL, 'i').test(text)
}

// A single listing-only collector has no bound native modal or facet evidence.
// Keep it readable for existing collectors without inventing posting IDs.
export const extractJobsFromPageData = () => []

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: NAVIGATION_TIMEOUT_MS,
  includeResponseMetadata: true,
  signal,
})

export const buildPageDataFromHtml = (html = '', url = CAREERS_PAGE_URL) => ({
  url,
  title: extractTitle(html),
  text: extractVisibleText(html) || '',
  html,
  jobs: [],
  nativeObservations: inspectGadgeonPage(html, url).observations,
})

export const createGadgeonScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    collectPageDataImpl,
    signal,
    onAudit = () => {},
    now = () => new Date().toISOString(),
  } = {}) {
    signal?.throwIfAborted()
    const pages = []
    if (collectPageDataImpl) {
      const pageData = await collectPageDataImpl(CAREERS_PAGE_URL)
      signal?.throwIfAborted()
      if (!hasVerifiedCareersSurface(pageData)) throw new Error('Gadgeon careers page no longer matches the verified public careers surface')
      const observations = pageData.nativeObservations || (pageData.jobs || []).map(original => ({ original, country: null }))
      const audit = { source: SOURCE, observations, legacyPageData: pageData, pages: [], fullSourceVerified: false }
      await onAudit(structuredClone(audit))
      signal?.throwIfAborted()
      return attachInventoryEvidence([], { status: 'discovery-only', surface: CAREERS_PAGE_URL, firstParty: false,
        listingComplete: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
        reason: 'gadgeon-listing-only-collector-has-no-native-country-or-modal-proof' })
    }
    const load = async (url, requestedRegion = null) => {
      signal?.throwIfAborted()
      try {
        const response = await fetchText(url, { signal })
        signal?.throwIfAborted()
        const html = typeof response === 'string' ? response : response?.html
        if (typeof html !== 'string') throw new Error('Missing original careers HTML')
        const page = inspectGadgeonPage(html, url)
        Object.assign(page, { requestedRegion, responseStatus: response?.status ?? null,
          finalURL: response?.url ?? null, transportQualified: response?.status === 200 && response?.url === url })
        pages.push(page)
        return page
      } catch (error) {
        signal?.throwIfAborted()
        const page = { url, requestedRegion, transportQualified: false, observations: [], observedModalIDs: [],
          error: { name: error.name, message: error.message }, originalHTML: null }
        pages.push(page)
        return page
      }
    }
    const opening = await load(CAREERS_PAGE_URL)
    if (!opening.identity) {
      const error = new Error('Gadgeon careers page no longer matches the verified public careers surface')
      error.code = 'GADGEON_COVERAGE_GAP'
      throw error
    }
    const requests = declaredRegionRequests(opening)
    const regions = []
    for (const request of requests) regions.push(await load(request.url, request.region))
    const indiaRequest = requests.find(request => request.region === 'India')
    const indiaClosing = indiaRequest ? await load(indiaRequest.url, 'India') : null
    const closing = await load(CAREERS_PAGE_URL)
    const reconciled = reconcileGadgeonPages({ opening, regions, indiaClosing, closing })
    const audit = { source: SOURCE, ...reconciled, jobs: undefined, pages,
      declaredRequests: requests, postingIdentityQualified: false, publicationQualified: false }
    await onAudit(structuredClone(audit))
    signal?.throwIfAborted()
    const limit = Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : null
    const jobs = (limit == null ? reconciled.jobs : reconciled.jobs.slice(0, limit)).map(job => ({
      ...job,
      source: SOURCE,
      link: job.sourceUrl,
      scrapedAt: now(),
    }))
    Object.defineProperty(jobs, 'sourceAudit', { value: audit })
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_PAGE_URL, firstParty: true,
      listingComplete: false, pagesFetched: pages.filter(page => typeof page.originalHTML === 'string').length,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'gadgeon-native-modal-criteria-and-country-facets-retained-activation-posting-identity-and-all-channel-scope-unresolved' })
  },
})

export const run = async (options = {}) => createGadgeonScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Gadgeon scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
