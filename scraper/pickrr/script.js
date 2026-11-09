import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PICKRR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PICKRR_CATALOG.source
export const COMPANY = PICKRR_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PICKRR_CATALOG.officialBrandName
export const VERIFIED_ON = PICKRR_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PICKRR_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = PICKRR_CATALOG.homepageUrl
export const CAREERS_LANDING_URL = PICKRR_CATALOG.companyCareerPage
export const SITEMAP_URL = PICKRR_CATALOG.officialSitemapUrl
export const CAREERS_404_URL = PICKRR_CATALOG.official404CareersUrl
export const FIRST_PARTY_TIMEOUT_URLS = [
  HOMEPAGE_URL,
  SITEMAP_URL,
  CAREERS_LANDING_URL,
  CAREERS_404_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards(?:\.eu)?\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /\bapply now\b/i,
  /\bjob-post\b/i,
  /\bjob-role\b/i,
]

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    }

    throw error
  }
}

export const stripHtmlComments = (html) =>
  String(html ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*eCommerce Logistics Shipping Solutions & Courier Aggregator India \| Pickrr\s*<\/title>/i.test(page)
    && /Pickrr is India's largest ecommerce logistics solution/i.test(page)
    && /href="https:\/\/www\.pickrr\.com\/"/i.test(page)
    && /Get Guaranteed Rs\.300 Cashback/i.test(page)
    && /support@pickrr\.com/i.test(page)
    && /life-at-pickrr/i.test(page)
}

export const hasVerifiedLifeAtPickrrSignal = (html) => {
  const page = String(html ?? '')
  const hasVerifiedSelfReference =
    /href="https:\/\/(?:www\.)?pickrr\.com\/life-at-pickrr\/?"/i.test(page)
    || /<link[^>]+rel="canonical"[^>]+href="https:\/\/(?:www\.)?pickrr\.com\/life-at-pickrr\/?"/i.test(page)
    || /<meta[^>]+property="og:url"[^>]+content="https:\/\/(?:www\.)?pickrr\.com\/life-at-pickrr\/?"/i.test(page)

  return /<title>\s*Life at Pickrr - Grow your Career with Pickrr\s*<\/title>/i.test(page)
    && /Pickrr believes that each one of us should be able to find our dream career/i.test(page)
    && hasVerifiedSelfReference
    && /Come join us/i.test(page)
    && /Pickrr Growth Story/i.test(page)
    && /Life at Pickrr/i.test(page)
    && /Send us your Resume/i.test(page)
    && /Upload your resume/i.test(page)
}

export const hasVerifiedNotFoundCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Page Not Found - Pickrr\s*<\/title>/i.test(page)
    && /Uh-oh!\s*You[’']re lost/i.test(page)
    && /The page you are looking for does not exist/i.test(page)
    && /href="https:\/\/pickrr\.com\/"/i.test(page)
}

const extractSitemapLocs = (xml) =>
  Array.from(String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi), (match) => match[1].trim())

export const sitemapHasLifeAtPickrrRoute = (xml) =>
  extractSitemapLocs(xml).some((loc) => /^https:\/\/www\.pickrr\.com\/life-at-pickrr\/?$/i.test(loc))

export const sitemapHasPublicCareersRoute = (xml) =>
  extractSitemapLocs(xml).some((loc) => /^https:\/\/www\.pickrr\.com\/careers\/?$/i.test(loc))

export const hasPublicJobsSignal = (html) => {
  const visiblePage = stripHtmlComments(html)
  return PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(visiblePage))
}

export const createPickrrScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const [
      homepage,
      sitemap,
      lifeAtPickrrPage,
      careers404Page,
    ] = await Promise.all(FIRST_PARTY_TIMEOUT_URLS.map((url) => fetchPage(url)))

    if (!isExpectedTimedOutSurface(homepage) && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Pickrr verified homepage no longer matches the official first-party surface')
    }

    if (!isExpectedTimedOutSurface(sitemap) && (sitemap.status !== 200 || !sitemapHasLifeAtPickrrRoute(sitemap.html))) {
      throw new Error('Pickrr verified sitemap no longer matches the official first-party route contract')
    }
    if (isReachableSurface(sitemap) && sitemapHasPublicCareersRoute(sitemap.html)) {
      throw new Error('Pickrr verified sitemap now exposes a public careers route')
    }

    if (
      !isExpectedTimedOutSurface(lifeAtPickrrPage)
      && (lifeAtPickrrPage.status !== 200 || !hasVerifiedLifeAtPickrrSignal(lifeAtPickrrPage.html))
    ) {
      throw new Error('Pickrr verified life-at-pickrr page no longer matches the official first-party careers surface')
    }
    if (isReachableSurface(lifeAtPickrrPage) && hasPublicJobsSignal(lifeAtPickrrPage.html)) {
      throw new Error('Pickrr official careers form surface now appears to expose public jobs')
    }

    if (
      !isExpectedTimedOutSurface(careers404Page)
      && (![200, 404].includes(Number(careers404Page.status)) || !hasVerifiedNotFoundCareersSignal(careers404Page.html))
    ) {
      throw new Error('Pickrr verified careers not-found contract no longer matches the official first-party surface')
    }

    if (isReachableSurface(careers404Page) && hasPublicJobsSignal(careers404Page.html)) {
      throw new Error('Pickrr verified careers route now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createPickrrScraper().run(options)

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
