import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zivame'
export const COMPANY = 'Zivame'
export const VERIFIED_ON = '2026-08-13'
export const HOMEPAGE_URL = 'https://www.zivame.com/'
export const CAREERS_URL = 'https://www.zivame.com/careers'
export const LEGACY_CAREERS_URL = 'https://careers.zivame.com/'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bjob category\b/i,
  /\bjob type\b/i,
  /\bjob location\b/i,
  /\bapply now\b/i,
  /\bclick here to apply\b/i,
  /\bview jobs\b/i,
  /\/job-openings\//i,
]

const DNS_RESOLUTION_FAILURE_PATTERNS = [
  /\bgetaddrinfo\s+enotfound\b/i,
  /\benotfound\b/i,
  /\bthe remote name could not be resolved\b/i,
  /\bname or service not known\b/i,
  /\bnxdomain\b/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const collectErrorMessages = (error) => {
  const messages = []
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    messages.push(String(current?.message ?? current ?? ''))
    current = current?.cause
  }

  return messages.filter(Boolean)
}

const defaultFetchPage = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    return {
      status: response.status,
      url: response.url || url,
      html: await response.text(),
      errorMessage: '',
    }
  } catch (error) {
    return {
      status: 'ERROR',
      url,
      html: '',
      errorMessage: collectErrorMessages(error).join(' | '),
    }
  }
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasDnsResolutionFailure = (value = '') =>
  DNS_RESOLUTION_FAILURE_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && /cloudflare/i.test(page)
    && (
      text.includes('Please enable cookies')
      || /cdn-cgi\/challenge-platform/i.test(page)
      || /challenges\.cloudflare\.com/i.test(page)
    )
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Zivame\s*<\/title>/i.test(page)
    && text.includes('Brands on Zivame')
    && text.includes('Track/Return Order')
    && text.includes('Own a Franchise')
    && text.includes('Find Your Fit')
    && /href=["'](?:https:\/\/www\.zivame\.com)?\/careers["']/i.test(page)
}

export const isBlockedCareersRoute = (page = {}) =>
  Number(page.status) === 403
  && hasCloudflareChallengeSignal(page.html)

export const isBlockedHomepageRoute = (page = {}) =>
  Number(page.status) === 403
  && hasCloudflareChallengeSignal(page.html)

export const isUnavailableLegacyCareersHost = (page = {}) =>
  String(page.status) === 'ERROR'
  && hasDnsResolutionFailure(page.errorMessage)

export const createZivameScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    const homepageIsOfficial = hasOfficialHomepageSignal(homepage.html)
    const homepageIsBlocked = isBlockedHomepageRoute(homepage)

    if (!homepageIsOfficial && !homepageIsBlocked) {
      throw new Error('Zivame homepage no longer matches the verified official or blocked first-party state')
    }

    if (homepageIsOfficial && hasPublicJobsSignal(homepage.html)) {
      throw new Error('Zivame homepage now appears to expose public jobs')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!isBlockedCareersRoute(careersPage)) {
      if (Number(careersPage.status) === 200 && hasPublicJobsSignal(careersPage.html)) {
        throw new Error('Zivame official careers route now appears to expose public jobs')
      }

      throw new Error('Zivame official careers route no longer matches the verified blocked first-party state')
    }

    const legacyCareersPage = await fetchPage(LEGACY_CAREERS_URL)
    if (!isUnavailableLegacyCareersHost(legacyCareersPage)) {
      if (Number(legacyCareersPage.status) === 200 && hasPublicJobsSignal(legacyCareersPage.html)) {
        throw new Error('Zivame legacy careers host now appears to expose public jobs')
      }

      throw new Error('Zivame legacy careers host no longer matches the verified unavailable state')
    }

    return []
  },
})

export const run = async (options = {}) => createZivameScraper().run(options)

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
