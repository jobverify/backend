import path from 'node:path'
import { fileURLToPath } from 'node:url'

import DALISEC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DALISEC_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [...PROVIDER_METADATA.checkedCareersRouteUrls]
export const UNTRUSTWORTHY_EDGE_ERROR_STATUS_CODE = 526

const PLACEHOLDER_SITEMAP_LOC = 'https://www.yourdomain.tld/sitemap-0.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_REQUIRED_PATTERNS = [
  /<meta[^>]+name=["']generator["'][^>]+content=["']Gatsby 5\.15\.0["']/i,
  /data-identity=["']gatsby-global-css["']/i,
  /family=Space\+Grotesk/i,
  /family=Montserrat/i,
  /family=IBM\+Plex\+Mono/i,
  /id=["']___gatsby["']/i,
  /id=["']gatsby-focus-wrapper["']/i,
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bcareers at\b/i,
  /\bjoin our team\b/i,
  /\bwe are hiring\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const CAREER_PATH_PATTERN =
  /(?:^|\/)(careers?|jobs?|opening|openings|current-openings|join-us|work-with-us)(?:\/|$)/i

const VERIFIED_BUNDLE_COMPONENTS = [
  'component---src-pages-404-tsx',
  'component---src-pages-about-us-tsx',
  'component---src-pages-application-security-tsx',
  'component---src-pages-blockchain-security-tsx',
  'component---src-pages-cloud-security-tsx',
  'component---src-pages-contact-tsx',
  'component---src-pages-cyber-risk-management-tsx',
  'component---src-pages-data-privacy-tsx',
  'component---src-pages-enterprise-security-tsx',
  'component---src-pages-index-tsx',
  'component---src-pages-industrial-security-tsx',
  'component---src-pages-managed-services-tsx',
  'component---src-pages-managed-vapt-tsx',
  'component---src-pages-network-security-tsx',
  'component---src-pages-threat-simulations-tsx',
  'component---src-pages-why-us-tsx',
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  /\bcareer\b/i,
  /\bjobs?\b/i,
  /\bopenings\b/i,
  /greenhouse/i,
  /lever/i,
  /workable/i,
  /ashby/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'dalisec.com' || hostname === 'www.dalisec.com' || hostname.endsWith('.dalisec.com')
}

const sameScriptPathSet = (left = [], right = []) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const extractHrefUrls = (html) =>
  Array.from(String(html ?? '').matchAll(/href=["']([^"']+)["']/gi), (match) => match[1])

const extractLocUrls = (xml) =>
  Array.from(String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi), (match) => match[1].trim())

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const extractFirstPartyScriptPaths = (html) => {
  const seen = new Set()
  const scriptPaths = []

  for (const match of String(html ?? '').matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    const normalizedPath = `${absoluteUrl.pathname}${absoluteUrl.search}`.replace(/\?$/, '')
    if (seen.has(normalizedPath)) {
      continue
    }

    seen.add(normalizedPath)
    scriptPaths.push(normalizedPath)
  }

  return scriptPaths
}

export const extractAppBundlePath = (html) =>
  extractFirstPartyScriptPaths(html).find((scriptPath) => /^\/app-[^/]+\.js$/i.test(scriptPath)) ?? null

export const hasFirstPartyCareerLikeLink = (html) =>
  extractHrefUrls(html).some((href) => {
    const absoluteUrl = toAbsoluteUrl(href)
    return absoluteUrl && isFirstPartyUrl(absoluteUrl) && CAREER_PATH_PATTERN.test(absoluteUrl.pathname)
  })

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const scriptPaths = extractFirstPartyScriptPaths(rawHtml)

  return HOMEPAGE_REQUIRED_PATTERNS.every((pattern) => pattern.test(rawHtml))
    && scriptPaths.some((scriptPath) => /^\/webpack-runtime-[^/]+\.js$/i.test(scriptPath))
    && scriptPaths.some((scriptPath) => /^\/framework-[^/]+\.js$/i.test(scriptPath))
    && extractAppBundlePath(rawHtml) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedPlaceholderSitemap = (xml) => {
  const rawXml = normalizeWhitespace(xml)
  const locUrls = extractLocUrls(xml)

  return rawXml.includes('<sitemapindex')
    && rawXml.includes(PLACEHOLDER_SITEMAP_LOC)
    && locUrls.length === 1
    && locUrls[0] === PLACEHOLDER_SITEMAP_LOC
}

export const hasVerifiedBundleSignal = (bundleText) => {
  const rawText = String(bundleText ?? '')
  return VERIFIED_BUNDLE_COMPONENTS.every((signal) => rawText.includes(signal))
}

export const hasBundleJobsSignal = (bundleText) =>
  BUNDLE_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const isVerifiedCloudflareEdgeErrorPage = (page = {}) => {
  const rawText = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawText).toLowerCase()

  return Number(page?.status) === UNTRUSTWORTHY_EDGE_ERROR_STATUS_CODE
    && /error code[:\s]+526/i.test(rawText)
    && normalized.includes('invalid ssl certificate')
    && !hasPublicJobsSignal(rawText)
}

export const isVerifiedMissingCareersRoute = (page = {}, homepageScriptPaths = []) => {
  const rawHtml = String(page?.html ?? '')
  const routeScriptPaths = extractFirstPartyScriptPaths(rawHtml)

  return Number(page?.status) === 404
    && /<meta[^>]+name=["']generator["'][^>]+content=["']Gatsby 5\.15\.0["']/i.test(rawHtml)
    && /data-identity=["']gatsby-global-css["']/i.test(rawHtml)
    && /--error-404-bg\s*:\s*#0e1016/i.test(rawHtml)
    && sameScriptPathSet(routeScriptPaths, homepageScriptPaths)
    && !hasFirstPartyCareerLikeLink(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const createDalisecScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (isVerifiedCloudflareEdgeErrorPage(homepage)) {
      return []
    }
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Dalisec verified official homepage no longer matches the known first-party surface')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Dalisec homepage now exposes a first-party careers handoff')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Dalisec homepage now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !isVerifiedPlaceholderSitemap(sitemap.html)) {
      throw new Error('Dalisec placeholder sitemap no longer matches the known first-party no-public-careers surface')
    }

    const homepageScriptPaths = extractFirstPartyScriptPaths(homepage.html)
    const appBundlePath = extractAppBundlePath(homepage.html)
    if (!appBundlePath) {
      throw new Error('Dalisec homepage no longer exposes the verified app bundle')
    }

    const appBundleUrl = new URL(appBundlePath, HOMEPAGE_URL).toString()
    const appBundleText = await fetchText(appBundleUrl)
    if (!hasVerifiedBundleSignal(appBundleText) || hasBundleJobsSignal(appBundleText)) {
      throw new Error('Dalisec app bundle changed materially or now exposes a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareersRoute(routePage, homepageScriptPaths)) {
        throw new Error(
          `Dalisec checked first-party careers route changed materially or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createDalisecScraper().run(options)

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
