import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'workplaceoption'
export const COMPANY = 'Workplace Options'
export const CAREERS_URL = 'https://www.workplaceoptions.com/careers/'
export const BOARD_URL = 'https://workplaceoptions.applytojob.com/apply/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BOARD_HOST = new URL(BOARD_URL).hostname
const BOARD_PATH = new URL(BOARD_URL).pathname.replace(/\/$/, '')
const INDIA_LOCATION_PATTERN =
  /\b(?:india|bangalore|bengaluru|karnataka|hyderabad|chennai|mumbai|pune|delhi|gurugram|gurgaon|noida|kolkata|ahmedabad)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripToLines = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|section|article|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractTitle = (html) => {
  const titles = [...String(html ?? '').matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  return titles.at(-1) || null
}

const toAbsoluteBoardUrl = (value) => {
  try {
    const url = new URL(value, BOARD_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== BOARD_HOST) return null
    if (url.pathname !== BOARD_PATH && !url.pathname.startsWith(`${BOARD_PATH}/`)) return null
    return url.href.split('#')[0]
  } catch {
    return null
  }
}

const extractJobId = (url) => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')
    return applyIndex >= 0 ? segments[applyIndex + 1] || null : null
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

const isIndiaRole = (location) => INDIA_LOCATION_PATTERN.test(location || '')

const getRemoteStatus = (location) => (/^remote\b/i.test(location || '') ? 'Remote' : 'On-site')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Careers - Workplace Options'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.workplaceoptions\.com\/careers\/["']/i.test(page)
    && /Careers at Workplace Options/i.test(text)
    && /Unlock your potential while helping people live healthier and more productive lives/i.test(text)
    && /View all Jobs/i.test(text)
    && /workplaceoptions\.applytojob\.com\/apply/i.test(page)
    && /Bangalore/i.test(text)
}

export const hasVerifiedBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Workplace Options - Career Page'
    && /Start your journey with us by browsing available jobs\./i.test(text)
    && /Current Openings/i.test(text)
    && /View Our Website/i.test(text)
    && /Skip To Job Description/i.test(text)
    && /JazzHr/i.test(page)
    && /workplaceoptions/i.test(page)
}

export const extractBoardJobs = (html) => {
  if (!hasVerifiedBoardSignal(html)) {
    throw new Error('The verified Workplace Options JazzHR board no longer matches the expected public surface')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<li\b[^>]*>\s*<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)<\/li>/gi,
  )) {
    const applyUrl = toAbsoluteBoardUrl(match[1])
    const title = normalizeWhitespace(match[2])
    const lines = stripToLines(match[3])
    const { location, city } = parseLocation(lines[0] || null)
    const department = normalizeWhitespace(lines[1] || null)
    const jobId = applyUrl ? extractJobId(applyUrl) : null

    if (!applyUrl || !title || !location || !jobId || seen.has(applyUrl) || !isIndiaRole(location)) {
      continue
    }

    seen.add(applyUrl)
    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: getRemoteStatus(location),
    })
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

export const createWorkplaceOptionScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Workplace Options careers page no longer matches the expected first-party surface')
    }

    const boardHtml = await fetchText(BOARD_URL)
    const jobs = extractBoardJobs(boardHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'workplaceoptions.com',
      atsPlatform: 'official-careers-page-plus-jazzhr-board',
    }))
  },
})

export const run = async (options = {}) => createWorkplaceOptionScraper().run(options)

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
