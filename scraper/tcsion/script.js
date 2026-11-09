import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TCS_ION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = TCS_ION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SAMPLE_MARKETPLACE_LISTING_URL = PROVIDER_METADATA.sampleMarketplaceListingUrl

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '/')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

const extractFeaturedCompaniesScope = (html = '') =>
  String(html ?? '').match(/<section[^>]*class="[^"]*\bhiringSection\b[^"]*"[^>]*>([\s\S]*?)<\/section>/i)?.[1]
  || String(html ?? '')

export const extractFeaturedCompanyNames = (html = '') =>
  [...extractFeaturedCompaniesScope(html).matchAll(/<h4[^>]*>([^<]+)<\/h4>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

export const hasOfficialJobsMarketplaceSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasMarketplaceSearchSignal =
    normalized.includes('Search by Job Role, Company, or Skills')
    || normalized.includes('Unlock Career Opportunities with AI Precision Matching')
    || normalized.includes('Get the Right Job Faster')

  return /<title>\s*TCS iON Jobs:\s*Explore opportunities and give your career a boost\s*<\/title>/i.test(page)
    && hasMarketplaceSearchSignal
    && normalized.includes('Find the Best-suited Jobs for You')
    && normalized.includes('Explore opportunities from leading companies and give your career a boost.')
    && normalized.includes('Featured Companies Hiring')
}

export const marketplaceAppearsGenericMultiCompany = (html = '') => {
  if (!hasOfficialJobsMarketplaceSignal(html)) return false

  const companies = extractFeaturedCompanyNames(html)
  return companies.length >= 3 && companies.every((name) => !/tcs\s*ion/i.test(name))
}

export const marketplaceExposesExactNameJobs = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /\bCompany:\s*TCS iON\b/i.test(normalized)
    || /\bPosted by:\s*TCS iON\b/i.test(normalized)
    || /https:\/\/www\.tcsion\.com\/job-openings\/[^"'<>]*tcs[-\s]*ion/i.test(String(html ?? ''))
    || /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? '')) && /TCS iON/i.test(normalized)
}

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'UND_ERR_CONNECT_TIMEOUT'
    || /\bconnect timeout\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

export const createTcsIonScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const careersPage = await fetchPage(CAREERS_URL)

      if (Number(careersPage.status) !== 200 || !matchesExpectedUrl(careersPage.url, CAREERS_URL)) {
        throw new Error('TCS iON verified jobs marketplace changed materially')
      }

      if (marketplaceExposesExactNameJobs(careersPage.html)) {
        throw new Error('TCS iON marketplace now appears to expose exact-name public jobs')
      }

      if (
        !hasOfficialJobsMarketplaceSignal(careersPage.html)
        || !marketplaceAppearsGenericMultiCompany(careersPage.html)
      ) {
        throw new Error('TCS iON verified jobs marketplace changed materially')
      }

      return []
    } catch (error) {
      if (hasConnectTimeoutFailure(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createTcsIonScraper().run(options)

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
