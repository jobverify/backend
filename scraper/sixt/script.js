import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SIXT_CATALOG from './catalog.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { collectCurrentSixt, readCurrentSixtRole } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = SIXT_CATALOG.source
export const COMPANY_NAME = SIXT_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SIXT_CATALOG.officialBrandName
export const VERIFIED_ON = SIXT_CATALOG.verifiedOn
export const PROVIDER_METADATA = SIXT_CATALOG
export const INDIA_JOBS_URL = SIXT_CATALOG.companyCareerPage
export const DETAIL_PAGE_PREFIX = SIXT_CATALOG.detailPagePrefix

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const defaultFetchPage = (url, signal) => fetchTextWithRetry(url, {
  includeResponseMetadata: true, signal,
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  label: SOURCE, timeoutMs: 15000,
})

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const stripTags = (value) => decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeWhitespace = (value) => stripTags(value).replace(/\s+/g, ' ').trim()

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, 'https://www.sixt.jobs').toString()
  } catch {
    return null
  }
}

const toIsoDate = (value) => {
  const match = normalizeWhitespace(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export const hasOfficialJobsPageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const rawHtml = String(html ?? '')

  return normalized.includes('all jobs | sixt jobs')
    && normalized.includes('join team orange in india!')
    && /\bjob(?:s)? located in india\b/i.test(normalized)
    && /href=["'][^"']*\/in\/jobs\/[0-9a-f-]{36}["']/i.test(rawHtml)
}

export const extractVisibleJobLinks = (html) => {
  const rawHtml = String(html ?? '')
  const seen = new Set()

  return Array.from(
    rawHtml.matchAll(/<a\b[^>]*href=["']([^"']*\/in\/jobs\/[0-9a-f-]{36})["'][^>]*>([\s\S]*?)<\/a>/gi),
  )
    .map((match) => {
      const sourceUrl = toAbsoluteUrl(match[1])
      const title = normalizeWhitespace(match[2])
      if (!sourceUrl || !title || title.toLowerCase() === 'view') return null
      if (seen.has(sourceUrl)) return null
      seen.add(sourceUrl)

      return {
        jobId: sourceUrl.split('/').filter(Boolean).at(-1) ?? null,
        title,
        sourceUrl,
        applyUrl: sourceUrl,
      }
    })
    .filter(Boolean)
}

export const hasOfficialJobDetailSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return normalized.includes('| sixt jobs')
    && normalized.includes('apply now')
    && normalized.includes('your role at sixt')
    && normalized.includes('your skills matter')
    && (
      normalized.includes('what we offer')
      || normalized.includes('about us')
    )
}

const extractDescription = (html) => {
  const rawHtml = String(html ?? '')
  const afterApplyMatch = rawHtml.match(/Apply now<\/a>\s*<p>([\s\S]*?)<\/p>/i)
  if (afterApplyMatch?.[1]) return normalizeWhitespace(afterApplyMatch[1])

  const paragraphMatches = Array.from(rawHtml.matchAll(/<p>([\s\S]*?)<\/p>/gi))
  for (const match of paragraphMatches) {
    const text = normalizeWhitespace(match[1])
    if (text && !/^postet on\b/i.test(text)) return text
  }

  return null
}

export const extractJobDetail = (html, listing = {}) => {
  const rawHtml = String(html ?? '')
  const title =
    normalizeWhitespace(rawHtml.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1])
    || listing.title
    || null
  const detailText = normalizeWhitespace(rawHtml)
  const department =
    normalizeWhitespace(rawHtml.match(/<p>\s*([^<]+?)\s*<\/p>\s*<p>\s*(?:Full-time|Part-time|Contract|Internship)/i)?.[1])
    || null
  const employmentType = detailText.match(/\b(Full-time|Part-time|Contract|Internship)\b/i)?.[1] ?? null
  const location = normalizeWhitespace(detailText.match(/\b(?:Full-time|Part-time|Contract|Internship)\s+([^#]+?,\s*India)\b/i)?.[1]) || null
  const city = location?.split(',')[0]?.trim() || null
  const postingDate = toIsoDate(detailText.match(/Postet on\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1] ?? null)
  const jobDescription = extractDescription(rawHtml)

  return {
    jobId: listing.jobId ?? null,
    title,
    department,
    location,
    city,
    country: location && /\bindia\b/i.test(location) ? 'India' : null,
    employmentType,
    postingDate,
    jobDescription,
    sourceUrl: listing.sourceUrl ?? null,
    applyUrl: listing.applyUrl ?? listing.sourceUrl ?? null,
  }
}

export const createSixtScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const { fetchText = defaultFetchText, signal } = options
    const readPage = options.fetchPage || (options.fetchText
      ? async url => ({ status: 200, url, html: await fetchText(url) })
      : url => defaultFetchPage(url, signal))
    signal?.throwIfAborted()
    const listPage = await readPage(INDIA_JOBS_URL)
    const listHtml = listPage.html
    if (!hasOfficialJobsPageSignal(listHtml)) {
      throw new Error('Response is not the verified Sixt India jobs page')
    }

    const visibleJobs = extractVisibleJobLinks(listHtml)
    if (visibleJobs.length === 0) {
      throw new Error('The verified Sixt India jobs page no longer exposes public job links')
    }

    const selectedJobs = maxJobs ? visibleJobs.slice(0, maxJobs) : visibleJobs
    const scrapedAt = now()
    const jobs = []
    const firstPage = await readPage(selectedJobs[0].sourceUrl)
    if (readCurrentSixtRole(firstPage, selectedJobs[0], scrapedAt)) {
      return collectCurrentSixt({ listPage, firstPage, readPage, maxJobs, now: () => scrapedAt, signal })
    }

    for (const listing of selectedJobs) {
      const detailHtml = listing.sourceUrl === selectedJobs[0].sourceUrl ? firstPage.html : (await readPage(listing.sourceUrl)).html
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error('Response is not the verified Sixt job detail page')
      }

      const detail = extractJobDetail(detailHtml, listing)
      jobs.push({
        title: detail.title,
        company: COMPANY_NAME,
        department: detail.department,
        location: detail.location,
        city: detail.city,
        country: detail.country,
        jobId: detail.jobId,
        requisitionId: null,
        sourceUrl: detail.sourceUrl,
        applyUrl: detail.applyUrl,
        employmentType: detail.employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: detail.postingDate,
        closingDate: null,
        jobDescription: detail.jobDescription,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSixtScraper(options).run(options)

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
