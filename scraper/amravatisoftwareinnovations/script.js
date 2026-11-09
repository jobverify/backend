import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'amravatisoftwareinnovations'
export const COMPANY = 'Amravati Software Innovations'
export const VERIFIED_AT = '2026-07-13'
export const CANDIDATE_FIRST_PARTY_URLS = [
  'https://amravatisoftwareinnovations.com/',
  'https://www.amravatisoftwareinnovations.com/',
  'https://amravatisoftwareinnovations.in/',
  'https://www.amravatisoftwareinnovations.in/',
  'https://amravatisoftware.com/',
  'https://www.amravatisoftware.com/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
  /\bnxdomain\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const defaultFetchPage = async (url) => {
  try {
    const html = await fetchTextWithRetry(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      label: SOURCE,
      attempts: 1,
      timeoutMs: 5000,
    })

    return {
      status: 200,
      url,
      html,
      errorMessage: '',
    }
  } catch (error) {
    return {
      status: 'FETCH_ERROR',
      url,
      html: '',
      errorMessage: String(error?.message ?? error),
      error,
    }
  }
}

const collectErrorText = (error) => {
  const parts = []
  let current = error
  const seen = new Set()

  while (current && !seen.has(current)) {
    seen.add(current)
    parts.push(current.message, current.code, current.hostname, current.name)
    current = current.cause
  }

  return parts.filter(Boolean).join(' ')
}

export const hasDnsResolutionFailure = (value) =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const isVerifiedAbsentFirstPartySurface = (page = {}) => {
  const normalizedText = normalizeWhitespace(page.html)

  return String(page.status) === 'DNS_ERROR'
    || (
      String(page.status) === 'FETCH_ERROR'
      && hasDnsResolutionFailure(`${page.errorMessage || ''} ${collectErrorText(page.error)}`)
      && normalizedText === ''
    )
}

export const createAmravatiSoftwareInnovationsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of CANDIDATE_FIRST_PARTY_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedAbsentFirstPartySurface(page)) {
        throw new Error(`Amravati Software Innovations verified absent first-party surface changed: ${page.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAmravatiSoftwareInnovationsScraper().run(options)

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
