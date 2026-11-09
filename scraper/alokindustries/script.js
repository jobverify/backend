import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ALOK_INDUSTRIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ALOK_INDUSTRIES_CATALOG.source
export const COMPANY = ALOK_INDUSTRIES_CATALOG.companyName
export const VERIFIED_AT = ALOK_INDUSTRIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ALOK_INDUSTRIES_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = ALOK_INDUSTRIES_CATALOG.officialHomepageUrl
export const CAREERS_URL = ALOK_INDUSTRIES_CATALOG.companyCareerPage
export const ROBOTS_TXT_URL = ALOK_INDUSTRIES_CATALOG.robotsTxtUrl
export const SITEMAP_URL = ALOK_INDUSTRIES_CATALOG.sitemapUrl
export const RESUME_EMAIL = ALOK_INDUSTRIES_CATALOG.officialResumeEmail
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.alokind.com/careers',
  'https://www.alokind.com/jobs',
  'https://www.alokind.com/join-us',
  'https://www.alokind.com/openings',
  'https://www.alokind.com/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjob vacancy\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /href=["'][^"']*\/jobs?(?:[/"'#?]|$)/i,
  /href=["'][^"']*\/openings?(?:[/"'#?]|$)/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /peoplestrong/i,
  /icims/i,
  /taleo/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/[’]/g, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
)

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || fallbackUrl

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Best Quality Fabric & Textile Manufacturing Company In India \| Largest Fully Integrated & Cutting Edge[\s\S]*?Solutions - Alok Industries\s*<\/title>/i.test(page)
    && normalized.includes('welcome to alok industries limited')
    && normalized.includes("india's largest vertically integrated textile company")
    && normalized.includes("alok industries limited is one of india's largest vertically integrated textile companies")
    && /href=["']careers\.html["']/i.test(page)
  }

export const extractHomepageCareerUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeWhitespace(match[2])
    if (label !== 'Careers') continue

    return toAbsoluteUrl(match[1], HOMEPAGE_URL)
  }

  return null
}

export const hasResumeOnlyCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers at Alok Industries\s*<\/title>/i.test(page)
    && normalized.includes('at alok industries, we believe that our strength lies in our people.')
    && normalized.includes('our work values')
    && normalized.includes('take the first step towards an extraordinary career, email us at:')
    && new RegExp(`mailto:${RESUME_EMAIL.replace('.', '\\.')}`, 'i').test(page)
}

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isKnownMissingJobRoute = (page = {}, requestedUrl) => {
  const finalUrl = getFinalUrl(page, requestedUrl)

  return Number(page?.status) === 404
    && finalUrl === requestedUrl
    && /<title>\s*Alok Industries\s*<\/title>/i.test(String(page?.html ?? ''))
    && !hasPublicJobListingSignal(page?.html)
}

export const createAlokIndustriesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Alok Industries verified official homepage no longer matches the known public surface')
    }

    if (extractHomepageCareerUrl(homepage.html) !== CAREERS_URL) {
      throw new Error('Alok Industries verified homepage Careers link changed materially')
    }

    if (hasPublicJobListingSignal(homepage.html)) {
      throw new Error('Alok Industries homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('Alok Industries careers page now appears to expose a public jobs surface')
    }

    if (careersPage.status !== 200 || !hasResumeOnlyCareersSignal(careersPage.html)) {
      throw new Error('Alok Industries verified resume-only careers surface changed materially')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isKnownMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`Alok Industries verified no-public-job route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAlokIndustriesScraper().run(options)

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
