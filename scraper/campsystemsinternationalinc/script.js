import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG } from './catalog.js'
import { createCurrentCampScraper } from './currentNative.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.source
export const COMPANY = CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.officialBrandName
export const CAREERS_URL = CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.companyCareerPage
export const VERIFIED_ON = CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.verifiedOn
export const PROVIDER_METADATA = CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return (/<title>\s*Careers\s*\|\s*CAMP Systems\s*<\/title>/i.test(page)
    || /<title>\s*Careers\s*<\/title>/i.test(page))
    && text.includes('careers')
    && text.includes('innovative, forward-thinkers wanted')
    && (
      text.includes('leading provider of aviation software and services')
      || text.includes('saas company delivering groundbreaking aircraft health management solutions')
    )
    && (
      text.includes('saas products power the business of aviation worldwide')
      || text.includes('market data to the business aviation industry worldwide')
    )
    && (
      text.includes('find opportunities')
      || text.includes('talented and passionate people')
    )
  }

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCampSystemsInternationalIncScraper = () => ({
  async run(options = {}) {
    if (!options.fetchText || options.fetchImpl) return createCurrentCampScraper().run(options)
    const { fetchText = defaultFetchText } = options
    const timeoutMs = options.timeoutMs ?? 20000
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw Error('Invalid CAMP legacy transport deadline')
    if (options.signal != null && !(options.signal instanceof AbortSignal)) throw Error('Invalid CAMP caller cancellation signal')
    options.signal?.throwIfAborted()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('CAMP landing deadline exceeded', 'TimeoutError')), timeoutMs)
    const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])])
    let careersHtml
    try {
      careersHtml = await new Promise((resolve, reject) => {
        const finish = (callback, value) => { signal.removeEventListener('abort', abort); callback(value) }
        const abort = () => finish(reject, signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        Promise.resolve().then(() => fetchText(CAREERS_URL, { signal: options.signal })).then(value => finish(resolve, value), error => finish(reject, error))
        if (signal.aborted) abort()
      })
      signal.throwIfAborted()
    } finally { clearTimeout(timer) }

    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('The verified CAMP Systems careers landing no longer matches the trusted first-party surface')
    }

    return attachInventoryEvidence([], { status: 'unverified', surface: CAREERS_URL,
      firstParty: true, listingComplete: false, pagesFetched: 1, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: 'An HTML-only marketing landing read does not establish the current public native inventory' })
  },
})

export const run = async (options = {}) => createCampSystemsInternationalIncScraper().run(options)

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
