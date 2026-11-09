import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lumber'
export const COMPANY = 'Lumber'
export const HOMEPAGE_URL = 'https://www.lumber.com/'
export const CAREERS_URL = 'https://www.lumber.com/careers'
export const BOARD_URL = 'https://americaninternationalforestproductsllc.applytojob.com/apply'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BOARD_HOST = new URL(BOARD_URL).hostname
const BOARD_PATH = new URL(BOARD_URL).pathname.replace(/\/$/, '')

const removeScriptAndStyle = (value = '') => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(
  removeScriptAndStyle(String(value ?? ''))
    .replace(/<[^>]+>/g, ' '),
)

const stripTagsToLines = (value) => removeScriptAndStyle(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|section|article|ul|ol|h[1-6]|span|a)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null,
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteBoardUrl = (value, baseUrl = BOARD_URL) => {
  try {
    const url = new URL(value, baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== BOARD_HOST) return null
    if (url.pathname !== BOARD_PATH && !url.pathname.startsWith(`${BOARD_PATH}/`)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return { location: null, city: null }

  const city = normalizeWhitespace(location.split(',')[0]) || null
  return { location, city }
}

const normalizeEmploymentType = (value) => {
  const employmentType = normalizeWhitespace(value)?.toLowerCase()
  if (!employmentType) return null
  if (employmentType === 'full time' || employmentType === 'full-time') return 'Full-time'
  if (employmentType === 'part time' || employmentType === 'part-time') return 'Part-time'
  if (employmentType.includes('contract')) return 'Contract'
  if (employmentType.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const extractJobId = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')
    return applyIndex >= 0 ? segments[applyIndex + 1] || null : null
  } catch {
    return null
  }
}

export const extractOfficialBoardUrls = (html) => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteBoardUrl(match[1], CAREERS_URL)
    const text = normalizeText(match[2])

    if (!url || seen.has(url)) continue
    if (!/\b(?:apply|learn more)\b/i.test(text || '')) continue

    seen.add(url)
    urls.push(url)
  }

  return urls
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /^Home\s*\|\s*American International\b/i.test(extractTitle(page) || '')
    && /America's leading trader of lumber and building materials/i.test(text)
    && /Where materials build momentum\./i.test(text)
    && /American International Forest Products \(AIFP\)/i.test(text)
    && /<a\b[^>]*href=["'](?:https?:\/\/www\.lumber\.com)?\/careers\/?["'][^>]*>[\s\S]*?Careers[\s\S]*?<\/a>/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const text = normalizeText(html)
  const boardUrls = extractOfficialBoardUrls(html)

  return /^(?:Commodity Trading )?Careers \| American International$/i.test(extractTitle(html) || '')
    && /EMPOWER\s+YOUR\s+FUTURE\./i.test(text)
    && /(?:90|97)%\s+RETENTION RATE/i.test(text)
    && /ENTRY-LEVEL ROOKIE SCHOOL/i.test(text)
    && /SUMMER INTERNSHIP PROGRAM/i.test(text)
    && boardUrls.includes(BOARD_URL)
}

export const hasVerifiedBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return extractTitle(page) === 'American International Forest Products, LLC. - Career Page'
    && /Thank you for your interest in AIFP!/i.test(text)
    && /Current Openings/i.test(text)
    && /View Our Website/i.test(text)
    && (
      /\bPowered by JazzHR\b/i.test(text)
      || /info\.jazzhr\.com/i.test(page)
    )
}

export const hasVerifiedJobDetailSignal = (html, listing = {}) => {
  const page = String(html ?? '')
  const text = normalizeText(page)
  const title = normalizeWhitespace(listing?.title)
  const location = normalizeWhitespace(listing?.location)
  const hasModernLayout =
    /id=["']job-description["']/i.test(page)
    && /title=["']Type["']/i.test(page)
    && /title=["']Experience["']/i.test(page)
  const hasLegacyLayout =
    /Thank you for your interest in AIFP!/i.test(text)
    && /Apply for this position/i.test(text)

  return /-\s*American International Forest Products, LLC\.\s*-\s*Career Page$/i.test(extractTitle(page) || '')
    && /View All Jobs/i.test(text)
    && (hasModernLayout || hasLegacyLayout)
    && (!title || new RegExp(`\\b${escapeRegExp(title)}\\b`, 'i').test(text))
    && (!location || new RegExp(escapeRegExp(location), 'i').test(text))
}

export const extractBoardJobs = (html) => {
  if (!hasVerifiedBoardSignal(html)) {
    throw new Error('Lumber verified applytojob board no longer matches the known public surface')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<li\b[^>]*>\s*<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)<\/li>/gi,
  )) {
    const detailUrl = toAbsoluteBoardUrl(match[1], BOARD_URL)
    const title = normalizeWhitespace(match[2])
    const lines = stripTagsToLines(match[3])
    const { location, city } = parseLocation(lines[0] || null)
    const jobId = detailUrl ? extractJobId(detailUrl) : null

    if (!detailUrl || !title || !location || !jobId || seen.has(detailUrl)) {
      continue
    }

    seen.add(detailUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      country: 'United States',
      jobId,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  if (!hasVerifiedJobDetailSignal(html, listing)) {
    throw new Error(`Lumber verified job detail page no longer matches the known public surface: ${listing?.sourceUrl || 'unknown job'}`)
  }

  const pageTitle = extractTitle(html)
  const fallbackTitle = normalizeWhitespace(
    pageTitle?.replace(/\s*-\s*American International Forest Products, LLC\.\s*-\s*Career Page\s*$/i, ''),
  )
  const title = normalizeWhitespace(listing?.title || fallbackTitle || null)
  const lines = stripTagsToLines(html)
  const titleIndex = title
    ? lines.findIndex((line) => line.toLowerCase() === title.toLowerCase())
    : -1
  const afterTitle = titleIndex >= 0 ? lines.slice(titleIndex + 1) : lines
  const locationLine = normalizeWhitespace(
    listing?.location
      || afterTitle.find((line) => /,\s*[A-Z]{2}\b/.test(line))
      || null,
  )
  const employmentTypeLine = normalizeWhitespace(
    afterTitle.find((line) => /\b(full[\s-]*time|part[\s-]*time|contract|internship)\b/i.test(line))
      || null,
  )
  const experienceRequiredLine = normalizeWhitespace(
    afterTitle.find((line) => /\b(?:entry|mid|senior)\s+level\b/i.test(line))
      || null,
  )
  const firstShareIndex = afterTitle.findIndex((line) => /^Share$/i.test(line))
  const fallbackDescriptionStart = afterTitle.findIndex((line) =>
    line !== locationLine
      && line !== employmentTypeLine
      && line !== experienceRequiredLine
      && !/^Share$/i.test(line),
  )
  const descriptionStartIndex =
    firstShareIndex >= 0
      ? firstShareIndex + 1
      : Math.max(fallbackDescriptionStart, 0)
  const descriptionTail = afterTitle.slice(descriptionStartIndex)
  const descriptionEndIndex = descriptionTail.findIndex((line) =>
    /^Share$/i.test(line) || /^Apply$/i.test(line) || /^Apply for this position$/i.test(line),
  )
  const descriptionLines = descriptionTail
    .slice(0, descriptionEndIndex >= 0 ? descriptionEndIndex : undefined)
    .filter((line) => !/^Share$/i.test(line))
  const jobDescription = normalizeWhitespace(descriptionLines.join(' ')) || null

  return {
    title,
    location: locationLine,
    city: parseLocation(locationLine).city,
    employmentType: normalizeEmploymentType(employmentTypeLine),
    experienceRequired: experienceRequiredLine || null,
    jobDescription,
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

export const saveDryRunJobs = (jobs, filePath) => {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(jobs, null, 2), 'utf-8')
}

export const createLumberScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Lumber verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Lumber verified first-party careers page no longer matches the known public surface')
    }

    const boardHtml = await fetchText(BOARD_URL)
    const boardJobs = extractBoardJobs(boardHtml)
    const jobs = []

    for (const job of boardJobs) {
      const detailHtml = await fetchText(job.sourceUrl)
      const detail = extractJobDetail(detailHtml, job)

      jobs.push({
        ...job,
        ...detail,
        source: SOURCE,
        company: COMPANY,
        link: job.applyUrl,
        scrapedAt: (overrideNow || now)(),
        companyCareerPage: CAREERS_URL,
        companyDomain: 'lumber.com',
        atsPlatform: 'official-careers-page-plus-applytojob-board',
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createLumberScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveDryRunJobs(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
