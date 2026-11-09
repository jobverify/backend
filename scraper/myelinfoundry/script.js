import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'myelinfoundry'
export const COMPANY = 'Myelin Foundry'
export const HOMEPAGE_URL = 'https://myelinfoundry.com/'
export const CAREERS_URL = 'https://www.myelinfoundry.ai/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const getDocumentSlug = (value) => {
  const normalized = toAbsoluteUrl(value)
  if (!normalized) return null

  try {
    const segments = new URL(normalized).pathname.split('/').filter(Boolean)
    const lastSegment = segments.at(-1)
    if (!lastSegment) return null
    return slugify(decodeURIComponent(lastSegment).replace(/\.[a-z0-9]+$/i, ''))
  } catch {
    return null
  }
}

const isFirstPartyJobDocument = (value) => {
  const normalized = toAbsoluteUrl(value)
  if (!normalized) return false

  try {
    const parsed = new URL(normalized)
    const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    return hostname === 'myelinfoundry.ai'
      && /\/wp-content\/uploads\//i.test(parsed.pathname)
      && /\.(pdf|docx?)$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const buildJobDescription = (title) => normalizeWhitespace(
  `Official ${COMPANY} role details document for ${title}. Review the first-party document and apply through the official ${COMPANY} careers page.`,
)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Myelin Foundry\s*\|\s*Agentic AI Solutions for Industries/i.test(page)
    && /Agentic AI on the Edge/i.test(text)
    && /communications@myelinfoundry\.com/i.test(text)
    && /Myelin Foundry Pvt\. Ltd\./i.test(text)
    && /<a[^>]+href=["'](?:https:\/\/www\.myelinfoundry\.ai\/careers\/|\/careers\/)["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers at Myelin Foundry\s*\|\s*Build the Future with AI/i.test(page)
    && /Life at Myelin/i.test(text)
    && /Equal Opportunity Employer/i.test(text)
    && /Job openings/i.test(text)
    && /Job Application - Head of sales/i.test(text)
    && /Upload your CV/i.test(text)
}

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const extractJobsSectionHtml = (html) => {
  const page = String(html ?? '')
  const startIndex = page.indexOf('Job openings')
  const endIndex = [
    page.indexOf('</main><footer', startIndex),
    page.indexOf('<footer', startIndex),
    page.indexOf('Job Application - ', startIndex),
    page.indexOf('</body>', startIndex),
  ]
    .filter((candidate) => candidate > startIndex)
    .sort((left, right) => left - right)[0] ?? -1

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Myelin Foundry verified careers page no longer exposes the known jobs section')
  }

  return page.slice(startIndex, endIndex)
}

const JOB_CARD_PATTERN = /<div\b[^>]*class="brxe-block bricks-lazy-hidden"[^>]*>\s*<div\b[^>]*class="brxe-block bricks-lazy-hidden"[^>]*>\s*<h3\b[^>]*class="brxe-heading"[^>]*>([^<]+)<\/h3>\s*<\/div>\s*<div\b[^>]*class="brxe-block bricks-lazy-hidden"[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>\s*View Details\s*<\/a>\s*<span\b[^>]*>\s*Apply\s*<\/span>\s*<\/div>\s*<\/div>/gi

export const extractCareerJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Myelin Foundry verified official careers page no longer matches the known public jobs surface')
  }

  const jobsSectionHtml = extractJobsSectionHtml(html)
  const expectedDetailCount = countMatches(jobsSectionHtml, />\s*View Details\s*<\/a>/gi)
  const expectedApplyCount = countMatches(jobsSectionHtml, />\s*Apply\s*<\/span>/gi)
  const jobs = []
  const seenJobIds = new Set()

  for (const match of jobsSectionHtml.matchAll(JOB_CARD_PATTERN)) {
    const title = normalizeWhitespace(match[1])
    const sourceUrl = toAbsoluteUrl(match[2], CAREERS_URL)
    const documentSlug = getDocumentSlug(sourceUrl)
    const jobId = documentSlug ? `${SOURCE}-${documentSlug}` : null

    if (!title || !sourceUrl || !documentSlug || !jobId || !isFirstPartyJobDocument(sourceUrl)) {
      throw new Error('Myelin Foundry verified careers job cards changed shape')
    }

    if (seenJobIds.has(jobId)) {
      throw new Error('Myelin Foundry verified careers job cards changed shape')
    }

    seenJobIds.add(jobId)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(title),
    })
  }

  if (
    jobs.length === 0
    || jobs.length !== expectedDetailCount
    || jobs.length !== expectedApplyCount
  ) {
    throw new Error('Myelin Foundry verified careers job cards changed shape')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMyelinFoundryScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Myelin Foundry verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractCareerJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createMyelinFoundryScraper(options).run(options)

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
