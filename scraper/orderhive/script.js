import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ORDERHIVE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const SOURCE = ORDERHIVE_CATALOG.source
export const COMPANY = ORDERHIVE_CATALOG.companyName
export const PROVIDER_METADATA = ORDERHIVE_CATALOG
export const HOMEPAGE_URL = ORDERHIVE_CATALOG.homepageUrl
export const CAREERS_ROUTE_URL = ORDERHIVE_CATALOG.companyCareerPage
export const PARENT_HOMEPAGE_URL = ORDERHIVE_CATALOG.parentHomepageUrl
export const PARENT_CAREERS_URL = ORDERHIVE_CATALOG.parentCareersPage

export const hasGenericParentHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = extractTitle(page)

  return /Cin7/i.test(title || '')
    && /inventory management software/i.test(normalized)
    && (/connected inventory performance platform/i.test(normalized) || /small business erp/i.test(normalized))
    && /Careers/i.test(normalized)
    && !/\bOrderhive\b/i.test(normalized)
}

export const hasGenericParentCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Grow Without Limits at Cin7/i.test(page)
    && /View career opportunities/i.test(normalized)
    && /jobs\.lever\.co\/cin7/i.test(page)
    && !/\bOrderhive\b/i.test(page)
}

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createOrderhiveScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, PARENT_HOMEPAGE_URL)
      || !hasGenericParentHomepageSignal(homepage.html)
    ) {
      throw new Error('Orderhive verified exact-name homepage redirect changed materially')
    }

    const parentCareersPage = await fetchPage(PARENT_CAREERS_URL)
    if (
      Number(parentCareersPage.status) !== 200
      || !matchesExpectedUrl(parentCareersPage.url, PARENT_CAREERS_URL)
      || !hasGenericParentCareersSignal(parentCareersPage.html)
    ) {
      throw new Error('Orderhive verified generic parent careers surface changed materially')
    }

    const careersRoute = await fetchPage(CAREERS_ROUTE_URL)
    if (!isMissingCareerRoute(careersRoute)) {
      throw new Error(`Orderhive verified no-public-careers route changed: ${careersRoute.url || CAREERS_ROUTE_URL}`)
    }

    return []
  },
})

export const run = async (options = {}) => createOrderhiveScraper().run(options)

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
