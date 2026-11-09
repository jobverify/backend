import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { APEX_IMPORTS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APEX_IMPORTS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = PROVIDER_METADATA.careersRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasMovedHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Apex Imports/i.test(rawHtml)
    && /Apex Imports/i.test(normalized)
    && /\bmoved\b|\bvisit\b/i.test(normalized)
    && (
      /Hanna Imports/i.test(normalized)
      || /SHOP USED CARS/i.test(normalized)
      || /Raleigh NC/i.test(normalized)
    )
    && (
      /Sanford Imports/i.test(normalized)
      || /Sanford\s*(?:&nbsp;|\s)*NC/i.test(rawHtml)
      || /Sanford NC/i.test(normalized)
    )
}

export const hasRobotsTxtNoCareersSignal = (text = '') =>
  /User-agent:/i.test(String(text ?? ''))
  && !/\bcareers?\b|\bjobs?\b|join-us|work-with-us|openings|greenhouse|lever|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|successfactors|oraclecloud|darwinbox|icims|taleo|peoplestrong/i.test(
    String(text ?? ''),
  )

export const isVerifiedMissingRoute = (page = {}, requestedUrl) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 404
    && getFinalUrl(page, requestedUrl) === requestedUrl
    && /\b404\b|not found|page not found/i.test(normalized)
    && !pageExposesPublicJobListings(rawHtml)
}

export const createApexImportsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !hasMovedHomepageSignal(homepage.html)
      || pageExposesPublicJobListings(homepage.html)
    ) {
      throw new Error('Apex Imports verified moved homepage no longer matches the trusted first-party surface')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxt.status !== 200 || !hasRobotsTxtNoCareersSignal(robotsTxt.html)) {
      throw new Error('Apex Imports robots.txt now advertises a careers surface or no longer matches the trusted snapshot')
    }

    const sitemapRoute = await fetchPage(SITEMAP_URL)
    if (!isVerifiedMissingRoute(sitemapRoute, SITEMAP_URL)) {
      throw new Error('Apex Imports verified missing sitemap route changed materially or now exposes public jobs')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage, routeUrl)) {
        throw new Error(`Apex Imports verified missing careers route changed materially or now exposes public jobs: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createApexImportsScraper().run(options)

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
