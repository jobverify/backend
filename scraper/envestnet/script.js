import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'envestnet'
export const COMPANY = 'Envestnet'
export const INDIA_SEARCH_URL = 'https://careers.envestnet.com/search/jobs/in/country/india'
export const SEARCH_URL = 'https://careers.envestnet.com/search/jobs'
export const DETAIL_URL_PATTERN = /^https:\/\/careers\.envestnet\.com\/jobs\/(\d+)-/i
export const VERIFIED_LISTING_TITLE = 'India Careers'
export const VERIFIED_LISTING_SIGNALS = [
  'Job Search Results',
  'Set up job alerts',
  'Showing 1-',
  'of',
  'result(s)',
]
export const VERIFIED_DETAIL_SIGNAL = 'Description'

const NAVIGATION_TIMEOUT_MS = 45000

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const splitLines = (value) => String(value ?? '')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const uniqueBy = (items, getKey) => {
  const seen = new Set()
  const results = []

  for (const item of items) {
    const key = getKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    results.push(item)
  }

  return results
}

const buildListingPageUrl = (pageNumber = 1) => (
  pageNumber <= 1
    ? INDIA_SEARCH_URL
    : `${INDIA_SEARCH_URL}?page=${pageNumber}`
)

const extractJobIdFromUrl = (value) => normalizeWhitespace(
  String(value ?? '').match(DETAIL_URL_PATTERN)?.[1],
)

const extractCity = (location) => normalizeWhitespace(
  String(location ?? '').split(',')[0],
)

const parseTotalResults = (text) => {
  const match = String(text ?? '').match(/Showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)\s+result\(s\)/i)
  return match ? Number.parseInt(match[1], 10) : null
}

const stripTagsToText = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const extractPageLinks = (html = '', baseUrl = SEARCH_URL) => [...String(html ?? '').matchAll(
  /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => ({
    text: normalizeWhitespace(match[2]) || '',
    href: new URL(match[1], baseUrl).toString(),
  }))

const buildPageDataFromHtml = (html = '', url = SEARCH_URL) => ({
  url,
  title: normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
  text: stripTagsToText(html),
  links: extractPageLinks(html, url),
})

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    Referer: SEARCH_URL,
  },
  label: SOURCE,
  timeoutMs: NAVIGATION_TIMEOUT_MS,
})

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = normalizeWhitespace(html) || ''

  return Number(page.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /challenges\.cloudflare\.com/i.test(html)
    && text.includes('Enable JavaScript and cookies to continue')
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && getHeader(page, 'cf-mitigated').toLowerCase() === 'challenge'
    && hasVerifiedCloudflareChallengeSignal(page)
}

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  headers: {},
  html: await fetchText(url),
})

export const hasVerifiedIndiaListingSurface = (pageData) => {
  const title = normalizeWhitespace(pageData?.title)
  const text = String(pageData?.text ?? '')
  const jobLinks = extractListingJobLinks(pageData)

  return title === VERIFIED_LISTING_TITLE
    && VERIFIED_LISTING_SIGNALS.every((signal) => text.includes(signal))
    && jobLinks.length > 0
}

export const extractListingJobLinks = (pageData) => uniqueBy(
  (Array.isArray(pageData?.links) ? pageData.links : [])
    .map((link) => ({
      title: normalizeWhitespace(link?.text),
      url: normalizeWhitespace(link?.href),
    }))
    .filter((link) => link.title && DETAIL_URL_PATTERN.test(link.url || '')),
  (link) => link.url,
)

export const hasVerifiedDetailSurface = (pageData) => {
  const title = normalizeWhitespace(pageData?.title)
  const text = String(pageData?.text ?? '')

  return Boolean(title)
    && title.includes(' in ')
    && text.includes(VERIFIED_DETAIL_SIGNAL)
    && text.includes('Apply Now')
}

const extractSectionText = ({ lines, startLabel, endLabels = [] }) => {
  const startIndex = lines.findIndex((line) => line === startLabel)
  if (startIndex < 0) return null

  const collected = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endLabels.includes(line)) break
    collected.push(line)
  }

  return normalizeWhitespace(collected.join(' '))
}

export const extractJobFromDetailPage = (pageData) => {
  if (!hasVerifiedDetailSurface(pageData)) {
    throw new Error('Envestnet job detail page no longer matches the verified public surface')
  }

  const sourceUrl = normalizeWhitespace(pageData?.url)
  const title = normalizeWhitespace(
    String(pageData?.title ?? '').replace(/\s+in\s+.+$/i, ''),
  )
  const lines = splitLines(pageData?.text)
  const location = normalizeWhitespace(
    lines.find((line) => line.startsWith('Location:'))?.replace(/^Location:\s*/i, ''),
  )
  const postingDate = normalizeWhitespace(
    lines.find((line) => line.startsWith('Date Posted:'))?.replace(/^Date Posted:\s*/i, ''),
  )
  const jobId = extractJobIdFromUrl(sourceUrl)
  const description = extractSectionText({
    lines,
    startLabel: 'Description',
    endLabels: [
      'Share:',
      'Apply Now',
      'Save Job',
      'Our Investment in You',
      'Our Commitment to Inclusion & Belonging',
      'Join our Talent Network',
    ],
  })

  if (!title || !location || !jobId) {
    throw new Error('Envestnet job detail page is missing required job fields')
  }

  if (!/india/i.test(location)) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: description,
  }
}

export const createEnvestnetScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    maxPages = 5,
    fetchPage,
    fetchText,
    collectPageDataImpl,
  } = {}) {
    const effectiveFetchPage = typeof fetchPage === 'function'
      ? fetchPage
      : typeof fetchText === 'function'
        ? createFetchPageFromText(fetchText)
        : defaultFetchPage

    const listingLinks = []

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageUrl = buildListingPageUrl(pageNumber)
      let pageData

      if (collectPageDataImpl) {
        pageData = await collectPageDataImpl(pageUrl)
      } else {
        const page = await effectiveFetchPage(pageUrl)

        if (isVerifiedCloudflareChallengedPage(page, pageUrl)) {
          if (pageNumber === 1) {
            return []
          }

          throw new Error('Envestnet India jobs pagination is now challenge-gated before all results can be verified')
        }

        pageData = buildPageDataFromHtml(getPageHtml(page), page.url || pageUrl)
      }

      if (!hasVerifiedIndiaListingSurface(pageData)) {
        throw new Error('Envestnet India jobs page no longer matches the verified public surface')
      }

      const pageLinks = extractListingJobLinks(pageData)
      if (pageLinks.length === 0) break

      listingLinks.push(...pageLinks)

      const totalResults = parseTotalResults(pageData.text)
      if (Number.isInteger(totalResults) && listingLinks.length >= totalResults) {
        break
      }

      if (pageLinks.length < 25) {
        break
      }
    }

    const uniqueLinks = uniqueBy(listingLinks, (job) => job.url)
    const selectedLinks = Number.isInteger(maxJobs)
      ? uniqueLinks.slice(0, maxJobs)
      : uniqueLinks

    const jobs = []

    for (const listing of selectedLinks) {
      let detailPageData

      if (collectPageDataImpl) {
        detailPageData = await collectPageDataImpl(listing.url)
      } else {
        const detailPage = await effectiveFetchPage(listing.url)

        if (isVerifiedCloudflareChallengedPage(detailPage, listing.url)) {
          throw new Error('Envestnet job detail page is now challenge-gated before the verified public fields can be extracted')
        }

        detailPageData = buildPageDataFromHtml(getPageHtml(detailPage), detailPage.url || listing.url)
      }

      const job = extractJobFromDetailPage(detailPageData)
      if (!job) continue

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createEnvestnetScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Envestnet scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
