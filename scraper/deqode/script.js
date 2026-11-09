import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DEQODE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_JOB_DETAIL_URL = PROVIDER_METADATA.verifiedSampleJobUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const JOB_DETAIL_HREF_PATTERN =
  /href=["']((?:https?:\/\/(?:www\.)?deqode\.com)?\/career\/([a-z0-9-]+)\/?(?:[?#][^"']*)?)["']/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeInlineText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const canonicalizeUrl = (value) => {
  const url = new URL(value)
  url.hostname = url.hostname.replace(/^www\./i, '')
  return url.toString()
}

const absolutizeUrl = (value) => canonicalizeUrl(new URL(value, CAREERS_URL).toString())

const slugify = (value) => normalizeInlineText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractTextMatch = (html, regex) => {
  const match = regex.exec(String(html ?? ''))
  return match ? normalizeInlineText(match[1]) : null
}

const extractLabeledValue = (html, label) => {
  const escapedLabel = escapeRegex(label)

  return extractTextMatch(
    html,
    new RegExp(`>${escapedLabel}:<\\/[^>]+>[\\s\\S]{0,160}?>([^<]+)<`, 'i'),
  ) || extractTextMatch(
    html,
    new RegExp(`"children":"${escapedLabel}:"[\\s\\S]{0,250}?"children":"([^"]+)"`, 'i'),
  )
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Welcome to your team\s*(?:—|-)\s*Deqode Solutions\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && normalized.includes('Python Developer')
    && page.includes('/career/python-developer-1')
  }

export const extractJobDetailUrls = (html = '') => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Deqode verified first-party careers page no longer matches the trusted surface')
  }

  const detailUrls = new Set()

  for (const match of String(html ?? '').matchAll(JOB_DETAIL_HREF_PATTERN)) {
    const slug = normalizeInlineText(match[2])
    if (!slug) continue
    detailUrls.add(absolutizeUrl(`/career/${slug}`))
  }

  const jobs = [...detailUrls].filter((url) => {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname.startsWith('/career/') && pathname !== '/career'
  })

  if (jobs.length === 0) {
    throw new Error('Deqode verified careers page no longer exposes public job detail links')
  }

  return jobs
}

export const extractJobDetail = (html = '', detailUrl) => {
  const page = String(html ?? '')
  const title = extractTextMatch(
    page,
    /<title>\s*([^<]+?)\s*(?:—|-)\s*Deqode Solutions\s*<\/title>/i,
  ) || extractTextMatch(page, /data-pagefind-meta="title">([^<]+)</i)
  const introduction = extractTextMatch(page, /data-pagefind-meta="description">([^<]+)</i)
    || extractTextMatch(page, /"data-pagefind-meta":"description","children":"([^"]+)"/i)
  const location = extractLabeledValue(page, 'Location')
  const experience = extractLabeledValue(page, 'Experience')
  const category = extractLabeledValue(page, 'Category')
  const employmentType = extractLabeledValue(page, 'Employment Type')

  if (!title || !introduction || !location || !experience) {
    throw new Error(`Deqode job detail no longer matches the verified layout for ${detailUrl}`)
  }

  const canonicalUrl = extractTextMatch(page, /<link rel="canonical" href="([^"]+)"/i)
  const sourceUrl = canonicalUrl ? canonicalizeUrl(canonicalUrl) : canonicalizeUrl(detailUrl)
  const slug = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) || slugify(title)
  const jobId = `${SOURCE}-${slugify(slug)}`

  return {
    title,
    company: COMPANY,
    department: category || null,
    location,
    country: 'India',
    city: location,
    jobId,
    requisitionId: jobId,
    employmentType: employmentType || null,
    experienceRequired: experience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: introduction,
    source: SOURCE,
    sourceUrl,
    applyUrl: sourceUrl,
    link: sourceUrl,
    scrapedAt: new Date().toISOString(),
  }
}

export const createDeqodeScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const detailUrls = extractJobDetailUrls(careersHtml)
    const jobs = []

    for (const detailUrl of detailUrls) {
      const detailHtml = await fetchText(detailUrl)
      jobs.push(extractJobDetail(detailHtml, detailUrl))
    }

    return jobs
  },
})

export const run = async (options = {}) => createDeqodeScraper().run(options)

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
