import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'technologicsglobalresearchproject'
export const COMPANY = 'Technologics Global Research & Project'
export const VERIFIED_AT = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy first-party public website or careers surface was discoverable on July 13, 2026, and the canonical company-name domains were unresolved.'
export const CANDIDATE_FIRST_PARTY_URLS = [
  'https://technologicsglobalresearchproject.com/',
  'https://www.technologicsglobalresearchproject.com/',
  'https://technologicsglobalresearchproject.in/',
  'https://www.technologicsglobalresearchproject.in/',
  'https://technologicsglobalresearchandproject.com/',
  'https://www.technologicsglobalresearchandproject.com/',
  'https://technologicsglobalresearchandproject.in/',
  'https://www.technologicsglobalresearchandproject.in/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bnxdomain\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
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

const toErrorMessage = (error) =>
  String(error?.cause?.message ?? error?.message ?? error ?? '')

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
    const errorMessage = toErrorMessage(error)

    return {
      status: hasDnsResolutionFailure(errorMessage) ? 'DNS_ERROR' : 'FETCH_ERROR',
      url,
      html: '',
      errorMessage,
    }
  }
}

export const hasDnsResolutionFailure = (value) =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const isVerifiedNoSignalFirstPartySurface = (page = {}) => {
  const normalizedText = normalizeWhitespace(page.html)

  return (
    String(page.status) === 'DNS_ERROR'
    && normalizedText === ''
  )
    || (
      String(page.status) === 'FETCH_ERROR'
      && (hasDnsResolutionFailure(page.errorMessage) || /\bfetch failed\b/i.test(String(page.errorMessage ?? '')))
      && normalizedText === ''
    )
}

export const createTechnologicsGlobalResearchProjectScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of CANDIDATE_FIRST_PARTY_URLS) {
      const page = await fetchPage(url)

      if (!isVerifiedNoSignalFirstPartySurface(page)) {
        throw new Error(
          `Technologics Global Research & Project verified no-signal first-party surface changed: ${page.url || url}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) =>
  createTechnologicsGlobalResearchProjectScraper().run(options)

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
