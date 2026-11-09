import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import LOGROCKET_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = LOGROCKET_CATALOG.source
export const COMPANY = LOGROCKET_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = LOGROCKET_CATALOG.officialBrandName
export const VERIFIED_ON = LOGROCKET_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = LOGROCKET_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = LOGROCKET_CATALOG
export const CAREERS_PAGE_URL = LOGROCKET_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

const extractNextDataPayload = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const extractOpeningsFromNextData = (html = '') => {
  const payload = extractNextDataPayload(html)
  const openings = payload?.props?.pageProps?.openings
  if (!Array.isArray(openings)) return []

  const normalizedOpenings = openings
    .map((opening) => {
      const id = normalizeWhitespace(opening?.id)
      const title = normalizeWhitespace(opening?.title)
      const location = normalizeWhitespace(opening?.location)
      const department = normalizeWhitespace(opening?.department)
      const workType = normalizeWhitespace(opening?.workType)

      if (!id || !title || !location || !department || !workType) {
        return null
      }

      return {
        id,
        title,
        location,
        department,
        workType,
        label: [title, location, department, workType].join(' '),
      }
    })
    .filter(Boolean)

  return [...new Map(normalizedOpenings.map((opening) => [opening.id, opening])).values()]
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''
  const openings = extractOpeningsFromNextData(page)

  return /<title[^>]*>\s*careers\s*\|\s*logrocket\s*<\/title>/i.test(page)
    && /<link[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/logrocket\.com\/careers["'][^>]*>/i.test(page)
    && normalized.includes('logrocket is growing. welcome aboard.')
    && /<script[^>]*id=["']__NEXT_DATA__["']/i.test(page)
    && openings.length > 0
}

export const hasIndiaOpenings = (openings = []) =>
  openings.some((opening) => /\bindia\b/i.test(String(opening.location ?? opening.label ?? '')))

export const createLogRocketScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    signal,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL, { signal })

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Verified LogRocket careers page changed materially')
    }

    const openings = extractOpeningsFromNextData(careersHtml)
    if (openings.length === 0) {
      throw new Error('Verified LogRocket openings payload changed materially')
    }

    if (hasIndiaOpenings(openings)) {
      throw new Error('Verified LogRocket India slice changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createLogRocketScraper(options).run(options)

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
