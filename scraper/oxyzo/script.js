import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import OXYZO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MAX_CATEGORY_PAGES = 20

export const SOURCE = OXYZO_CATALOG.source
export const COMPANY = OXYZO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OXYZO_CATALOG.officialBrandName
export const VERIFIED_ON = OXYZO_CATALOG.verifiedOn
export const PROVIDER_METADATA = OXYZO_CATALOG
export const HOMEPAGE_URL = OXYZO_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = OXYZO_CATALOG.companyCareerPage
export const JOB_PAGE_PREFIX = OXYZO_CATALOG.jobPagePrefix
export const PAGINATION_QUERY_PARAM = OXYZO_CATALOG.paginationQueryParam

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
) || ''

const htmlToLines = (html = '') => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, '\n')
  .replace(/<style[\s\S]*?<\/style>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(h[1-6]|p|li|div|section|article|a|span|strong|em|ul|ol|form|label|button)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const sameHost = (url, expectedHost) => {
  try {
    const actual = new URL(url)
    return actual.hostname.replace(/^www\./i, '').toLowerCase() === expectedHost.toLowerCase()
  } catch {
    return false
  }
}

const extractHeadings = (html = '') => (
  [...String(html ?? '').matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
)

const extractSectionText = (lines = []) => {
  const aboutIndex = lines.findIndex((line) => /^About the Business$/i.test(line))
  if (aboutIndex < 0) return null

  const applicationIndex = lines.findIndex((line) => /^Application Form$/i.test(line))
  const endIndex = applicationIndex > aboutIndex ? applicationIndex : lines.length
  const slice = lines.slice(aboutIndex, endIndex)

  return slice.length > 0 ? slice.join('\n') : null
}

const buildCity = (location) => normalizeWhitespace(location)?.split(/[\/,]/)[0]?.trim() || null

export const buildCategoriesPageUrl = (pageNumber) => (
  Number(pageNumber) <= 1
    ? CAREERS_PAGE_URL
    : `${CAREERS_PAGE_URL}?${PAGINATION_QUERY_PARAM}=${Number(pageNumber)}`
)

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const lines = htmlToLines(rawHtml)
  const text = lines.join(' ')

  return /<title>\s*Work at Oxyzo - Shape the Future of Fintech\s*<\/title>/i.test(rawHtml)
    && text.includes('Careers @ Oxyzo')
    && text.includes('Explore Roles')
    && text.includes('career@oxyzo.in')
  }

export const hasOfficialCategoriesSignal = (html = '') => {
  const lines = htmlToLines(html)
  const text = lines.join(' ')

  return text.includes('Area Sales Manager - SME Lending')
    && text.includes('Business Development Manager')
    && text.includes('Posting:')
    && text.includes('View Details')
    && /https:\/\/www\.oxyzocareers\.in\/jobs\//i.test(String(html ?? ''))
  }

export const extractJobDetailUrls = (html = '') => {
  const matches = String(html ?? '').match(/https:\/\/www\.oxyzocareers\.in\/jobs\/[^"'\\\s<]+/gi) || []
  const seen = new Set()
  const urls = []

  for (const match of matches) {
    const normalized = normalizeWhitespace(match)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
  }

  return urls
}

export const extractJobFromDetailPage = (html = '', sourceUrl = '') => {
  const headings = extractHeadings(html)
  const lines = htmlToLines(html)

  const title = headings[0] || null
  const department = headings[1] || null

  const departmentIndex = department ? lines.indexOf(department) : -1
  const employmentType = departmentIndex >= 0 ? normalizeWhitespace(lines[departmentIndex + 1]) : null
  const experienceRequired = departmentIndex >= 0 ? normalizeWhitespace(lines[departmentIndex + 2]) : null
  const location = departmentIndex >= 0 ? normalizeWhitespace(lines[departmentIndex + 3]) : null

  const jobIdIndex = lines.findIndex((line) => /^Job ID:?$/i.test(line))
  const jobId = jobIdIndex >= 0 ? normalizeWhitespace(lines[jobIdIndex + 1]) : null
  const jobDescription = extractSectionText(lines)

  if (!title || !department || !employmentType || !location) {
    throw new Error(`The verified Oxyzo job detail page changed materially: ${sourceUrl || 'unknown-url'}`)
  }

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: buildCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
  }
}

export const createOxyzoScraper = ({
  now = () => new Date().toISOString(),
  maxPages = MAX_CATEGORY_PAGES,
  delayMs = 250,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    wait = defaultWait,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('The verified official Oxyzo homepage changed materially')
    }

    const jobUrls = []
    const seenUrls = new Set()

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      if (pageNumber > 1 && delayMs > 0) {
        await wait(delayMs)
      }

      const pageHtml = await fetchText(buildCategoriesPageUrl(pageNumber))

      if (pageNumber === 1 && !hasOfficialCategoriesSignal(pageHtml)) {
        throw new Error('The verified Oxyzo careers listing surface changed materially')
      }

      const pageJobUrls = extractJobDetailUrls(pageHtml)
      if (pageJobUrls.length === 0) {
        if (pageNumber === 1) {
          throw new Error('The verified Oxyzo careers listing surface changed materially')
        }
        break
      }

      for (const jobUrl of pageJobUrls) {
        if (!jobUrl.startsWith(JOB_PAGE_PREFIX) || seenUrls.has(jobUrl)) continue
        seenUrls.add(jobUrl)
        jobUrls.push(jobUrl)
      }
    }

    const scrapedAt = now()
    const jobs = []

    for (const jobUrl of jobUrls) {
      if (delayMs > 0) {
        await wait(delayMs)
      }

      const detailHtml = await fetchText(jobUrl)
      jobs.push({
        ...extractJobFromDetailPage(detailHtml, jobUrl),
        source: SOURCE,
        link: jobUrl,
        scrapedAt,
        companyCareerPage: CAREERS_PAGE_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createOxyzoScraper(options).run(options)

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
