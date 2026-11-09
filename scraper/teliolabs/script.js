import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'teliolabs'
export const COMPANY = 'Teliolabs'
export const HOMEPAGE_URL = 'https://teliolabs.com/'
export const CAREERS_URL = 'https://teliolabs.com/job-openings/'
export const COMPANY_DOMAIN = 'teliolabs.com'
export const ATS_PLATFORM = 'wp-job-openings'
export const VERIFIED_ON = '2026-07-18'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&apos;': "'",
  '&#39;': "'",
  '&#8217;': "'",
  '&quot;': '"',
  '&#8220;': '"',
  '&#8221;': '"',
  '&nbsp;': ' ',
}

const decodeHtmlEntities = (value) =>
  String(value ?? '').replace(
    /&(amp|apos|quot|nbsp);|&#39;|&#8217;|&#8220;|&#8221;/gi,
    (match) => HTML_ENTITY_MAP[match] || match,
  )

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToText = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/<(?:br|\/p|\/div|\/li|\/ol|\/ul|\/h\d)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

  return normalized || null
}

const slugify = (value) =>
  String(normalizeWhitespace(value) || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const extractAll = (pattern, value, mapMatch) =>
  [...String(value ?? '').matchAll(pattern)].map((match) => mapMatch(match)).filter(Boolean)

const dedupeList = (values) => {
  const seen = new Set()
  const items = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(normalized)
  }

  return items
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: `${SOURCE}-html`,
    timeoutMs: 15000,
  })

const normalizeLocation = (value) => {
  const base = normalizeWhitespace(value)
  if (!base) {
    return {
      location: null,
      city: null,
      country: 'India',
    }
  }

  if (/^remote\b/i.test(base)) {
    return {
      location: `${base}, India`,
      city: null,
      country: 'India',
    }
  }

  const parts = base.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts[1] || 'India'

  return {
    location: parts.length > 1 ? parts.join(', ') : `${city}, India`,
    city,
    country,
  }
}

const extractSpecValue = (html, suffix) =>
  normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(
        `<div[^>]*class=["'][^"']*awsm-job-specification-${suffix}[^"']*["'][^>]*>[\\s\\S]*?<span[^>]*class=["'][^"']*awsm-job-specification-term[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`,
        'i',
      ),
    )?.[1],
  )

export const hasOfficialJobsArchiveSignal = (html = '') => {
  const page = String(html ?? '')
  return /awsm-job-listing-item/i.test(page)
    && /teliolabs\.com\/career\//i.test(page)
    && /Cloud Native Engineer/i.test(page)
}

export const extractJobCards = (html = '') =>
  extractAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*awsm-job-item[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    html,
    (match) => {
      const sourceUrl = normalizeWhitespace(match[1])
      const content = match[2]
      const title = normalizeWhitespace(
        content.match(/<h2[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1],
      )
      if (!sourceUrl || !title) return null

      const department = extractSpecValue(content, 'job-category')
      const employmentType = extractSpecValue(content, 'job-type')
      const experienceRequired = extractSpecValue(content, 'experience')
      const languagesValue = extractSpecValue(content, 'languages')
      const locationData = normalizeLocation(extractSpecValue(content, 'job-location'))
      const slug = slugify(sourceUrl.split('/').filter(Boolean).at(-1) || title)

      return {
        title,
        sourceUrl,
        applyUrl: sourceUrl,
        department,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        employmentType,
        experienceRequired,
        jobId: slug,
        requisitionId: slug,
        languages: languagesValue ? [languagesValue] : [],
      }
    },
  )

export const extractJobDetail = (html = '', listing = {}) => {
  const descriptionHtml =
    String(html ?? '').match(/<div[^>]*class=["'][^"']*awsm-job-entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || ''
  const jobDescription = stripTagsToText(descriptionHtml)
  const requiredSkills = dedupeList(
    extractAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, descriptionHtml, (match) => stripTagsToText(match[1])),
  )
  const locationData = normalizeLocation(
    extractSpecValue(html, 'job-location') || listing.location,
  )

  return {
    ...listing,
    title: listing.title || normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
    department: listing.department || extractSpecValue(html, 'job-category'),
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: extractSpecValue(html, 'job-type') || listing.employmentType,
    experienceRequired: extractSpecValue(html, 'experience') || listing.experienceRequired,
    languages: listing.languages?.length ? listing.languages : dedupeList([extractSpecValue(html, 'languages')]),
    requiredSkills,
    jobDescription,
  }
}

export const createTeliolabsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: runNow } = {}) {
    const archiveHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialJobsArchiveSignal(archiveHtml)) {
      throw new Error('The verified Teliolabs jobs archive no longer matches the trusted first-party public surface')
    }

    const cards = extractJobCards(archiveHtml)
    const limitedCards = Number.isInteger(maxJobs) ? cards.slice(0, maxJobs) : cards
    const scrapedAt = (runNow || now)()

    const jobs = await Promise.all(
      limitedCards.map(async (card) => {
        const detailHtml = await fetchText(card.sourceUrl)
        const detail = extractJobDetail(detailHtml, card)
        return {
          ...detail,
          source: SOURCE,
          company: COMPANY,
          companyCareerPage: CAREERS_URL,
          companyDomain: COMPANY_DOMAIN,
          atsPlatform: ATS_PLATFORM,
          link: detail.applyUrl || detail.sourceUrl || null,
          scrapedAt,
        }
      }),
    )

    return jobs
  },
})

export const run = async (options = {}) => createTeliolabsScraper().run(options)

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
