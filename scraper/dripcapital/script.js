import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DRIP_CAPITAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DRIP_CAPITAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.careersPageUrl
export const LEGACY_CAREERS_URL = PROVIDER_METADATA.legacyCareersPageUrl
export const US_CAREERS_URL = PROVIDER_METADATA.usCareersPageUrl
export const LEGACY_CAREERS_PAYLOAD_URL = PROVIDER_METADATA.legacyCareersPayloadUrl
export const INDIA_CAREERS_PAYLOAD_URL = PROVIDER_METADATA.indiaCareersPayloadUrl
export const US_CAREERS_PAYLOAD_URL = PROVIDER_METADATA.usCareersPayloadUrl
export const JOBS_URL = PROVIDER_METADATA.jobsPageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /icims/i,
  /successfactors/i,
  /oraclecloud/i,
  /\bvacanc(?:y|ies)\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&#039;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').trim().replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const extractCanonicalUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  )

  return match?.[1] ?? null
}

const extractMetaContent = (html = '', { name, property } = {}) => {
  const source = String(html ?? '')

  if (name) {
    const nameMatch = source.match(
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    )
    if (nameMatch?.[1]) return nameMatch[1]
  }

  if (property) {
    const propertyMatch = source.match(
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    )
    if (propertyMatch?.[1]) return propertyMatch[1]
  }

  return null
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(String(value ?? '')).hostname.toLowerCase()
    return hostname === 'dripcapital.com' || hostname === 'www.dripcapital.com'
  } catch {
    return false
  }
}

const hasStatePreload = (html = '') =>
  /https:\/\/assets\.dripcapital\.com\/_nuxt\/static\/[^"'\s]+\/state\.js/i.test(String(html ?? ''))

const hasExpectedPayloadUrl = (payloadUrl = '', routePath = '') =>
  String(payloadUrl || '').includes('/_nuxt/static/')
  && String(payloadUrl || '').endsWith(`${routePath}/payload.js`)

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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const description = extractMetaContent(rawHtml, { name: 'description' })

  return extractTitle(rawHtml) === 'Trade Finance Simplified | Drip Capital'
    && sameUrl(extractCanonicalUrl(rawHtml), HOMEPAGE_URL)
    && description?.startsWith('Drip Capital is a Trade Finance company')
}

export const extractPayloadUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/assets\.dripcapital\.com\/_nuxt\/static\/[^"'\s]+\/payload\.js/i,
  )

  return match?.[0] ?? null
}

export const hasCareersShellSignal = (html = '', {
  routeUrl,
  routePath,
  expectedTitle = null,
  expectedDescription = null,
  requireTitle = true,
  requireDescription = false,
} = {}) => {
  const rawHtml = String(html ?? '')

  const canonicalUrl = extractCanonicalUrl(rawHtml)
  if (canonicalUrl && !sameUrl(canonicalUrl, routeUrl)) return false
  if (!hasExpectedPayloadUrl(extractPayloadUrl(rawHtml), routePath)) return false
  if (!hasStatePreload(rawHtml)) return false
  if (!/id=["']__nuxt["']/i.test(rawHtml)) return false
  if (hasPublicJobsSignal(rawHtml)) return false

  if (requireTitle && extractTitle(rawHtml) !== expectedTitle) return false
  if (requireDescription) {
    const description = extractMetaContent(rawHtml, { name: 'description' })
    if (description !== expectedDescription) return false
  }

  if (expectedTitle) {
    const ogTitle = extractMetaContent(rawHtml, { property: 'og:title' })
    if (ogTitle && ogTitle !== expectedTitle) return false
  }

  return true
}

export const isVerifiedEmptyPayload = (payloadText = '', routePath) => {
  const compact = String(payloadText ?? '').replace(/\s+/g, '')
  const expectedWithSemicolon = `__NUXT_JSONP__("${routePath}",{data:[{}],fetch:{},mutations:[]});`
  const expectedWithoutSemicolon = `__NUXT_JSONP__("${routePath}",{data:[{}],fetch:{},mutations:[]})`

  return !hasPublicJobsSignal(payloadText)
    && (compact === expectedWithSemicolon || compact === expectedWithoutSemicolon)
}

export const hasRobotsSitemapSignal = (robotsTxt = '') =>
  /Sitemap:\s*https:\/\/www\.dripcapital\.com\/sitemap\.xml/i.test(String(robotsTxt ?? ''))

export const extractCareerLikeUrlsFromSitemap = (sitemapXml = '') => (
  [...String(sitemapXml ?? '').matchAll(/https:\/\/www\.dripcapital\.com\/[^<\s]+/gi)]
    .map((match) => match[0].replace(/&amp;/gi, '&'))
    .filter((url) => /\/(?:(?:en-in|en-us)\/)?careers(?:\/|$)|\/jobs(?:\/|$)/i.test(url))
)

const hasOnlyVerifiedSitemapCareerShell = (sitemapXml = '') => {
  const urls = extractCareerLikeUrlsFromSitemap(sitemapXml)
  return urls.length === 1 && sameUrl(urls[0], CAREERS_PAGE_URL)
}

export const isVerifiedJobs404Route = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 404
    && sameUrl(page.url || '', JOBS_URL)
    && isOfficialDomainUrl(page.url || '')
    && (extractTitle(rawHtml) === '404 Not Found' || normalized.includes('Not Found') || normalized.includes('404'))
    && !hasPublicJobsSignal(rawHtml)
}

export const createDripCapitalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Drip Capital verified homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Drip Capital homepage now exposes a public jobs surface')
    }

    const legacyCareersPage = await fetchPage(LEGACY_CAREERS_URL)
    if (
      legacyCareersPage.status !== 200
      || !sameUrl(legacyCareersPage.url, LEGACY_CAREERS_URL)
      || !hasCareersShellSignal(legacyCareersPage.html, {
        routeUrl: LEGACY_CAREERS_URL,
        routePath: '/careers',
        requireTitle: false,
        requireDescription: false,
      })
    ) {
      throw new Error('Drip Capital verified legacy careers route no longer matches the trusted first-party surface')
    }

    const legacyPayloadUrl = extractPayloadUrl(legacyCareersPage.html)
    const legacyPayloadPage = await fetchPage(legacyPayloadUrl)
    if (
      legacyPayloadPage.status !== 200
      || !sameUrl(legacyPayloadPage.url, legacyPayloadUrl)
      || !isVerifiedEmptyPayload(legacyPayloadPage.html, '/careers')
    ) {
      throw new Error('Drip Capital verified empty legacy careers payload changed')
    }

    const indiaCareersPage = await fetchPage(CAREERS_PAGE_URL)
    if (
      indiaCareersPage.status !== 200
      || !sameUrl(indiaCareersPage.url, CAREERS_PAGE_URL)
      || !hasCareersShellSignal(indiaCareersPage.html, {
        routeUrl: CAREERS_PAGE_URL,
        routePath: '/en-in/careers',
        requireTitle: false,
        requireDescription: false,
      })
    ) {
      throw new Error('Drip Capital verified india careers route no longer matches the trusted first-party surface')
    }

    const indiaPayloadUrl = extractPayloadUrl(indiaCareersPage.html)
    const indiaPayloadPage = await fetchPage(indiaPayloadUrl)
    if (
      indiaPayloadPage.status !== 200
      || !sameUrl(indiaPayloadPage.url, indiaPayloadUrl)
      || !isVerifiedEmptyPayload(indiaPayloadPage.html, '/en-in/careers')
    ) {
      throw new Error('Drip Capital verified empty india careers payload changed')
    }

    const usCareersPage = await fetchPage(US_CAREERS_URL)
    if (
      usCareersPage.status !== 200
      || !sameUrl(usCareersPage.url, US_CAREERS_URL)
      || !hasCareersShellSignal(usCareersPage.html, {
        routeUrl: US_CAREERS_URL,
        routePath: '/en-us/careers',
        expectedTitle: 'Careers | Join Drip Capital',
        expectedDescription:
          'Join the Drip Capital team. Build the future of working capital access for SMBs. We are hiring engineers, analysts, and operators.',
        requireTitle: true,
        requireDescription: true,
      })
    ) {
      throw new Error('Drip Capital verified US careers route no longer matches the trusted first-party surface')
    }

    const usPayloadUrl = extractPayloadUrl(usCareersPage.html)
    const usPayloadPage = await fetchPage(usPayloadUrl)
    if (
      usPayloadPage.status !== 200
      || !sameUrl(usPayloadPage.url, usPayloadUrl)
      || !isVerifiedEmptyPayload(usPayloadPage.html, '/en-us/careers')
    ) {
      throw new Error('Drip Capital verified empty US careers payload changed')
    }

    const jobsRoutePage = await fetchPage(JOBS_URL)
    if (!isVerifiedJobs404Route(jobsRoutePage)) {
      throw new Error('Drip Capital verified jobs route changed or now exposes public jobs')
    }

    const robotsPage = await fetchPage(ROBOTS_TXT_URL)
    if (
      robotsPage.status !== 200
      || !sameUrl(robotsPage.url, ROBOTS_TXT_URL)
      || !hasRobotsSitemapSignal(robotsPage.html)
    ) {
      throw new Error('Drip Capital verified robots.txt sitemap signal changed')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (
      sitemapPage.status !== 200
      || !sameUrl(sitemapPage.url, SITEMAP_URL)
      || !hasOnlyVerifiedSitemapCareerShell(sitemapPage.html)
    ) {
      throw new Error('Drip Capital verified sitemap careers surface changed')
    }

    return []
  },
})

export const run = async (options = {}) => createDripCapitalScraper().run(options)

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
