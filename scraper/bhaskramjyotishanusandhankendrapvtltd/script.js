import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bhaskramjyotishanusandhankendrapvtltd'
export const COMPANY = 'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd'
export const VERIFIED_AT = '2026-07-13'
export const CANDIDATE_FIRST_PARTY_URLS = [
  'https://bhaskramjyotishanusandhankendrapvtltd.com/',
  'https://www.bhaskramjyotishanusandhankendrapvtltd.com/',
  'https://bhaskramjyotishanusandhankendrapvtltd.in/',
  'https://www.bhaskramjyotishanusandhankendrapvtltd.in/',
  'https://bhaskramjyotishanusandhankendra.com/',
  'https://www.bhaskramjyotishanusandhankendra.com/',
  'https://bhaskramjyotishanusandhankendra.in/',
  'https://www.bhaskramjyotishanusandhankendra.in/',
  'https://bhaskram.com/',
  'https://www.bhaskram.com/',
  'https://bhaskram.in/',
  'https://www.bhaskram.in/',
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

const errorMessageChain = (value) => {
  const messages = []
  const seen = new Set()
  let current = value

  while (current && !seen.has(current)) {
    seen.add(current)
    if (typeof current === 'string') {
      messages.push(current)
      break
    }

    for (const field of ['message', 'code', 'name', 'hostname']) {
      if (current[field]) messages.push(String(current[field]))
    }

    current = current.cause
  }

  return messages.filter(Boolean)
}

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
      timeoutMs: 15000,
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
      errorMessage: errorMessageChain(error).join(' | ') || String(error?.message ?? error),
      error,
    }
  }
}

export const hasDnsResolutionFailure = (value) =>
  errorMessageChain(value)
    .concat(String(value?.errorMessage ?? ''))
    .some((message) => DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(message)))

export const isVerifiedAbsentFirstPartySurface = (page = {}) => {
  const normalizedText = normalizeWhitespace(page.html)

  return String(page.status) === 'DNS_ERROR'
    || (
      String(page.status) === 'FETCH_ERROR'
      && (hasDnsResolutionFailure(page.error || page.errorMessage) || hasDnsResolutionFailure(page.errorMessage))
      && normalizedText === ''
    )
}

export const createBhaskramJyotishAnusandhanKendraPvtLtdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of CANDIDATE_FIRST_PARTY_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedAbsentFirstPartySurface(page)) {
        throw new Error(`Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd verified absent first-party surface changed: ${page.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createBhaskramJyotishAnusandhanKendraPvtLtdScraper().run(options)

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
