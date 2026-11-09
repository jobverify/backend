import path from 'node:path'
import { fileURLToPath } from 'node:url'

import DECIMAL_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DECIMAL_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const COMMON_CAREERS_ROUTE_URLS = [
  'https://decimaltech.com/careers',
  'https://decimaltech.com/career',
  'https://decimaltech.com/jobs',
  'https://decimaltech.com/join-us',
  'https://decimaltech.com/company/careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bsearch all jobs\b/i,
  /\bjobdetails\/\d+/i,
  /\bapplyjob\/\d+/i,
  /(greenhouse|lever|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|ashbyhq|keka|talismatic|dayforce)/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
  } catch {
    return false
  }
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

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractSitemapUrls = (xml = '') =>
  [...String(xml).matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1])

export const hasExpectedHomepageSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('AI Platform for')
    && text.includes('Intelligent Banking')
    && !pageExposesPublicJobListings(html)
}

export const hasExpectedRobotsTxtSignal = (text = '') => {
  const normalized = String(text ?? '')
  return /User-agent:\s*\*/i.test(normalized)
    && /Sitemap:\s*https:\/\/decimaltech\.com\/sitemap\.xml/i.test(normalized)
}

export const sitemapExposesCareerUrls = (xml = '') =>
  extractSitemapUrls(xml).some((url) => /\/(careers?|jobs?|join-us)(\/|$)/i.test(url))

export const createDecimalTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, HOMEPAGE_URL)
      || !hasExpectedHomepageSignal(homepage.html)
    ) {
      throw new Error('Decimal Technologies verified homepage changed materially')
    }

    const robots = await fetchPage(ROBOTS_TXT_URL)
    if (Number(robots.status) !== 200 || !hasExpectedRobotsTxtSignal(robots.html)) {
      throw new Error('Decimal Technologies verified robots.txt changed materially')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (Number(sitemap.status) !== 200 || sitemapExposesCareerUrls(sitemap.html)) {
      throw new Error('Decimal Technologies verified sitemap changed materially')
    }

    for (const routeUrl of COMMON_CAREERS_ROUTE_URLS) {
      const route = await fetchPage(routeUrl)
      if (Number(route.status) !== 404 || pageExposesPublicJobListings(route.html)) {
        throw new Error(`Decimal Technologies verified no-public-careers route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createDecimalTechnologiesScraper().run(options)

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
