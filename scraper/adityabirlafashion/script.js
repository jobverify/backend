import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ADITYA_BIRLA_FASHION_CATALOG from './catalog.js'
import { readFashionNative } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ADITYA_BIRLA_FASHION_CATALOG.source
export const COMPANY = ADITYA_BIRLA_FASHION_CATALOG.companyName
export const CAREERS_URL = ADITYA_BIRLA_FASHION_CATALOG.companyCareerPage
export const FASHION_RETAIL_OPENINGS_URL = ADITYA_BIRLA_FASHION_CATALOG.officialCareersHandoffUrl
export const GROUP_JOB_SEARCH_URL = ADITYA_BIRLA_FASHION_CATALOG.groupJobSearchUrl
export const STORE_MANAGER_OPENINGS_URL = ADITYA_BIRLA_FASHION_CATALOG.storeManagerOpeningsUrl
export const VERIFIED_SURFACE_SUMMARY = ADITYA_BIRLA_FASHION_CATALOG.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const sameUrl = (left, right) => String(left ?? '').replace(/\/+$/, '') === String(right ?? '').replace(/\/+$/, '')
const normalizeFashionRetailHandoffUrl = (value) => (
  sameUrl(value, 'https://careers.adityabirla.com/apparel-retail')
    ? FASHION_RETAIL_OPENINGS_URL
    : value
)

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...options.headers,
    },
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const extractAnchorUrlByText = (html, labelPattern) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, text] = match

    if (!labelPattern.test(normalizeWhitespace(text))) {
      continue
    }

    try {
      return new URL(href, CAREERS_URL).toString()
    } catch {
      continue
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return /the biggest brands and best people'? is the ideology that steers abfrl\./i.test(normalized)
    && /a world of opportunities/i.test(normalized)
    && /current openings/i.test(normalized)
    && /view more openings/i.test(normalized)
    && /store manager openings in abfrl/i.test(normalized)
}

export const extractVerifiedHandoffUrls = (html) => ({
  fashionRetailOpeningsUrl: normalizeFashionRetailHandoffUrl(
    extractAnchorUrlByText(html, /^view more openings$/i),
  ),
  storeManagerOpeningsUrl: extractAnchorUrlByText(html, /^store manager openings in abfrl$/i),
})

export const hasZeroVacancyFashionRetailSignal = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html)

  return status === 200
    && sameUrl(url, FASHION_RETAIL_OPENINGS_URL)
    && /aditya birla fashion and retail stands as india'?s first billion-dollar pure-play fashion powerhouse/i.test(normalized)
    && /current\s+vacancies\s+in\s+fashion\s*&\s*retail/i.test(normalized)
    && /no jobs available/i.test(normalized)
    && /currently, we have no vacancies in this sector/i.test(normalized)
}

export const hasZeroVacancyGroupJobSearchSignal = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html)

  return status === 200
    && sameUrl(url, GROUP_JOB_SEARCH_URL)
    && /search jobs at aditya birla group/i.test(normalized)
    && /showing\s+1\s*-\s*0\s+jobs out of\s+0/i.test(normalized)
    && /no jobs available/i.test(normalized)
    && /currently, we have no vacancies in this sector/i.test(normalized)
}

export const hasBrokenStoreManagerSignal = ({ status, url } = {}) =>
  status === 404 && sameUrl(url, STORE_MANAGER_OPENINGS_URL)

export const createAdityaBirlaFashionScraper = () => ({
  async run({ fetchPage: providedFetch = defaultFetchPage, signal, onAudit, now, maxJobs } = {}) {
    const fetchPage = async (url, options = {}) => {
      signal?.throwIfAborted()
      const page = await providedFetch(url, { ...options, signal })
      signal?.throwIfAborted()
      if (page?.url !== url) throw new Error('Aditya Birla Fashion current first-party response identity changed')
      return page
    }
    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Aditya Birla Fashion careers page no longer matches the verified official careers surface')
    }

    const handoffUrls = extractVerifiedHandoffUrls(careersPage.html)
    if (
      handoffUrls.fashionRetailOpeningsUrl !== FASHION_RETAIL_OPENINGS_URL
      || handoffUrls.storeManagerOpeningsUrl !== STORE_MANAGER_OPENINGS_URL
    ) {
      throw new Error('Aditya Birla Fashion careers page no longer matches the verified official careers surface')
    }

    const fashionRetailPage = await fetchPage(FASHION_RETAIL_OPENINGS_URL)
    if (fashionRetailPage.status !== 200 || !/Current\s+vacancies\s+in\s+Fashion\s*&\s*Retail/i.test(normalizeWhitespace(fashionRetailPage.html))) {
      throw new Error('Aditya Birla Fashion native sector public handoff changed')
    }

    const groupJobSearchPage = await fetchPage(GROUP_JOB_SEARCH_URL)
    if (groupJobSearchPage.status !== 200 || !/Search Jobs at Aditya Birla Group/i.test(normalizeWhitespace(groupJobSearchPage.html))) {
      throw new Error('Aditya Birla Fashion current group job-search public handoff changed')
    }

    const storeManagerPage = await fetchPage(STORE_MANAGER_OPENINGS_URL)
    if (hasBrokenStoreManagerSignal(storeManagerPage)) {
      const read = async (url, options) => {
        const page = await fetchPage(url, options)
        if (page.status !== 200 || typeof page.html !== 'string') throw new Error('Aditya Birla Fashion current native response unavailable')
        return page.html
      }
      return readFashionNative({ read, searchHtml: groupJobSearchPage.html, sectorHtml: fashionRetailPage.html, storeManagerStatus: storeManagerPage.status, signal, onAudit, now, maxJobs })
    }

    throw new Error('Aditya Birla Fashion store manager openings surface no longer matches the verified broken public handoff')
  },
})

export const run = async (options = {}) => createAdityaBirlaFashionScraper().run(options)

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
