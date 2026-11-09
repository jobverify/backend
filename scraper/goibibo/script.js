import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GOIBIBO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = GOIBIBO_CATALOG.source
export const COMPANY = GOIBIBO_CATALOG.companyName
export const VERIFIED_ON = GOIBIBO_CATALOG.verifiedOn
export const HOMEPAGE_URL = GOIBIBO_CATALOG.homepageUrl
export const CAREER_URL = GOIBIBO_CATALOG.companyCareerPage
export const ACCEPTED_CAREER_PAGE_STATUSES = GOIBIBO_CATALOG.acceptedCareerPageStatuses
export const PROVIDER_METADATA = GOIBIBO_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15000

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const extractCareerUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (absoluteUrl === CAREER_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const pageHasOfficialGoibiboSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*goibibo\s*-\s*best travel website/i.test(page)
    && normalized.includes('book hotels, flights, trains, bus and cabs')
    && extractCareerUrl(page) === CAREER_URL
}

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /data-job-id=/i,
  /linkedin\.com\/jobs\/view/i,
]

export const hasPublicJobSignals = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedUnavailableCareerPage = (page = {}) =>
  ACCEPTED_CAREER_PAGE_STATUSES.includes(Number(page.status))
  && !hasPublicJobSignals(page.html)

const isHomepageTimeoutError = (error) => {
  const message = String(error?.message ?? '')
  return error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
    || /aborted due to timeout|timed out/i.test(message)
}

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const createGoibiboScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    let homepage

    try {
      homepage = await fetchPage(HOMEPAGE_URL)
    } catch (error) {
      if (!isHomepageTimeoutError(error)) {
        throw error
      }

      let careerPage
      try {
        careerPage = await fetchPage(CAREER_URL)
      } catch (careerError) {
        if (isHomepageTimeoutError(careerError)) {
          return []
        }

        throw careerError
      }

      if (isVerifiedUnavailableCareerPage(careerPage)) {
        return []
      }

      throw error
    }

    if (
      homepage.status !== 200
      || !pageHasOfficialGoibiboSignals(homepage.html)
      || extractCareerUrl(homepage.html) !== CAREER_URL
    ) {
      throw new Error('Goibibo official homepage no longer matches the verified careers handoff')
    }

    let careerPage
    try {
      careerPage = await fetchPage(CAREER_URL)
    } catch (error) {
      if (isHomepageTimeoutError(error)) {
        return []
      }

      throw error
    }

    if (!isVerifiedUnavailableCareerPage(careerPage)) {
      throw new Error('Goibibo careers route no longer matches the verified unavailable surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGoibiboScraper().run(options)

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
