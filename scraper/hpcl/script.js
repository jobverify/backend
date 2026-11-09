import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HPCL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HPCL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_OPENINGS_URL = PROVIDER_METADATA.officialJobOpeningsUrl
export const VERIFIED_APPLY_PORTAL_URLS = PROVIDER_METADATA.verifiedApplyPortalUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_INDEX = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const stripTags = (html) => normalizeText(
  String(html ?? '')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(li|p|div|section|article|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = JOB_OPENINGS_URL) => {
  if (!value) return null

  try {
    return new URL(String(value), baseUrl).toString()
  } catch {
    return null
  }
}

const parseHumanDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i)
  if (!match) return null

  const day = Number(match[1])
  const month = MONTH_INDEX[match[2].toLowerCase()]
  const year = Number(match[3])
  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) return null

  return [
    year.toString().padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

const extractLinks = (html) =>
  Array.from(String(html ?? '').matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({
      label: normalizeText(match[3]),
      url: toAbsoluteUrl(match[2]),
    }))
    .filter((link) => link.label && link.url)

const toLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<br\b[^>]*>/gi, '\n')
  .replace(/<\/(li|p|div|section|article|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeText(line))
  .filter(Boolean)

const CARD_CLASS_PATTERN = String.raw`(?<![\w-])card(?![\w-])`
const CARD_HEADER_CLASS_PATTERN = String.raw`(?<![\w-])card-header(?![\w-])`
const CARD_BODY_CLASS_PATTERN = String.raw`(?<![\w-])card-body(?![\w-])`

const extractCardTitle = (segment) => {
  const headerHtml = String(segment ?? '').match(
    new RegExp(
      `<div\\b[^>]*class=["'][^"']*${CARD_HEADER_CLASS_PATTERN}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )?.[1]

  return stripTags(headerHtml)
}

const extractCardBodyHtml = (segment) =>
  String(segment ?? '').match(
    new RegExp(
      `<div\\b[^>]*class=["'][^"']*${CARD_BODY_CLASS_PATTERN}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )?.[1] || ''

const normalizePortalUrl = (url) => {
  if (!url) return null
  if (VERIFIED_APPLY_PORTAL_URLS.some((candidate) => candidate === url)) {
    return url
  }
  return null
}

export const normalizeApplyUrl = (value) => {
  const url = toAbsoluteUrl(value)
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'jobs.hpcl.co.in') {
      parsed.protocol = 'https:'
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*HPCL Careers \| Oil Gas Industry Jobs \| Hindustan Petroleum Corporation Ltd\s*<\/title>/i.test(page)
    && /href=["']\/job-openings["']/i.test(page)
    && /jobs\.hpcl\.co\.in\/Recruit_New\/recruitlogin\.jsp/i.test(page)
    && normalized.includes('Latest Announcements')
    && /FRAUD ALERT!|What'?s Your Interest/i.test(normalized)
}

export const hasOfficialJobOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Job Opening \| HPCL Careers \| Oil Gas Industry Jobs\s*<\/title>/i.test(page)
    && /Our Current Openings/i.test(page)
    && /jobs\.hpcl\.co\.in\/Recruit_New\/recruitlogin\.jsp/i.test(page)
    && normalized.includes('Recruitment of Officers 2026-27')
}

export const parseApplicationWindow = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(
    /accepted from .*? on (\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}) till .*? on (\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i,
  )

  if (!match) return null

  const postingDate = parseHumanDate(match[1])
  const closingDate = parseHumanDate(match[2])
  if (!postingDate || !closingDate) return null

  return JSON.stringify({ postingDate, closingDate })
}

export const extractOpeningCards = (html = '') => {
  const page = String(html ?? '')
  const segments = page
    .split(
      new RegExp(
        `<div\\b[^>]*class=["'][^"']*${CARD_CLASS_PATTERN}[^"']*["'][^>]*>`,
        'gi',
      ),
    )
    .slice(1)

  return segments
    .map((segment) => {
      const title = extractCardTitle(segment)
      const bodyHtml = extractCardBodyHtml(segment)
      const bodyText = stripTags(bodyHtml)
      const lines = toLines(bodyHtml)
      const links = extractLinks(bodyHtml)
      const applyLink = links.find((link) => /apply/i.test(link.label || ''))
      const referenceLink = links.find((link) =>
        link.url && normalizePortalUrl(normalizeApplyUrl(link.url)) == null,
      )

      if (!title || !bodyText) return null

      return {
        title,
        bodyText,
        lines,
        links,
        applyUrl: normalizeApplyUrl(applyLink?.url),
        referenceUrl: referenceLink?.url || JOB_OPENINGS_URL,
      }
    })
    .filter(Boolean)
    .filter((card) => !/^(Job Updates Form|Documents)$/i.test(card.title))
}

export const isLikelyActiveOpening = (card = {}) => {
  const title = normalizeText(card?.title) || ''
  const bodyText = normalizeText(card?.bodyText) || ''

  if (!title || !card.applyUrl) return false
  if (/^(Job Updates Form|Documents)$/i.test(title)) return false
  if (/Results for Computer Based Test|Cut-off Marks|view their results under Candidate Login/i.test(bodyText)) {
    return false
  }

  return VERIFIED_APPLY_PORTAL_URLS.includes(card.applyUrl)
}

const buildJobDescription = (card) => {
  const referenceLinks = (Array.isArray(card?.links) ? card.links : [])
    .filter((link) => !/apply/i.test(link.label || ''))
    .map((link) => link.label)
    .filter(Boolean)

  if (referenceLinks.length === 0) {
    return 'Official HPCL opening. Review the first-party application surface for eligibility and application details.'
  }

  return `Official HPCL opening. Supporting public documents: ${referenceLinks.join('; ')}.`
}

const buildJobId = (card, index) => {
  const referenceSlug = card?.referenceUrl
    ? slugify(new URL(card.referenceUrl).pathname.split('/').pop() || '')
    : ''

  return [SOURCE, slugify(card?.title || ''), referenceSlug || String(index + 1)]
    .filter(Boolean)
    .join('-')
}

const toJob = (card, index, scrapedAt) => {
  const dateWindow = card.lines
    .map((line) => parseApplicationWindow(line))
    .find(Boolean)
  const parsedWindow = dateWindow ? JSON.parse(dateWindow) : {}
  const employmentType = /apprentice/i.test(card.title) ? 'Apprenticeship' : null
  const sourceUrl = card.referenceUrl || JOB_OPENINGS_URL

  return {
    jobId: buildJobId(card, index),
    title: card.title,
    company: COMPANY,
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    sourceUrl,
    applyUrl: card.applyUrl,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: parsedWindow.postingDate || null,
    closingDate: parsedWindow.closingDate || null,
    jobDescription: buildJobDescription(card),
    requisitionId: buildJobId(card, index),
    source: SOURCE,
    link: card.applyUrl || sourceUrl,
    scrapedAt,
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

export const createHpclScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('HPCL verified careers surface changed materially')
    }

    const openingsHtml = await fetchText(JOB_OPENINGS_URL)
    if (!hasOfficialJobOpeningsSignal(openingsHtml)) {
      throw new Error('HPCL verified job-openings surface changed materially')
    }

    const scrapedAt = now()

    return extractOpeningCards(openingsHtml)
      .filter((card) => isLikelyActiveOpening(card))
      .map((card, index) => toJob(card, index, scrapedAt))
  },
})

export const run = async (options = {}) => createHpclScraper(options).run(options)

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
