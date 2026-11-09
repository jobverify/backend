import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bharatpetroleum'
export const COMPANY = 'Bharat Petroleum'
export const JOB_OPENINGS_URL = 'https://www.bharatpetroleum.in/careers/job-openings'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(?:br|\/p|\/div|\/li|\/td|\/tr|\/table|\/tbody|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, JOB_OPENINGS_URL).toString()
  } catch {
    return null
  }
}

const MONTH_INDEX = new Map([
  ['jan', '01'],
  ['january', '01'],
  ['feb', '02'],
  ['february', '02'],
  ['mar', '03'],
  ['march', '03'],
  ['apr', '04'],
  ['april', '04'],
  ['may', '05'],
  ['jun', '06'],
  ['june', '06'],
  ['jul', '07'],
  ['july', '07'],
  ['aug', '08'],
  ['august', '08'],
  ['sep', '09'],
  ['sept', '09'],
  ['september', '09'],
  ['oct', '10'],
  ['october', '10'],
  ['nov', '11'],
  ['november', '11'],
  ['dec', '12'],
  ['december', '12'],
])

const formatDateToIso = (value) => {
  const match = String(value ?? '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const parseDateToIso = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const numeric = normalized.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/)
  if (numeric) {
    const [, day, month, year] = numeric
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const named = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})\b/)
  if (named) {
    const [, day, monthName, year] = named
    const month = MONTH_INDEX.get(monthName.toLowerCase())
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`
  }

  return null
}

const resolveNowIso = (now = () => new Date().toISOString()) => {
  const value = typeof now === 'function' ? now() : now
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const buildJobId = (requisitionId) => `${SOURCE}-${String(requisitionId ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')}`

const extractRequisitionId = (applyUrl) => {
  try {
    return new URL(applyUrl).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const isIbpsApplyUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'ibpsreg.ibps.in' || hostname === 'ibpsonline.ibps.in'
  } catch {
    return false
  }
}

export const isOfficialJobOpeningsPage = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const canonical = normalizeWhitespace(page.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? '')
  const text = stripTags(page)

  return /^Job Openings \| Official Website of BPCL, India$/i.test(title)
    && canonical === JOB_OPENINGS_URL
    && text.includes('Job Openings')
    && text.includes('POSTS CALLED FOR')
    && text.includes('DETAILS OF THE ADVERTISEMENT')
    && text.includes('LAST DATE FOR APPLYING')
    && text.includes('Apply Online')
}

const extractCells = (rowHtml = '') => [...String(rowHtml ?? '').matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
  .map((match) => match[1])

const extractFirstParagraphText = (html = '') => {
  const paragraph = String(html ?? '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]
  return stripTags(paragraph ?? html)
}

const extractPostingDate = (html = '') => {
  const openFrom = String(html ?? '').match(/open from\s+([^.<>]+?)(?:\.|<|$)/i)?.[1]
  return parseDateToIso(openFrom)
}

const extractClosingDate = (html = '') => parseDateToIso(stripTags(html))

export const extractActiveJobOpenings = (html, {
  now = () => new Date().toISOString(),
} = {}) => {
  if (!isOfficialJobOpeningsPage(html)) {
    throw new Error('Bharat Petroleum job openings page no longer matches the verified official surface')
  }

  const today = resolveNowIso(now).slice(0, 10)
  const jobs = []

  for (const match of String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1]
    const cells = extractCells(rowHtml)
    if (cells.length < 4 || /POSTS CALLED FOR/i.test(stripTags(cells[1]))) {
      continue
    }

    const detailsCell = cells[2]
    const anchors = [...detailsCell.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((anchorMatch) => ({
        url: toAbsoluteUrl(anchorMatch[1]),
        text: stripTags(anchorMatch[2]),
      }))

    const sourceLink = anchors.find((anchor) =>
      anchor.url
      && /(?:detailed\s+)?advertisement/i.test(anchor.text)
      && !/corrigendum|hindi/i.test(anchor.text))
    const applyLink = anchors.find((anchor) => anchor.url && /apply online|click here to apply/i.test(anchor.text))

    if (!sourceLink?.url || !applyLink?.url || !isIbpsApplyUrl(applyLink.url)) {
      continue
    }

    const postingDate = extractPostingDate(detailsCell)
    const closingDate = extractClosingDate(cells[3])
    const requisitionId = extractRequisitionId(applyLink.url)
    const title = extractFirstParagraphText(cells[1])

    if (!title || !closingDate || !requisitionId || closingDate < today) {
      continue
    }

    jobs.push({
      title,
      company: COMPANY,
      location: null,
      city: null,
      country: 'India',
      jobId: buildJobId(requisitionId),
      requisitionId,
      sourceUrl: sourceLink.url,
      applyUrl: applyLink.url,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate,
      jobDescription: 'Apply through the official IBPS recruitment portal before the closing date.',
      remoteStatus: null,
    })
  }

  return jobs
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createBharatPetroleumScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const html = await fetchText(JOB_OPENINGS_URL)
    const scrapedAt = resolveNowIso(now)

    return extractActiveJobOpenings(html, { now }).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createBharatPetroleumScraper().run(options)

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
