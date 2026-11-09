import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zepto'
export const COMPANY = 'Zepto'
export const HOMEPAGE_URL = 'https://www.zepto.com/'
export const CAREERS_URL = 'https://www.zepto.com/careers'
export const CAREERS_ALIAS_URL = 'https://www.zepto.com/careers/'
export const APPLY_URL = 'https://zepto.talentrecruit.com/career-page'
export const BLOCKED_REASON =
  'Official Zepto careers route redirects to a third-party TalentRecruit board, so there is no first-party public jobs surface to scrape.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeAbsoluteUrl = (value, base = HOMEPAGE_URL) => {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const getHeader = (headers, name) => {
  if (!headers) return null

  if (typeof headers.get === 'function') {
    return headers.get(name)
  }

  const targetName = String(name).toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === targetName) {
      return value
    }
  }

  return null
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
  })

  return {
    status: response.status,
    url,
    headers: response.headers,
    html: await response.text(),
  }
}

const extractLinkByText = (html, textPattern) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = normalizeWhitespace(match[2])
    if (!textPattern.test(text)) {
      continue
    }

    const href = normalizeAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (href) {
      return href
    }
  }

  return null
}

const extractRefreshUrl = (headers, pageUrl) => {
  const refresh = getHeader(headers, 'refresh')
  const rawUrl = String(refresh ?? '').match(/url=(.+)$/i)?.[1]
  return normalizeAbsoluteUrl(rawUrl, pageUrl || HOMEPAGE_URL)
}

const describePage = (page = {}) => {
  const location = normalizeAbsoluteUrl(getHeader(page.headers, 'location'), page.url || HOMEPAGE_URL)
  const refreshUrl = extractRefreshUrl(page.headers, page.url || HOMEPAGE_URL)

  return `status=${page.status ?? 'unknown'} url=${page.url || 'unknown'} location=${location || 'none'} refresh=${refreshUrl || 'none'}`
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (
    /<title[^>]*>\s*(?:Welcome to Zepto, India's Fastest Online Grocery Delivery App!|Zepto: Online Grocery Delivery App - Groceries in Minutes)\s*<\/title>/i.test(String(html ?? ''))
    || normalized.includes("zepto marketplace private limited")
    || normalized.includes('delivery in minutes')
  )
    && normalized.includes('how it works')
    && normalized.includes('experience lighting-fast speed & get all your items delivered in minutes')
    && normalized.includes('careers')
}

export const extractCareersUrl = (html) => extractLinkByText(html, /^careers$/i)

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isKnownCareersAliasRedirect = (page = {}) => {
  if (Number(page.status) !== 308) {
    return false
  }

  const location = normalizeAbsoluteUrl(getHeader(page.headers, 'location'), page.url || CAREERS_ALIAS_URL)
  const refreshUrl = extractRefreshUrl(page.headers, page.url || CAREERS_ALIAS_URL)

  return page.url === CAREERS_ALIAS_URL
    && location === CAREERS_URL
    && refreshUrl === CAREERS_URL
}

export const isBlockedThirdPartyCareersHandoff = (page = {}) => {
  if (Number(page.status) !== 308) {
    return false
  }

  const location = normalizeAbsoluteUrl(getHeader(page.headers, 'location'), page.url || CAREERS_URL)
  const refreshUrl = extractRefreshUrl(page.headers, page.url || CAREERS_URL)

  return page.url === CAREERS_URL
    && location === APPLY_URL
    && refreshUrl === APPLY_URL
}

export const isBlockedAwsWafCareersInterstitial = (page = {}) =>
  Number(page.status) === 202
  && /window\.awsWafCookieDomainList/i.test(String(page.html ?? ''))
  && /zepto\.com/i.test(String(page.html ?? ''))

export const createZeptoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const homepageBlockedByWaf = isBlockedAwsWafCareersInterstitial(homepage)

    if (!homepageBlockedByWaf && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Zepto homepage no longer matches the verified official public surface')
    }

    if (!homepageBlockedByWaf && hasPublicJobsSignal(homepage.html)) {
      throw new Error('Zepto homepage now appears to expose first-party public jobs')
    }

    const careersUrl = extractCareersUrl(homepage.html)
    if (!homepageBlockedByWaf && careersUrl !== CAREERS_URL) {
      throw new Error('Zepto homepage no longer links to the verified official careers route')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!isBlockedThirdPartyCareersHandoff(careersPage) && !isBlockedAwsWafCareersInterstitial(careersPage)) {
      if (Number(careersPage.status) === 200 && hasPublicJobsSignal(careersPage.html)) {
        throw new Error('Zepto official careers route now appears to expose first-party public jobs')
      }

      throw new Error(
        `Zepto official careers route changed materially: expected third-party handoff to ${APPLY_URL}; received ${describePage(careersPage)}`,
      )
    }

    const careersAliasPage = await fetchPage(CAREERS_ALIAS_URL)
    if (!isKnownCareersAliasRedirect(careersAliasPage) && !isBlockedAwsWafCareersInterstitial(careersAliasPage)) {
      throw new Error(
        `Zepto trailing-slash careers alias changed materially: expected redirect to ${CAREERS_URL}; received ${describePage(careersAliasPage)}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createZeptoScraper().run(options)

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
