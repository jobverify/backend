import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BOOK_MY_SHOW_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BOOK_MY_SHOW_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_LISTING_URL = PROVIDER_METADATA.jobListingUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractLikelyJobLinks = (html) => {
  const links = []

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = String(match[1] ?? '')
    const text = normalizeWhitespace(match[2])
    const loweredHref = href.toLowerCase()

    if (
      /\/careers\/job(?!-listing)\b/i.test(loweredHref)
      || /\/jobs\/[^"'#]+/i.test(loweredHref)
      || /\/job\/[^"'#]+/i.test(loweredHref)
      || /\/openings\/[^"'#]+/i.test(loweredHref)
    ) {
      links.push({
        href,
        text,
      })
    }
  }

  return links
}

export const hasCloudflareBlockSignal = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(status) === 403
    && (url === CAREERS_URL || url === JOB_LISTING_URL)
    && normalized.includes('attention required!')
    && normalized.includes('sorry, you have been blocked')
    && normalized.includes('you are unable to access bookmyshow.com')
    && normalized.includes('cloudflare ray id')
}

const hasStructuredJobPostingSignal = (html) =>
  /["']@type["']\s*:\s*["']JobPosting["']|itemtype=["']https?:\/\/schema\.org\/JobPosting["']/i.test(
    String(html ?? ''),
  )

export const hasVerifiedCareersShell = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers Opportunities, Current Job Openings[^<]*BookMyShow\s*<\/title>/i.test(rawHtml)
    && /Make Your Career/i.test(normalized)
    && /A Box-Office Hit\./i.test(normalized)
    && /See Where You Fit In/i.test(normalized)
    && /Confused where to start\? Search jobs by location or team/i.test(normalized)
    && /Choose A Location/i.test(normalized)
    && /Choose A Team/i.test(normalized)
    && /Current Opening/i.test(normalized)
    && /Bigtree Entertainment Pvt\. Ltd/i.test(normalized)
}

export const hasVerifiedEmptyJobListingShell = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers Opportunities, Current Job Openings[^<]*BookMyShow\s*<\/title>/i.test(rawHtml)
    && /Home Careers job Listing/i.test(normalized)
    && /Privacy Note/i.test(normalized)
    && /List your Show/i.test(normalized)
    && /Upcoming Movies/i.test(normalized)
    && /Movies Now Showing/i.test(normalized)
    && /Current Opening/i.test(normalized)
    && !/Make Your Career/i.test(normalized)
    && !/Choose A Location/i.test(normalized)
    && !hasStructuredJobPostingSignal(rawHtml)
    && extractLikelyJobLinks(rawHtml).length === 0
}

export const createBookMyShowScraper = () => ({
  async run({ fetchPage: providedFetch = defaultFetchPage, signal, onAudit, now = () => new Date().toISOString() } = {}) {
    const fetchPage = async url => {
      signal?.throwIfAborted()
      const response = await providedFetch(url, { signal })
      signal?.throwIfAborted()
      if (response?.url !== url) throw new Error('BookMyShow current first-party response identity changed')
      return response
    }
    const careersPage = await fetchPage(CAREERS_URL)
    const jobListingPage = await fetchPage(JOB_LISTING_URL)

    if ([careersPage, jobListingPage].some(page => Number(page.status) === 403)) {
      const evidence = { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false,
        pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(), reason: 'official-india-public-recruiting-access-blocked' }
      await onAudit?.({ source: SOURCE, observations: [{ url: CAREERS_URL, status: careersPage.status },
        { url: JOB_LISTING_URL, status: jobListingPage.status }], inventoryEvidence: evidence, productionWrites: false })
      signal?.throwIfAborted()
      throw Object.assign(new Error('BookMyShow official India public recruiting access blocked; inventory unavailable'),
        { code: 'BOOKMYSHOW_PUBLIC_ACCESS_BLOCKED', status: 403 })
    }

    if (careersPage.status !== 200 || !hasVerifiedCareersShell(careersPage.html)) {
      throw new Error('BookMyShow verified first-party careers page no longer matches the known public surface')
    }

    if (extractLikelyJobLinks(jobListingPage.html).length > 0 || hasStructuredJobPostingSignal(jobListingPage.html)) {
      throw new Error('BookMyShow job listing surface now appears to expose public job links')
    }

    if (jobListingPage.status !== 200 || !hasVerifiedEmptyJobListingShell(jobListingPage.html)) {
      throw new Error('BookMyShow verified job listing surface no longer matches the known empty-shell contract')
    }

    const jobs = [], evidence = { status: 'coverage-gap', surface: JOB_LISTING_URL, firstParty: true, listingComplete: false,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(), reason: 'listing-shell-without-count-checked-native-india-inventory' }
    attachInventoryEvidence(jobs, evidence)
    await onAudit?.({ source: SOURCE, observations: [], inventoryEvidence: evidence, productionWrites: false })
    signal?.throwIfAborted()
    return jobs
  },
})

export const run = async (options = {}) => createBookMyShowScraper().run(options)

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
