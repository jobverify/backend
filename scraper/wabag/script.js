import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COMPANY = 'VA Tech Wabag'
export const SOURCE = 'wabag'
export const CAREER_PAGE_URL = 'https://www.wabag.com/careers/'

const OFFICIAL_HOSTNAME = new URL(CAREER_PAGE_URL).hostname
const INDIAN_CITY_TOKENS = new Set([
  'chennai',
  'noida',
  'pune',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'mumbai',
  'gurugram',
  'gurgaon',
  'coimbatore',
  'delhi',
])

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(decodeHtmlEntities(value), CAREER_PAGE_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== OFFICIAL_HOSTNAME) return null
    return url.toString()
  } catch {
    return null
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFooterValue = (footerHtml, label) => {
  const pattern = new RegExp(
    `<strong[^>]*>\\s*${escapeRegex(label)}\\s*<\\/strong>\\s*([^<]+)`,
    'i',
  )
  const match = pattern.exec(String(footerHtml ?? ''))
  if (!match) return null
  return normalizeWhitespace(match[1].replace(/,\s*$/, ''))
}

const inferCountry = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  if (/saudi arabia/i.test(normalized)) return 'Saudi Arabia'
  if (/\bindia\b/i.test(normalized)) return 'India'

  const parts = normalized
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  if (parts.some((part) => INDIAN_CITY_TOKENS.has(part))) {
    return 'India'
  }

  return null
}

const inferCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^india$/i.test(normalized) || /^saudi arabia$/i.test(normalized)) {
    return null
  }

  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  if (/^(india|saudi arabia)$/i.test(parts[0])) {
    return parts[1] || null
  }

  return parts[0] || null
}

const extractJobIdFromListingClass = (wrapperClassName) => {
  const match = /aol_ad_(\d+)/i.exec(String(wrapperClassName ?? ''))
  return match ? match[1] : null
}

export const extractCareerCards = (html) => {
  const cards = []
  const source = String(html ?? '')
  const starts = [...source.matchAll(/<div class="aol-ad-inner-wrapper\s+([^"]*aol_ad_\d+[^"]*)"[^>]*>/gi)]

  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index]
    const wrapperClassName = match[1]
    const startIndex = match.index ?? 0
    const endIndex = index + 1 < starts.length ? (starts[index + 1].index ?? source.length) : source.length
    const cardHtml = source.slice(startIndex, endIndex)
    const title = normalizeWhitespace(
      /<div class="panel-heading">([\s\S]*?)<\/div>/i.exec(cardHtml)?.[1],
    )
    const detailUrl = toAbsoluteUrl(/<a href="([^"]+)"/i.exec(cardHtml)?.[1])
    const footerHtml = /<div class="panel-footer">([\s\S]*?)<\/div>/i.exec(cardHtml)?.[1] || ''

    if (!title || !detailUrl) continue

    cards.push({
      jobId: extractJobIdFromListingClass(wrapperClassName),
      title,
      detailUrl,
      roles: extractFooterValue(footerHtml, 'Roles:'),
      department: extractFooterValue(footerHtml, 'Functional Areas:'),
      location: extractFooterValue(footerHtml, 'Locations:'),
      experienceRequired: extractFooterValue(footerHtml, 'Experiences:'),
    })
  }

  return cards
}

export const extractJobDetail = (html) => {
  const title = normalizeWhitespace(
    /<h2 class="post-title">([\s\S]*?)<\/h2>/i.exec(String(html ?? ''))?.[1],
  )
  const postingDate = normalizeWhitespace(
    /<span class="posted-on">[\s\S]*?<a[^>]*>([^<]+)<\/a>/i.exec(String(html ?? ''))?.[1],
  )
  const descriptionSection =
    /<section class="qs-inner-cont[^"]*">([\s\S]*?)<\/section>/i.exec(String(html ?? ''))?.[1] || null

  return {
    title,
    postingDate,
    jobDescription: stripTags(descriptionSection),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const careersHtml = await fetchText(CAREER_PAGE_URL)
  const cards = extractCareerCards(careersHtml)
  const jobs = []
  const seenUrls = new Set()

  for (const card of cards) {
    if (seenUrls.has(card.detailUrl)) continue
    seenUrls.add(card.detailUrl)

    const detailHtml = await fetchText(card.detailUrl)
    const detail = extractJobDetail(detailHtml)

    jobs.push({
      jobId: card.jobId,
      requisitionId: card.jobId,
      title: detail.title || card.title,
      company: COMPANY,
      department: card.department,
      location: card.location,
      city: inferCity(card.location),
      country: inferCountry(card.location),
      link: card.detailUrl,
      applyUrl: card.detailUrl,
      sourceUrl: card.detailUrl,
      source: SOURCE,
      employmentType: null,
      experienceRequired: card.experienceRequired,
      jobDescription: detail.jobDescription,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: detail.postingDate,
      closingDate: null,
      scrapedAt: new Date().toISOString(),
    })
  }

  return jobs
}

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
