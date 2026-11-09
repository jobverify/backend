import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AKTEK_CATALOG } from './catalog.js'
import { withUnverifiedPublicSurface } from '../../scraper-support/utils/unverifiedPublicSurface.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AKTEK_CATALOG.source
export const COMPANY = AKTEK_CATALOG.companyName
export const HOMEPAGE_URL = AKTEK_CATALOG.companyCareerPage
export const ROBOTS_TXT_URL = AKTEK_CATALOG.robotsTxtUrl
export const SITEMAP_INDEX_URL = AKTEK_CATALOG.sitemapIndexUrl
export const PAGE_SITEMAP_URL = AKTEK_CATALOG.pageSitemapUrl
export const VERIFIED_ON = AKTEK_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AKTEK_CATALOG.verifiedSurfaceSummary
export const CAREERS_ROUTE_URLS = [
  'https://aktek.io/careers',
  'https://aktek.io/career',
  'https://aktek.io/jobs',
  'https://aktek.io/join-us',
  'https://aktek.io/work-with-us',
  'https://aktek.io/openings',
  'https://aktek.io/current-openings',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

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

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["']https:\/\/aktek\.io\/(?:career|careers|jobs?|join-us|work-with-us|openings|current-openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings|current-openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Advanced Intelligence &amp; Technology Solutions \| AKTEK\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/aktek\.io\/software\/["']/i.test(rawHtml)
    && /href=["']https:\/\/aktek\.io\/intelligence\/["']/i.test(rawHtml)
    && /href=["']https:\/\/aktek\.io\/integrated-services\/["']/i.test(rawHtml)
    && /href=["']https:\/\/aktek\.io\/about-us\/["']/i.test(rawHtml)
    && /Empowering those who protect/i.test(normalized)
    && /AKTEK (?:provides|helps organizations protect)/i.test(normalized)
}

export const hasExpectedRobotsTxtSignal = (text) => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Disallow:\s*$/im.test(normalized)
    && /Sitemap:\s*https:\/\/aktek\.io\/sitemap_index\.xml/i.test(normalized)
}

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1])

export const hasExpectedSitemapIndexSignal = (xml) => {
  const urls = extractSitemapUrls(xml)

  return urls.includes('https://aktek.io/post-sitemap.xml')
    && urls.includes('https://aktek.io/page-sitemap.xml')
    && urls.length === new Set(urls).size
    && urls.every(url => ['https://aktek.io/post-sitemap.xml', 'https://aktek.io/page-sitemap.xml', 'https://aktek.io/category-sitemap.xml'].includes(url))
    && /<sitemapindex\b[^>]*>[\s\S]*<\/sitemapindex>/i.test(String(xml ?? ''))
}

export const hasExpectedPageSitemapSignal = (xml) => {
  const urls = extractSitemapUrls(xml)
  const hasKnownPages = [
    'https://aktek.io/',
    'https://aktek.io/security/',
    'https://aktek.io/software/',
    'https://aktek.io/integrated-services/',
    'https://aktek.io/intelligence/',
    'https://aktek.io/about-us/',
  ].every((url) => urls.includes(url))

  const hasCareerUrls = urls.some((url) => /\/(?:career|careers|jobs?|join-us|work-with-us|openings|current-openings)\/?$/i.test(url))

  return hasKnownPages && !hasCareerUrls
}

export const isMissingCareerRoute = (page = {}, requestedUrl = page.url) =>
  Number(page.status) === 404
  && CAREERS_ROUTE_URLS.includes(requestedUrl)
  && page.url === requestedUrl
  && (page.finalUrl == null || page.finalUrl === requestedUrl)
  && /<title>\s*Page not found - AKTEK\s*<\/title>/i.test(String(page.html ?? ''))
  && !hasPublicJobsSignal(page.html)

export const createAktekScraper = () => ({
  async run(options = {}) {
    return withUnverifiedPublicSurface({source:SOURCE,
      urls:[HOMEPAGE_URL, ROBOTS_TXT_URL, SITEMAP_INDEX_URL, PAGE_SITEMAP_URL], options,
      injected:options.fetchPage}, async ({read:fetchPage, fail, gap}) => {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw fail('Aktek verified official homepage no longer matches the known public surface', {failureKind:'surface_drift_or_fail_closed'})
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw fail('Aktek homepage now appears to expose public jobs; a hiring inventory contract must be qualified')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw fail('Aktek homepage now exposes a first-party careers or jobs link; a hiring inventory contract must be qualified')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxt.status !== 200 || !hasExpectedRobotsTxtSignal(robotsTxt.html)) {
      throw fail('Aktek verified robots.txt no longer matches the known public surface', {failureKind:'surface_drift_or_fail_closed'})
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
    if (sitemapIndex.status !== 200 || !hasExpectedSitemapIndexSignal(sitemapIndex.html)) {
      throw fail('Aktek verified sitemap index no longer matches the known public surface', {failureKind:'surface_drift_or_fail_closed'})
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasExpectedPageSitemapSignal(pageSitemap.html)) {
      throw fail('Aktek verified page sitemap no longer matches the known public surface', {failureKind:'surface_drift_or_fail_closed'})
    }

    return attachInventoryEvidence([], gap('Corporate homepage and crawl documents expose no qualified native vacancy inventory; company and India totals remain unknown', true))
    })
  },
})

export const run = async (options = {}) => createAktekScraper().run(options)

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
