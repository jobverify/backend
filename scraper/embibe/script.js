import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { EMBIBE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = EMBIBE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const ROOT_URL = PROVIDER_METADATA.rootUrl
export const ROOT_CAREERS_URL = PROVIDER_METADATA.rootCareersRouteUrl
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.contactPageUrl
export const JOIN_US_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const JOIN_US_API_URL = PROVIDER_METADATA.joinUsApiUrl
export const SITEMAP_INDEX_URL = PROVIDER_METADATA.sitemapIndexUrl
export const PAGE_SITEMAP_URL = PROVIDER_METADATA.pageSitemapUrl
export const DARWINBOX_HANDOFF_URL =
  PROVIDER_METADATA.officialCareersHandoffUrl || PROVIDER_METADATA.darwinboxHandoffUrl
export const DARWINBOX_ORIGIN = PROVIDER_METADATA.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = PROVIDER_METADATA.darwinboxCompanyId
export const PUBLIC_ALL_JOBS_URL = PROVIDER_METADATA.publicAllJobsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bcandidateapi\/job\/alljobs\b/i,
  /candidatev2\/[^"'\\s<]+\/careers\/allJobs/i,
  /\/jobDetails\//i,
  /\bjob count\b/i,
  /\bdata-job-id\b/i,
]

const normalizeTextForMatching = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;|’|â€™/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|“|”/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeWhitespace = (value) => normalizeTextForMatching(String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
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

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Embibe join-us API request failed with HTTP ${response.status}`)
  }

  return response.json()
}

const createConfiguredDarwinboxScraper = () => createDarwinboxScraper({
  companyName: COMPANY,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasRootSiteShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return extractTitle(rawHtml) === 'EMBIBE - The most powerful AI-powered learning platform'
    && /<meta[^>]+name=["']build-version["'][^>]+content=["'][^"']+["']/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Achieve your best every time with EMBIBE/i.test(rawHtml)
    && /<div[^>]+id=["']app["'][^>]*><\/div>/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasOfficialMarketingHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Home - EMBIBE - The most powerful AI-powered learning platform'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.embibe\.com\/in-en\/home\/["']/i.test(rawHtml)
    && normalized.includes('Embibe Is A Global Innovator')
    && normalized.includes('AI Powered Learning Solution Provider')
    && /href=["']https:\/\/www\.embibe\.com\/in-en\/joinus\/["']/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasOfficialContactPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Contact Us - EMBIBE - The most powerful AI-powered learning platform'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/www\.embibe\.com\/in-en\/contactus\/["']/i.test(rawHtml)
    && normalized.includes("We might be reaching for the stars, but we'll always be right here for you.")
    && /mailto:support@embibe\.com/i.test(rawHtml)
    && normalized.includes('18002572961 (Toll Free)')
    && !hasPublicJobsSignal(rawHtml)
}

export const extractDarwinboxHandoffUrls = (html = '') => {
  const matches = String(html ?? '').match(/https:\/\/embibe\.darwinbox\.in\/ms\/candidate\/careers/gi) || []
  return [...new Set(matches.map((value) => value.trim()))]
}

export const hasJoinUsPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalizedHtml = normalizeTextForMatching(rawHtml)
  const normalizedText = normalizeWhitespace(rawHtml)
  const handoffUrls = extractDarwinboxHandoffUrls(rawHtml)
  const hasStructuredInventorySignal =
    /"@type"\s*:\s*"JobPosting"|candidateapi\/job\/alljobs|candidatev2\/[^"'\\s<]+\/careers\/allJobs|\/jobDetails\/|\bdata-job-id\b/i
      .test(rawHtml)

  return extractTitle(rawHtml) === 'Join Us - EMBIBE - The most powerful AI-powered learning platform'
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,\s*nofollow["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.embibe\.com\/in-en\/joinus\/?["']/i.test(rawHtml)
    && normalizedText.includes('If your heart beats for education and you want to be part of a revolution')
    && handoffUrls.length === 1
    && handoffUrls[0] === DARWINBOX_HANDOFF_URL
    && !hasStructuredInventorySignal
}

export const hasJoinUsApiSignal = (payload = {}) => {
  const content = String(payload?.content?.rendered ?? '')
  const yoastHead = String(payload?.yoast_head ?? '')

  return payload?.slug === 'joinus'
    && payload?.link === JOIN_US_PAGE_URL
    && payload?.template === 'template-joinus.php'
    && normalizeTextForMatching(content).includes('If your heart beats for education and you want to be part of a revolution')
    && /noindex,\s*nofollow/i.test(yoastHead)
}

export const extractCareerLikeUrlsFromPageSitemap = (pageSitemapXml = '') => (
  [...String(pageSitemapXml ?? '').matchAll(/<loc>(https:\/\/www\.embibe\.com\/in-en\/[^<]+)<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url) => /\/(?:joinus|careers?|jobs?|work-with-us|openings)(?:\/|$)/i.test(url))
)

export const hasExpectedSitemapIndexSignal = (sitemapIndexXml = '') => {
  const rawXml = String(sitemapIndexXml ?? '')

  return /<loc>https:\/\/www\.embibe\.com\/in-en\/page-sitemap\.xml<\/loc>/i.test(rawXml)
    && /<loc>https:\/\/www\.embibe\.com\/in-en\/help-sitemap\.xml<\/loc>/i.test(rawXml)
    && !/\/(?:joinus|careers?|jobs?|work-with-us|openings)(?:\/|<)/i.test(rawXml)
}

export const hasExpectedPageSitemapSignal = (pageSitemapXml = '') => {
  const rawXml = String(pageSitemapXml ?? '')

  return /<loc>https:\/\/www\.embibe\.com\/in-en\/home\/<\/loc>/i.test(rawXml)
    && /<loc>https:\/\/www\.embibe\.com\/in-en\/contactus\/<\/loc>/i.test(rawXml)
    && extractCareerLikeUrlsFromPageSitemap(rawXml).length === 0
}

export const createEmbibeScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
  darwinboxScraper = createConfiguredDarwinboxScraper(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    fetchListingPage,
  } = {}) {
    const rootPage = await fetchPage(ROOT_URL)

    if (rootPage.status !== 200 || !hasRootSiteShellSignal(rootPage.html)) {
      throw new Error('Embibe verified root homepage shell no longer matches the known first-party surface')
    }

    const rootCareersPage = await fetchPage(ROOT_CAREERS_URL)

    if (![200, 404].includes(rootCareersPage.status) || !hasRootSiteShellSignal(rootCareersPage.html)) {
      throw new Error('Embibe verified root careers route no longer matches the known first-party surface')
    }

    const marketingHomepage = await fetchPage(HOMEPAGE_URL)

    if (marketingHomepage.status !== 200 || !hasOfficialMarketingHomepageSignal(marketingHomepage.html)) {
      throw new Error('Embibe verified marketing homepage no longer matches the known first-party surface')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)

    if (contactPage.status !== 200 || !hasOfficialContactPageSignal(contactPage.html)) {
      throw new Error('Embibe verified contact page no longer matches the known first-party surface')
    }

    const joinUsPage = await fetchPage(JOIN_US_PAGE_URL)

    if (joinUsPage.status !== 200 || !hasJoinUsPageSignal(joinUsPage.html)) {
      throw new Error('Embibe verified join us page no longer matches the known first-party surface')
    }

    const joinUsApiPayload = await fetchJson(JOIN_US_API_URL)

    if (!hasJoinUsApiSignal(joinUsApiPayload)) {
      throw new Error('Embibe verified join us API no longer matches the known first-party surface')
    }

    const sitemapIndexPage = await fetchPage(SITEMAP_INDEX_URL)

    if (sitemapIndexPage.status !== 200 || !hasExpectedSitemapIndexSignal(sitemapIndexPage.html)) {
      throw new Error('Embibe verified sitemap index no longer matches the known first-party surface')
    }

    const pageSitemapPage = await fetchPage(PAGE_SITEMAP_URL)

    if (pageSitemapPage.status !== 200 || !hasExpectedPageSitemapSignal(pageSitemapPage.html)) {
      throw new Error('Embibe verified page sitemap career surface changed')
    }

    const jobs = await darwinboxScraper.run({
      maxPages,
      maxJobs,
      fetchListingPage,
    })
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createEmbibeScraper().run(options)

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
