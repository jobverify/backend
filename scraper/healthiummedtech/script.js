import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'healthiummedtech'
export const COMPANY = 'Healthium Medtech'
export const CAREERS_PAGE_URL = 'https://healthiummedtech.com/careers/'
export const CAREERS_PAGE_API_URL = 'https://healthiummedtech.com/wp-json/wp/v2/pages?slug=careers'
export const APPLICATION_EMAIL = 'careers@healthiummedtech.com'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const normalizeExperience = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\byears?\b/gi, 'years'),
) || null

const deriveCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (normalized.includes('/')) {
    return normalizeCity(normalized.split('/')[0]?.trim())
  }

  return normalizeCity(normalized)
}

const buildJobId = ({ title, department, experienceRequired, location }) => slugify([
  title,
  department,
  experienceRequired,
  location,
].filter(Boolean).join(' | '))

const extractApplicationUrl = (html) => (
  String(html ?? '').match(/href=["'](mailto:careers@healthiummedtech\.com)["']/i)?.[1]
  || APPLICATION_URL
)

const parseAccordionHeader = (value) => {
  const parts = normalizeWhitespace(value)
    ?.split('|')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean) || []

  if (parts.length < 3) return null

  return {
    title: parts[0] || null,
    department: parts.length > 3 ? normalizeWhitespace(parts.slice(1, -2).join(' | ')) : null,
    experienceRequired: normalizeExperience(parts.at(-2)),
    rawLocation: parts.at(-1) || null,
  }
}

export const extractRenderedHtmlFromPagePayload = (payload) => {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload
  const page = Array.isArray(parsed) ? parsed[0] : parsed

  if (!page || page?.link !== CAREERS_PAGE_URL || page?.title?.rendered !== 'Careers') {
    throw new Error('Healthium Medtech careers API no longer matches the verified official public surface')
  }

  const renderedHtml = page?.content?.rendered
  if (!renderedHtml || !/eael-accordion-header/i.test(renderedHtml) || !/Explore Infinite/i.test(renderedHtml)) {
    throw new Error('Healthium Medtech careers API no longer matches the verified official public surface')
  }

  return renderedHtml
}

export const extractAccordionJobs = (html) => {
  const renderedHtml = String(html ?? '')
  const applyUrl = extractApplicationUrl(renderedHtml)

  return [...renderedHtml.matchAll(
    /<div[^>]*class="[^"]*\beael-accordion-header\b[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*\beael-accordion-tab-title\b[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>\s*<div[^>]*class="[^"]*\beael-accordion-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  )]
    .map((match) => {
      const header = parseAccordionHeader(match[1])
      if (!header?.title || !header?.experienceRequired || !header?.rawLocation) {
        return null
      }

      const location = normalizeLocation(header.rawLocation)
      const jobId = buildJobId({
        title: header.title,
        department: header.department,
        experienceRequired: header.experienceRequired,
        location,
      })

      if (!jobId) return null

      return {
        title: header.title,
        company: COMPANY,
        department: header.department,
        location,
        city: deriveCity(header.rawLocation),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_PAGE_URL,
        applyUrl,
        employmentType: null,
        experienceRequired: header.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: stripHtml(match[2]),
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHealthiumMedtechScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const payload = await fetchJson(CAREERS_PAGE_API_URL)
    const renderedHtml = extractRenderedHtmlFromPagePayload(payload)
    const jobs = extractAccordionJobs(renderedHtml)
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))

    return Number.isInteger(maxJobs) && maxJobs > 0 ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createHealthiumMedtechScraper().run(options)

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
