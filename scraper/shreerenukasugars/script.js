import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { SHREE_RENUKA_SUGARS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HEADER_LINES = ['Position', 'Department', 'Location', 'Experience']

export const PROVIDER_METADATA = SHREE_RENUKA_SUGARS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeForBoundarySearch = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/[\u2019\u2018]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/â€™|â€˜|Ã¢â‚¬â„¢/g, "'")
  .replace(/â€“|â€”|Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '-')

const htmlToText = (html = '') => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/main|\/body|\/html|\/h[1-6]|\/ol|\/ul|\/li|\/button)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|main|body|html|h[1-6]|ol|ul|li|button)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .trim()

const buildJobId = (title, location) => `${String(title ?? '')}-${String(location ?? '')}`
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: 'India',
      city: null,
    }
  }

  return {
    location: /india/i.test(normalized) ? normalized : `${normalized}, India`,
    city: normalizeWhitespace(normalized.split(',')[0]) || null,
  }
}

const extractOpportunityLines = (html = '') => {
  const text = normalizeForBoundarySearch(htmlToText(html))
  const startMatch = text.match(/Here's a list of the current opportunities:\s*/i)
  if (!startMatch?.index && startMatch?.index !== 0) return []

  const startIndex = startMatch.index + startMatch[0].length
  const endMatch = /Additionally, you can write to us on/i.exec(text.slice(startIndex))
  const endIndex = endMatch ? startIndex + endMatch.index : text.length

  const body = text.slice(startIndex, endIndex)

  return body
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/^apply$/i.test(line))
}

const extractOpportunityRows = (html = '') => {
  const lines = extractOpportunityLines(html)
  const jobLines = HEADER_LINES.every((label, index) => lines[index] === label)
    ? lines.slice(HEADER_LINES.length)
    : lines

  const rows = []
  for (let index = 0; index + 3 < jobLines.length; index += 4) {
    const row = jobLines.slice(index, index + 4)
    if (row.length === 4 && row.every(Boolean)) rows.push(row)
  }

  return rows
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = normalizeForBoundarySearch(String(html ?? ''))
  const text = normalizeForBoundarySearch(htmlToText(rawHtml))
  const title = normalizeForBoundarySearch(
    normalizeWhitespace(rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
  )

  return /^Join The Team\s*-\s*Renuka Sugar$/i.test(title)
    && /(?:Come\s+)?Join\s+Shree\s+Renuka\s+Sugars\s+Ltd\./i.test(text)
    && /Here's a list of the current opportunities:/i.test(text)
    && /Additionally, you can write to us on/i.test(text)
}

export const hasPublicJobSignals = (html = '') => extractOpportunityRows(html).length > 0

export const extractInlineOpportunities = (
  html,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => extractOpportunityRows(html)
  .map(([title, department, rawLocation, experience]) => {
    const { location, city } = buildLocation(rawLocation)
    const jobId = buildJobId(title, city || rawLocation || 'india')

    if (!title || !jobId) return null

    return {
      title: normalizeWhitespace(title),
      company: COMPANY,
      department: normalizeWhitespace(department),
      location,
      city,
      state: null,
      country: 'India',
      workplaceType: null,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      link: CAREERS_URL,
      source: SOURCE,
      employmentType: null,
      experienceRequired: normalizeWhitespace(experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      scrapedAt,
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'shreerenukasugars-html',
  timeoutMs: 15000,
})

export const createShreeRenukaSugarsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Verified Shree Renuka Sugars careers page changed materially')
    }

    if (!hasPublicJobSignals(careersHtml)) {
      throw new Error('Verified Shree Renuka Sugars public jobs surface changed materially')
    }

    const jobs = extractInlineOpportunities(careersHtml, {
      scrapedAt: now(),
    })

    if (jobs.length === 0) {
      throw new Error('Verified Shree Renuka Sugars public jobs surface changed materially')
    }

    return jobs
  },
})

export const run = async (options = {}) => createShreeRenukaSugarsScraper(options).run(options)

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
