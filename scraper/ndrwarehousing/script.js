import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { NDR_WAREHOUSING_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NDR_WAREHOUSING_CATALOG
export const SOURCE = NDR_WAREHOUSING_CATALOG.source
export const COMPANY = NDR_WAREHOUSING_CATALOG.companyName
export const VERIFIED_ON = NDR_WAREHOUSING_CATALOG.verifiedOn
export const HOMEPAGE_URL = NDR_WAREHOUSING_CATALOG.officialHomepageUrl
export const CONTACT_PAGE_URL = NDR_WAREHOUSING_CATALOG.officialContactPageUrl
export const NO_PUBLIC_CAREERS_ROUTE_URLS = NDR_WAREHOUSING_CATALOG.noPublicCareersRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob postings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*NDR WAREHOUSING\s*<\/title>/i.test(page)
    && normalized.includes('leading warehousing companies')
    && normalized.includes('industrial space demands')
    && /href=["']contact\.html["']/i.test(page)
    && /info@ndrwarehousing\.com/i.test(page)
}

export const hasVerifiedContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes("let's talk")
    && normalized.includes('name')
    && normalized.includes('email address')
    && normalized.includes('your company')
    && normalized.includes('enquiry type')
    && normalized.includes('region')
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && normalized.includes('the requested url was not found on this server.')
    && !hasPublicJobsSignal(html)
}

export const createNdrWarehousingScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('NDR Warehousing verified homepage no longer matches the official first-party surface')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)
    if (
      contactPage.status !== 200
      || !hasVerifiedContactSignal(contactPage.html)
      || hasPublicJobsSignal(contactPage.html)
    ) {
      throw new Error('NDR Warehousing verified contact page no longer matches the official first-party surface')
    }

    for (const url of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const page = await fetchPage(url)
      if (!isVerifiedMissingCareerRoute(page)) {
        throw new Error(`NDR Warehousing no-public-careers route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNdrWarehousingScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
