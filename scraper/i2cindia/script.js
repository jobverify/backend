import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { I2C_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = I2C_INDIA_CATALOG.source
export const COMPANY = I2C_INDIA_CATALOG.companyName
export const PROVIDER_METADATA = I2C_INDIA_CATALOG
export const CAREERS_LANDING_URL = I2C_INDIA_CATALOG.officialCareersLandingUrl
export const JOBS_LIST_URL = I2C_INDIA_CATALOG.officialJobsListUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  const knownCopy = (normalized.includes('race ahead make your mark') && normalized.includes('the future won'))
    || (normalized.includes('build the fintech future together')
      && normalized.includes('we build careers that grow with you and your family')
      && normalized.includes('kick your i2c journey into high gear'))
  return /careers\s*-\s*be a part of i2c\s*-\s*current openings/i.test(rawHtml)
    && knownCopy
    && /https:\/\/careers\.i2cinc\.com\/careers\/?/i.test(rawHtml)
}

export const extractVerifiedJobsListUrl = (html) => {
  const match = String(html ?? '').match(/https:\/\/careers\.i2cinc\.com\/careers\/?/i)
  return match ? match[0] : null
}

export const hasOfficialJobsListSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /i2c recruitment portal\s*\|\s*jobs list/i.test(rawHtml)
    && normalized.includes('open positions')
    && normalized.includes('all locations')
}

export const hasVerifiedPortalBotChallenge = (html) => {
  const page = String(html ?? '')

  return page.includes('window["bobcmn"]')
    && page.includes('window["failureConfig"]')
    && /TSPD_\d+/i.test(page)
}

export const extractLocationFacetSegment = (html) => {
  const page = String(html ?? '')
  const patterns = [
    /all locations([\s\S]*?)learn more about i2c/i,
    /all locations([\s\S]*?)<\/section>/i,
    /all locations([\s\S]*?)copyright/i,
    /all locations([\s\S]*?)<\/main>/i,
  ]

  for (const pattern of patterns) {
    const match = page.match(pattern)
    if (match?.[1]) {
      return normalizeWhitespace(match[1])
    }
  }

  return ''
}

export const hasIndiaLocationFilter = (html) => /\bindia\b/i.test(extractLocationFacetSegment(html))


export const JOBS_API_URL = 'https://careers.i2cinc.com/ajax.php'
const PAGE_SIZE = 32
const defaultFetchJobsPage = async (start, { signal } = {}) => {
  const response = await fetch(JOBS_API_URL, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: new URLSearchParams({ f: 'getJobsPager', s: '', st: String(start), pp: String(PAGE_SIZE), cf: String(start / PAGE_SIZE + 1) }),
    signal: composeAbortSignals(signal, AbortSignal.timeout(15000)),
  })
  if (response.status !== 200) throw new Error(`HTTP ${response.status} for i2c public jobs inventory at ${JOBS_API_URL}`)
  if (response.url !== JOBS_API_URL) throw new Error('i2c public jobs inventory redirected away from the verified API')
  const text = await response.text()
  if (hasVerifiedPortalBotChallenge(text)) throw new Error('i2c public jobs inventory is blocked by a bot challenge')
  return JSON.parse(text)
}

export const verifyNonIndiaInventory = async (fetchJobsPage) => {
  const seen = new Set()
  let expectedCount, expectedPositions, totalPositions = 0, received = 0
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const page = await fetchJobsPage(received)
    const positions = Number(page?.totalOpenings)
    if (!page || !Number.isInteger(page.jobCount) || page.jobCount < 0 || typeof page.html !== 'string'
      || !/^(0|[1-9]\d*)$/.test(String(page.totalOpenings)) || !Number.isSafeInteger(positions)
      || String(page.startValue) !== String(received) || Number(page.postPerpage) !== PAGE_SIZE || page.limit !== PAGE_SIZE) {
      throw new Error('i2c public jobs inventory schema or pagination changed')
    }
    expectedCount ??= page.jobCount
    expectedPositions ??= positions
    if (page.jobCount !== expectedCount || positions !== expectedPositions) throw new Error('i2c public jobs inventory totals changed during pagination')
    const cards = [...page.html.matchAll(/<article\b[^>]*class=["'][^"']*\bjoblisting-box\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)].map(match => match[1])
    if (cards.length !== (page.html.match(/<article\b/gi) || []).length) throw new Error('i2c inventory card markup changed')
    if (cards.length > PAGE_SIZE || (!cards.length && received < expectedCount)) throw new Error('i2c incomplete public jobs inventory')
    for (const card of cards) {
      const links = [...card.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      const titles = [...card.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
      const locations = [...card.matchAll(/<span\b[^>]*class=["'][^"']*\bjoblisting-location\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
      const counts = [...card.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi)]
      if ([links, titles, locations, counts].some(matches => matches.length !== 1)) throw new Error('i2c inventory record markup is malformed')
      const title = normalizeWhitespace(titles[0][1])
      const country = normalizeWhitespace(locations[0][1])
      const countText = normalizeWhitespace(counts[0][1])
      let url
      try { url = new URL(links[0][1], JOBS_LIST_URL) } catch { throw new Error('i2c inventory job URL is invalid') }
      if (url.origin !== 'https://careers.i2cinc.com' || !/^\/careers\/index\.php\/showjob\/[^/]+$/.test(url.pathname)
        || !title || !/^[1-9]\d*$/.test(countText)) throw new Error('i2c inventory record is malformed')
      if (!/^(Pakistan|United States)$/i.test(country)) throw new Error('i2c public inventory exposes India or unresolved country location: ' + country)
      if (seen.has(url.href)) throw new Error('i2c public jobs inventory contains duplicate identities')
      seen.add(url.href)
      totalPositions += Number(countText)
    }
    received += cards.length
    if (received > expectedCount) throw new Error('i2c public jobs inventory exceeds its advertised count')
    if (received === expectedCount) {
      if (totalPositions !== expectedPositions) throw new Error('i2c public jobs inventory positions do not match the advertised total')
      return { records: received, positions: totalPositions, pagesFetched: pageNumber + 1 }
    }
    if (cards.length < PAGE_SIZE) throw new Error('i2c incomplete public jobs inventory stopped before its advertised count')
  }
  throw new Error('i2c public jobs inventory pagination limit reached')
}

export const createI2cIndiaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJobsPage,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const landingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasOfficialCareersLandingSignal(landingHtml)) {
      throw new Error('The official i2c careers landing page no longer matches the verified public surface')
    }

    const jobsListUrl = extractVerifiedJobsListUrl(landingHtml)
    if (jobsListUrl !== JOBS_LIST_URL) {
      throw new Error('The official i2c careers landing page no longer hands off to the verified public jobs list')
    }

    const jobsListHtml = await fetchText(JOBS_LIST_URL)
    if (hasVerifiedPortalBotChallenge(jobsListHtml)) {
      throw new Error('The official i2c jobs portal is blocked by a bot challenge')
    }
    if (!hasOfficialJobsListSignal(jobsListHtml)) {
      throw new Error('The official i2c jobs list no longer matches the verified public portal surface')
    }

    if (hasIndiaLocationFilter(jobsListHtml)) {
      throw new Error('The official i2c jobs list now exposes an India location filter or India jobs')
    }

    signal?.throwIfAborted()
    if (/getJobsPager/.test(jobsListHtml)) {
      await verifyNonIndiaInventory(fetchJobsPage || (start => defaultFetchJobsPage(start, { signal })))
    } else if (!/\b(?:Pakistan|United States)\b/i.test(extractLocationFacetSegment(jobsListHtml))) {
      throw new Error('The official i2c jobs list has unresolved country location scope')
    }
    signal?.throwIfAborted()
    return []
  },
})

export const run = async (options = {}) => createI2cIndiaScraper().run(options)

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
