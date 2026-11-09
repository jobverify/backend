import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IMAGE_INFORMATION_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IMAGE_INFORMATION_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_INDEX = {
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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
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

const parseFlexibleDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/^([A-Za-z]+)\s+(\d{1,2})\.?\s+(\d{4})$/)
  if (!match) return null

  const month = MONTH_INDEX[match[1].toLowerCase()]
  if (!month) return null

  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`
}

const extractParagraphText = (html = '') => [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractTitleFromAnchor = (rawHtml = '') => {
  const title = stripTags(rawHtml)
  return /^(view details)$/i.test(title) ? null : title
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/partial/i.test(normalized)) return 'Hybrid'
  if (/remote/i.test(normalized)) return 'Remote'
  if (/on[- ]?site/i.test(normalized)) return 'On-site'
  return null
}

const extractLocation = (text) =>
  normalizeWhitespace(
    text.match(/Location:\s*(.*?)\s*(?:Language Skills:|Working Time:|Remote Work:|Application\b|$)/i)?.[1],
  ) || null

const extractEmploymentType = (text) =>
  normalizeWhitespace(
    text.match(/Working Time:\s*(.*?)\s*(?:Remote Work:|Application\b|$)/i)?.[1],
  ) || null

const extractRemoteWork = (text) =>
  normalizeWhitespace(
    text.match(/Remote Work:\s*(.*?)\s*(?:Application\b|$)/i)?.[1],
  ) || null

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*IMAGE your future[\s\S]*Medical Jobs\s*<\/title>/i.test(page)
    && /Jobs at iQ IMAGE/i.test(page)
    && /IMAGE Information Systems is the right place for you/i.test(page)
}

export const hasExplicitNoOpenPositionsSignal = (html = '') =>
  /don't have any open positions|do not have any open positions/i.test(String(html ?? ''))

export const hasImplicitNoOpenPositionsSignal = (html = '') => {
  const page = String(html ?? '')

  return !/<a\b[^>]+href="[^"]*\/job\/[^"]+"/i.test(page)
    && /Current Jobs/i.test(page)
    && /What you can expect from iQ IMAGE/i.test(page)
}

export const extractJobCardsFromCareersPage = (html = '') => {
  const cards = []
  const seenUrls = new Set()
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a\b[^>]+href="([^"]*\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const detailUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    const title = extractTitleFromAnchor(match[2])
    if (!detailUrl || !title || seenUrls.has(detailUrl)) continue

    const trailingHtml = page.slice(match.index + match[0].length, match.index + match[0].length + 240)
    const postingDate = parseFlexibleDate(
      trailingHtml.match(/\b([A-Z][a-z]+ \d{1,2}\.\s*\d{4})\b/)?.[1] ?? '',
    )

    seenUrls.add(detailUrl)
    cards.push({
      title,
      detailUrl,
      postingDate,
    })
  }

  return cards
}

export const hasActiveApplicationSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Frontend-Developer \(m\/f\/d\)\s*-\s*IMAGE Information Systems\s*<\/title>/i.test(page)
    && /hr@iq-image\.com/i.test(page)
    && /Location\s*:/i.test(page)
    && /Working Time\s*:/i.test(page)
    && /(Interested\?|Submit Application)/i.test(page)
}

export const normalizeJobDetail = (detailHtml = '', listing = {}, { scrapedAt } = {}) => {
  const rawTitle = stripTags(
    String(detailHtml ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? listing.title
      ?? '',
  )
  const title = rawTitle || listing.title || null
  const detailUrl = listing.detailUrl || null
  const text = stripTags(detailHtml)
  const paragraphs = extractParagraphText(detailHtml)
  const jobDescription = paragraphs
    .filter((paragraph) =>
      !/^(Interested\?|Location:|Language Skills:|Working Time:|Remote Work:)/i.test(paragraph))
    .join(' ')

  const location = extractLocation(text)
  const city = location?.split(',')[0]?.trim() || null
  const country = location?.split(',').at(-1)?.trim() || null
  const employmentType = extractEmploymentType(text)
  const remoteStatus = normalizeRemoteStatus(extractRemoteWork(text))
  const jobId = detailUrl
    ? normalizeWhitespace(new URL(detailUrl).pathname.split('/').filter(Boolean).at(-1))
    : null

  return {
    title,
    company: COMPANY_NAME,
    department: null,
    location,
    city,
    country,
    jobId,
    requisitionId: null,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate || null,
    closingDate: null,
    jobDescription: jobDescription || null,
    remoteStatus,
    source: SOURCE,
    link: detailUrl,
    scrapedAt,
  }
}

export const createImageInformationSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const scrapedAt = typeof options.now === 'function' ? options.now() : now()
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Image Information Systems verified careers page no longer matches the known first-party surface')
    }

    const jobCards = extractJobCardsFromCareersPage(careersHtml)
    if (jobCards.length === 0) {
      if (hasExplicitNoOpenPositionsSignal(careersHtml) || hasImplicitNoOpenPositionsSignal(careersHtml)) return []
      throw new Error('Image Information Systems careers page no longer exposes the expected visible job detail links')
    }

    const jobs = []
    for (const jobCard of jobCards) {
      const detailHtml = await fetchText(jobCard.detailUrl)
      if (!hasActiveApplicationSignal(detailHtml)) {
        throw new Error('Image Information Systems detail page no longer exposes the expected application signals')
      }
      jobs.push(normalizeJobDetail(detailHtml, jobCard, { scrapedAt }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createImageInformationSystemsScraper().run(options)

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
