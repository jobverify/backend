import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://www.zemosolabs.com'
export const CAREERS_URL = `${BASE_URL}/careers`
export const SOURCE = 'zemosotechnologies'
export const COMPANY = 'Zemoso Technologies'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const isRoleUrl = (value) => {
  if (!value) return false

  try {
    const url = new URL(value)
    return /(^|\.)zemosolabs\.com$/i.test(url.hostname)
      && /^\/careers\/[^/]+\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

const isGenericRoleLinkText = (value) => /^(learn more|careers|view job openings)$/i.test(value || '')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Zemoso Technologies|Zemoso/i.test(page)
    && /JOB OPENINGS/i.test(page)
    && /Interested in a design or engineering internship\?/i.test(page)
    && /Send us your resume/i.test(page)
    && /href=["'][^"']*\/careers\/[^/"'#?]+\/?["']/i.test(page)
}

export const extractListings = (html) => {
  const listings = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = normalizeWhitespace(match[2])

    if (!isRoleUrl(sourceUrl) || !title || isGenericRoleLinkText(title) || seen.has(sourceUrl)) continue

    seen.add(sourceUrl)
    listings.push({ title, sourceUrl })
  }

  return listings
}

export const hasClosedRoleSignal = (html) => {
  const page = String(html ?? '')
  return /Position Closed/i.test(page) && /View job openings/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createZemosoTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Zemoso Technologies careers page no longer matches the verified official public careers surface')
    }

    const listings = extractListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('Zemoso Technologies careers page no longer exposes the verified closed-role listings state')
    }

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)

      if (!hasClosedRoleSignal(detailHtml)) {
        throw new Error('Zemoso Technologies careers page now exposes open public roles')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createZemosoTechnologiesScraper().run(options)

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
