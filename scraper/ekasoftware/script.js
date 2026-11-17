import path from 'node:path'
import { fileURLToPath } from 'node:url'

import EKA_SOFTWARE_CATALOG from './catalog.js'
import { runCurrentEka } from './currentNative20261117.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EKA_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.careersPageUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const SITEMAP_CAREER_ROUTE_URLS = PROVIDER_METADATA.sitemapCareerRouteUrls
export const NO_PUBLIC_JOB_ROUTE_URLS = PROVIDER_METADATA.noPublicJobRouteUrls

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
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
  /recruitee/i,
  /teamtailor/i,
  /jobsoid/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
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

const getFinalUrl = (page, fallbackUrl) => page?.url || fallbackUrl

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

export const extractPublicJobLinks = (html = '', baseUrl = CAREERS_PAGE_URL) => {
  const links = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], baseUrl)
    if (!absoluteUrl) continue

    if (/\/careers\/.+/i.test(absoluteUrl) || /\/jobs\/.+/i.test(absoluteUrl)) {
      links.add(absoluteUrl)
      continue
    }

    if (
      /boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|successfactors|oraclecloud|darwinbox|peoplestrong|icims|taleo|recruitee|teamtailor|jobsoid/i.test(absoluteUrl)
    ) {
      links.add(absoluteUrl)
    }
  }

  return [...links]
}

export const hasPublicJobListingSignal = (html = '') =>
  extractPublicJobLinks(html).length > 0
  || PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)
  const title = normalizeText((page.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '')

  return title === 'quoreka | ctrm & etrm software for commodity trading & operations'
    && /href=["']https:\/\/quoreka\.com\/careers["']/i.test(page)
    && normalized.includes('discover how we support critical industries with tailored solutions for complex trading, logistics, and supply chain challenges')
    && !hasPublicJobListingSignal(page)
}

export const extractHomepageCareerUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = normalizeWhitespace(match[2])
    if (!/^careers$/i.test(label)) continue

    return toAbsoluteUrl(match[1], HOMEPAGE_URL)
  }

  return null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)
  const title = normalizeText((page.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '')

  return title === 'careers at quoreka'
    && normalized.includes('our vision')
    && normalized.includes('our values')
    && normalized.includes('career benefits')
    && normalized.includes('join us at quoreka and help create something extraordinary.')
    && !hasPublicJobListingSignal(page)
}

export const hasExpectedCareerRouteSet = (xml = '') => {
  const routes = [...String(xml ?? '').matchAll(/<loc>([^<]*(?:career|careers|jobs|join-us|work-with-us|openings)[^<]*)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .sort()

  return JSON.stringify(routes) === JSON.stringify([...SITEMAP_CAREER_ROUTE_URLS].sort())
}

export const isVerifiedMissingPublicJobRoute = (page = {}, requestedUrl) => {
  const expectedUrl = requestedUrl || page?.url || ''
  const finalUrl = getFinalUrl(page, expectedUrl)

  return Number(page?.status) === 404
    && finalUrl === expectedUrl
    && !hasPublicJobListingSignal(page?.html)
}

export const createEkaSoftwareScraper = () => ({
  run: runCurrentEka,
})

export const run = async (options = {}) => createEkaSoftwareScraper().run(options)

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
