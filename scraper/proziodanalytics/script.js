import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'proziodanalytics'
export const COMPANY = 'Proziod Analytics'
export const HOMEPAGE_URL = 'https://proziod.com/'
export const CAREERS_URL = 'https://careers.proziod.com/'
export const COMPANY_DOMAIN = 'careers.proziod.com'
export const ATS_PLATFORM = 'gohire'
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

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
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

const parsePostingDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/)
  if (!match) return null

  const [, day, monthName, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${day.padStart(2, '0')}`
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)?.replace(/\s*,\s*/g, ', ') || null
  if (!location) {
    return {
      location: null,
      city: null,
      country: 'India',
    }
  }

  const [city, country = 'India'] = location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)

  return {
    location,
    city: city || null,
    country: country || 'India',
  }
}

const extractAll = (pattern, value, mapMatch) =>
  [...String(value ?? '').matchAll(pattern)].map((match) => mapMatch(match)).filter(Boolean)

const extractSidebarValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(
        `<p[^>]*class=["']jp-sidebar-item-title["'][^>]*>\\s*${escapedLabel}\\s*<\\/p>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
        'i',
      ),
    )?.[1],
  )
}

const extractBodyField = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(`<strong>\\s*${escapedLabel}\\s*:?\\s*<\\/strong>\\s*([^<]+)`, 'i'),
    )?.[1],
  )
}

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

export const hasOfficialBoardSignal = (html = '') => {
  const page = String(html ?? '')
  return /Jobs at Proziod Analytics/i.test(page)
    && /\bGoHire\b/i.test(page)
    && /class=["'][^"']*gohire-job/i.test(page)
    && /careers\.proziod\.com\/[a-z0-9-]+-\d+\/?/i.test(page)
}

export const extractJobCards = (html = '') =>
  extractAll(
    /<a\b[^>]*class=["'][^"']*gohire-job[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    html,
    (match) => {
      const sourceUrl = normalizeWhitespace(match[1])
      const block = match[2]
      const title = normalizeWhitespace(
        block.match(/<h\d[^>]*class=["'][^"']*job-title[^"']*["'][^>]*>([\s\S]*?)<\/h\d>/i)?.[1],
      )
      if (!sourceUrl || !title) return null

      const locationData = parseLocation(
        block.match(/<p[^>]*class=["'][^"']*careers-location[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
      )
      const postingDate = parsePostingDate(
        block.match(/<p[^>]*class=["'][^"']*date-posted[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1],
      )
      const jobId = normalizeWhitespace(sourceUrl.match(/-([0-9]+)\/?$/)?.[1]) || slugify(title)

      return {
        title,
        sourceUrl,
        applyUrl: sourceUrl,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        postingDate,
        jobId,
      }
    },
  )

export const extractJobDetail = (html = '', listing = {}) => {
  const descriptionHtml =
    String(html ?? '').match(/<div[^>]*class=["'][^"']*jp-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || ''
  const jobDescription = stripTagsToText(descriptionHtml)
  const salary = extractSidebarValue(html, 'Salary')
  const employmentType = extractSidebarValue(html, 'Job Type') || extractBodyField(descriptionHtml, 'Job Type')
  const experienceRequired =
    normalizeWhitespace(jobDescription?.match(/(?:^|\n)\s*Experience\s*:\s*([^\n]+)/im)?.[1])
    || extractBodyField(descriptionHtml, 'Experience Required')
    || extractBodyField(descriptionHtml, 'Experience')
  const locationValue = extractSidebarValue(html, 'Location') || listing.location
  const locationData = parseLocation(locationValue)
  const applyEmail = normalizeWhitespace(
    String(html ?? '').match(/href=["'](mailto:[^"']+)["']/i)?.[1],
  )
  const requiredSkills = dedupeList([
    normalizeWhitespace(jobDescription?.match(/Skills\s*:?\s*([^\n]+)/i)?.[1]),
    ...extractAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, descriptionHtml, (match) => stripTagsToText(match[1])),
  ])

  return {
    ...listing,
    title: listing.title || normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType,
    experienceRequired,
    salary,
    requiredSkills,
    jobDescription,
    applyUrl: applyEmail || listing.applyUrl || listing.sourceUrl || null,
  }
}

export const createProziodAnalyticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: runNow } = {}) {
    const boardHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialBoardSignal(boardHtml)) {
      throw new Error('The verified Proziod Analytics board no longer matches the trusted first-party public surface')
    }

    const cards = extractJobCards(boardHtml)
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

export const run = async (options = {}) => createProziodAnalyticsScraper().run(options)

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
