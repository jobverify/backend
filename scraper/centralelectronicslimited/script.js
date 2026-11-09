import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'centralelectronicslimited'
export const COMPANY = 'Central Electronics Limited'
export const CAREERS_URL = 'https://www.celindia.co.in/career-opportunity'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractHref = (html) => html.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || null

const parseDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (!match) return null

  const [, day, month, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const extractRows = (html) => {
  const table = String(html ?? '').match(
    /<table\b(?=[^>]*\bid\s*=\s*["'](?:career-opportunity|getAllCareerList)["'])[^>]*>[\s\S]*?<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i,
  )
  if (!table) return []

  return [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) =>
      [...match[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => cell[1]))
    .filter((cells) => cells.length >= 5)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Career Opportunity\s*(?:\||-|&ndash;|&mdash;|&#8211;|&#8212;)\s*Central Electronics Limited\s*<\/title>/i.test(page)
    && /\bCentral Electronics Limited\b/i.test(page)
    && /\bid\s*=\s*["'](?:career-opportunity|getAllCareerList|formCareer)["']/i.test(page)
}

export const hasEmptyNotificationSignal = (html) =>
  /No Recruitment Notifications Found\./i.test(String(html ?? ''))

export const extractOpenings = (html) => extractRows(html)
  .map((cells) => {
    const rowNumber = stripTags(cells[0])
    const title = stripTags(cells[1])
    const sourceHref = extractHref(cells[4])
    const applyHref = cells[5] ? extractHref(cells[5]) : null

    if (!title || !sourceHref) return null

    const sourceUrl = new URL(sourceHref, CAREERS_URL).toString()

    return {
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: `centralelectronicslimited-${rowNumber || title}`,
      requisitionId: `centralelectronicslimited-${rowNumber || title}`,
      sourceUrl,
      applyUrl: applyHref ? new URL(applyHref, CAREERS_URL).toString() : sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: parseDate(stripTags(cells[2])),
      closingDate: parseDate(stripTags(cells[3])),
      jobDescription: 'Official Central Electronics Limited recruitment notice. See the advertisement for role details.',
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCentralElectronicsLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Central Electronics Limited careers page no longer matches the verified official public surface')
    }

    if (hasEmptyNotificationSignal(html)) {
      return []
    }

    const jobs = extractOpenings(html)
    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createCentralElectronicsLimitedScraper().run(options)

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
