import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ONETRUST_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ONETRUST_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractJobId = (url) => {
  const fromDetailSlug = String(url).match(/-(\d+)\/?$/)
  if (fromDetailSlug) return fromDetailSlug[1]

  const fromApplyUrl = String(url).match(/\/jobs\/(\d+)/)
  return fromApplyUrl?.[1] || null
}

const extractApplyUrl = (html = '', sourceUrl) => {
  for (const match of String(html).matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/gi,
  )) {
    const url = buildAbsoluteUrl(match[1])
    if (url) return url
  }

  return sourceUrl
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html)
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return rawHtml.includes('greenhousejoblister')
    && rawHtml.includes('greenhouse-job-list')
    && rawHtml.includes('greenhouse-location-dropdown')
    && /data-total-job-found=["']\d+["']/i.test(rawHtml)
    && normalized.includes('careers')
}

export const extractVisibleDetailUrls = (html = '') => {
  const urls = []
  const seen = new Set()

  for (const match of String(html).matchAll(/<a[^>]+href=["']([^"']*\/careers\/[^"']+)["']/gi)) {
    const url = buildAbsoluteUrl(match[1])
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const extractJobFromDetailPage = (sourceUrl, html = '') => {
  const title = normalizeWhitespace(
    String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  )
  const metaMatch = String(html).match(/<p[^>]*>\s*([^<]+?)\s*\|\s*([^<]+?)\s*<\/p>/i)
  const location = normalizeWhitespace(metaMatch?.[1])
  const department = normalizeWhitespace(metaMatch?.[2])
  const applyUrl = extractApplyUrl(html, sourceUrl)
  const jobId = extractJobId(sourceUrl) || extractJobId(applyUrl)
  const description = stripTags(
    String(html).match(/<div[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
  )

  return {
    title,
    company: PROVIDER_METADATA.companyName,
    department,
    location,
    city: location?.split(',')[0]?.trim() || null,
    country: /india/i.test(location || '') ? 'India' : null,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

export const createOneTrustScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('One Trust careers page no longer matches the verified first-party public jobs surface')
    }

    const detailUrls = extractVisibleDetailUrls(careersHtml)
    const detailPages = await Promise.all(detailUrls.map(async (url) => ({
      url,
      html: await fetchText(url),
    })))

    return detailPages
      .map(({ url, html }) => extractJobFromDetailPage(url, html))
      .filter((job) => job.country === 'India')
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
  },
})

export const run = async (options = {}) => createOneTrustScraper().run(options)

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
