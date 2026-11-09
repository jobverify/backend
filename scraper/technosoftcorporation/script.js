import path from 'node:path'
import { fileURLToPath } from 'node:url'

import TECHNOSOFT_CORPORATION_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TECHNOSOFT_CORPORATION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LEGACY_REDIRECT_URL = PROVIDER_METADATA.legacyRedirectUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'http://www.technosoftcorp.com/careers',
  'http://www.technosoftcorp.com/careers/',
  'http://www.technosoftcorp.com/jobs',
  'http://www.technosoftcorp.com/join-us',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const hasPublicJobsSignal = (html = '') =>
  /\b(apply now|job openings|current openings|we're hiring|join our team)\b/i.test(normalizeWhitespace(html))

// The retired site serves its verified rebrand/404 pages to the ordinary Node client.
// Obsolete Chrome impersonation headers trigger a 403 and cannot prove retirement.
const defaultFetchPage = async (url, { signal } = {}) => {
  const timeoutSignal = AbortSignal.timeout(15000)
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasTransportFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return [
    'UND_ERR_CONNECT_TIMEOUT',
    'ENOTFOUND',
    'ENOENT',
    'ECONNABORTED',
  ].includes(code)
    || /\bconnect timeout\b/i.test(message)
    || /\bgetaddrinfo\b/i.test(message)
    || /\bdns\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

export const hasLegacyHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Technosoft is now Apexon\s*<\/title>/i.test(page)
    && text.includes('Technosoft is now Apexon')
    && /href="https:\/\/www\.apexon\.com\/?"/i.test(page)
  }

export const isVerifiedBlockedHomepage = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page?.status) === 403
    && !hasPublicJobsSignal(html)
    && (/403 Forbidden/i.test(html) || text === '403 Forbidden nginx')
}

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && !hasPublicJobsSignal(page?.html ?? '')
  && normalizeWhitespace(page?.html ?? '') === ''

const upstreamHttpError = (page, url) => Object.assign(
  new Error('Technosoft public surface unavailable: HTTP ' + page.status + ' at ' + url),
  { code: 'TECHNOSOFT_UPSTREAM_HTTP_ERROR', status: page.status, url },
)

export const createTechnosoftCorporationScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()
    if (homepage.status !== 200) throw upstreamHttpError(homepage, HOMEPAGE_URL)
    if (!hasLegacyHomepageSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('The verified Technosoft Corporation exact-name surface changed materially at ' + HOMEPAGE_URL)
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl, { signal })
      signal?.throwIfAborted()
      if (![200, 404].includes(routePage.status)) throw upstreamHttpError(routePage, routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error('The verified Technosoft Corporation exact-name surface changed materially at ' + routeUrl)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTechnosoftCorporationScraper().run(options)

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
