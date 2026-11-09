import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'teleperformance'
export const COMPANY = 'Teleperformance'
export const INDIA_LOCATION_URL = 'https://www.tp.com/en-in/locations/india/'
export const INDIA_CAREERS_URL = 'https://www.tp.com/en-in/locations/india/careers/'
export const GLOBAL_JOB_OPPORTUNITIES_URL = 'https://www.tp.com/en-us/careers/job-opportunities/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const trimTrailingSlash = (value) => String(value ?? '').replace(/\/+$/, '')
const INDIA_CAREERS_PATH = trimTrailingSlash(new URL(INDIA_CAREERS_URL).pathname)
const GLOBAL_JOB_OPPORTUNITIES_PATH = trimTrailingSlash(new URL(GLOBAL_JOB_OPPORTUNITIES_URL).pathname)
const TP_ORIGIN = new URL(INDIA_CAREERS_URL).origin

export const extractIndiaCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], INDIA_LOCATION_URL)
    if (absoluteUrl === INDIA_CAREERS_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasIndiaLocationSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /<title>\s*TP in India\b/i.test(rawHtml)
    && normalized.includes('tp in india')
    && normalized.includes('digital cx & transformation coe for tp')
}

const isPublicJobRecordUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = trimTrailingSlash(url.pathname)

    if (url.origin !== TP_ORIGIN) return false

    return pathname.startsWith(`${INDIA_CAREERS_PATH}/`)
      || pathname.startsWith(`${GLOBAL_JOB_OPPORTUNITIES_PATH}/`)
  } catch {
    return false
  }
}

export const extractPublicJobRecordUrls = (html) => {
  const publicJobRecordUrls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], INDIA_CAREERS_URL)
    if (!absoluteUrl || seen.has(absoluteUrl) || !isPublicJobRecordUrl(absoluteUrl)) continue

    seen.add(absoluteUrl)
    publicJobRecordUrls.push(absoluteUrl)
  }

  return publicJobRecordUrls
}

export const hasIndiaCareersShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /<title>\s*Jobs(?:&#160;|\s)+in(?:&#160;|\s)+TP(?:&#160;|\s)+India\b/i.test(rawHtml)
    && normalized.includes('tp in india')
    && normalized.includes('work with us')
    && normalized.includes('clear filter')
    && normalized.includes('country (all)')
    && normalized.includes('india')
    && normalized.includes('only work-from-home')
    && normalized.includes('see more results')
    && normalized.includes('back to job opportunities page')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTeleperformanceScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const indiaLocationHtml = await fetchText(INDIA_LOCATION_URL)
    if (!hasIndiaLocationSignal(indiaLocationHtml)) {
      throw new Error('Teleperformance India location page no longer matches the verified official careers handoff')
    }

    const indiaCareersUrl = extractIndiaCareersUrl(indiaLocationHtml)
    if (indiaCareersUrl !== INDIA_CAREERS_URL) {
      throw new Error('Teleperformance India location page no longer links to the verified India careers route')
    }

    const indiaCareersHtml = await fetchText(INDIA_CAREERS_URL)
    const publicJobRecordUrls = extractPublicJobRecordUrls(indiaCareersHtml)

    if (publicJobRecordUrls.length > 0) {
      throw new Error('Teleperformance public India careers surface now exposes job records')
    }

    if (!hasIndiaCareersShellSignal(indiaCareersHtml)) {
      throw new Error('Teleperformance India careers shell no longer matches the verified zero-job state')
    }

    return []
  },
})

export const run = async (options = {}) => createTeleperformanceScraper().run(options)

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
