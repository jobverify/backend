import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRIMASELLER_CATALOG } from './catalog.js'

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
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.protocol === 'https:'
      && actualUrl.port === ''
      && actualUrl.username === ''
      && actualUrl.password === ''
      && actualUrl.hash === ''
      && actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  try {
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
  } catch (error) {
    return {
      status: null,
      url,
      html: null,
      error: String(error),
      causeMessage: error?.cause?.message ? String(error.cause.message) : null,
      causeCode: error?.cause?.code ? String(error.cause.code) : null,
    }
  }
}

export const SOURCE = PRIMASELLER_CATALOG.source
export const COMPANY = PRIMASELLER_CATALOG.companyName
export const PROVIDER_METADATA = PRIMASELLER_CATALOG
export const HOMEPAGE_URL = PRIMASELLER_CATALOG.homepageUrl
export const LEGACY_ABOUT_PAGE_URL = PRIMASELLER_CATALOG.legacyAboutPageUrl
export const LEGACY_FSLINK_URL = PRIMASELLER_CATALOG.legacyFsLinkUrl
export const REDIRECT_TARGET_URL = 'https://www.delhivery.com/solutions/d2c-brands'
export const VERIFIED_AT = PRIMASELLER_CATALOG.verifiedOn

export const hasRedirectedDelhiverySignal = (page) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 200
    && matchesExpectedUrl(page?.url, REDIRECT_TARGET_URL)
    && /Delhivery/i.test(html)
    && /D2C brands|eCommerce Logistics/i.test(normalized)
    && !/\bPrimaseller\b/i.test(html)
}

export const isExpiredLegacyTlsSurface = (page) =>
  /SEC_E_CERT_EXPIRED|certificate has expired|CERT_HAS_EXPIRED/i.test(
    [page?.error, page?.causeMessage, page?.causeCode].filter(Boolean).join(' | '),
  )

export const createPrimasellerScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!hasRedirectedDelhiverySignal(homepage)) {
      throw new Error('Primaseller verified exact-name homepage redirect changed materially')
    }

    const legacyAboutPage = await fetchPage(LEGACY_ABOUT_PAGE_URL)
    const legacyFsLinkPage = await fetchPage(LEGACY_FSLINK_URL)

    if (!isExpiredLegacyTlsSurface(legacyAboutPage) || !isExpiredLegacyTlsSurface(legacyFsLinkPage)) {
      throw new Error('Primaseller legacy exact-name surfaces changed materially or now expose a reachable public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createPrimasellerScraper().run(options)

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
