import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'legionenergyproductspvtltd'
export const COMPANY = 'Legion Energy Products pvt ltd.'
export const HOMEPAGE_URL = 'https://legionenergy.in/'
export const CAREERS_URL = 'https://legionenergy.in/careers/'
export const MISSING_ROUTE_URLS = [
  'https://legionenergy.in/career',
  'https://legionenergy.in/jobs',
  'https://legionenergy.in/join-us',
]

export const EXPECTED_CULTURE_CARD_TITLES = [
  'A culture that energizes',
  "Growth that's personal and professional",
  'Empowered by people, enabled by technology',
  'Work-life with a pulse',
  "Recognition that's real",
  'Diversity, inclusion & respect',
  'Safety first, always',
  'Future-focused',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&#39;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) =>
  withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }, {
    attempts: 3,
    baseDelayMs: 2000,
    label: SOURCE,
  })

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('legion energy - powering what matters')
    && normalized.includes('powering what matters')
    && normalized.includes('founded in 2007 in bangalore')
    && normalized.includes('electrical power and telecom networks industries')
}

export const hasVerifiedCareersLink = (html) =>
  /href=["']https:\/\/legionenergy\.in\/careers\/["']/i.test(String(html ?? ''))

export const extractCultureCardTitles = (html) =>
  Array.from(
    String(html ?? '').matchAll(
      /<h4\b[^>]*class=["'][^"']*sc_services_item_title[^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h4>/gi,
    ),
    (match) => normalizeWhitespace(match[1]),
  )

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('careers - legion energy')
    && normalized.includes('we power progress. and bright minds to lead it.')
    && normalized.includes('at legion energy, every breakthrough begins with belief')
    && normalized.includes("if you're looking for more than a job")
}

export const hasVerifiedCultureCards = (html) => {
  const titles = extractCultureCardTitles(html)
  return JSON.stringify(titles) === JSON.stringify(EXPECTED_CULTURE_CARD_TITLES)
}

export const hasEmailOnlyCareersSignal = (html) => {
  const normalized = normalizeText(html)
  const page = String(html ?? '')

  return normalized.includes('apply now')
    && normalized.includes('contact hr')
    && normalized.includes('mamathashree d v')
    && normalized.includes('hrd@legionenergy.com')
    && /href=["']mailto:hrd@legionenergy\.com["']/i.test(page)
    && /href=["']tel:\+917349799929["']/i.test(page)
}

export const isVerifiedServerTimeoutPage = ({ status, url, html }) => {
  const normalized = normalizeText(html)
  const responseUrl = String(url ?? '')

  return status === 408
    && ['legionenergy.in', 'www.legionenergy.in'].includes(new URL(responseUrl || CAREERS_URL).hostname)
    && normalized.includes('408 request time-out')
    && normalized.includes('this request takes too long to process')
    && normalized.includes("please contact administrator of this web site to increase 'connection timeout'")
    && !hasSuspiciousPublicJobsSignal(html)
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\brole summary\b/i,
  /\bposition title\b/i,
  /\bapply for this role\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
]

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]

    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) {
      continue
    }

    let absoluteUrl
    try {
      absoluteUrl = new URL(href, CAREERS_URL).toString()
    } catch {
      continue
    }

    if (seen.has(absoluteUrl)) {
      continue
    }

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isSameHost = ['legionenergy.in', 'www.legionenergy.in'].includes(url.hostname)
    const isVerifiedCareersPage =
      absoluteUrl === CAREERS_URL || absoluteUrl === CAREERS_URL.slice(0, -1)
    const isSuspiciousSameHostPath =
      isSameHost
      && (
        (pathname.startsWith('/careers/') && pathname !== '/careers')
        || /\/(jobs?|job-openings?|openings?|vacanc(?:y|ies)|positions?)(\/|$)/i.test(pathname)
      )

    if (
      PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl))
      || (isSuspiciousSameHostPath && !isVerifiedCareersPage)
    ) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const hasSuspiciousPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || extractSuspiciousPublicJobLinks(html).length > 0

export const isVerifiedMissingRoute = ({ status, html }) => {
  const normalized = normalizeText(html)
  const careersLinkCount = [...String(html ?? '').matchAll(/href=["']https:\/\/legionenergy\.in\/careers\/["']/gi)].length
  const hasLegacy404Copy = normalized.includes('the requested page could not be found')
  const hasCurrent404Shell = normalized.includes('powering what matters')

  return status === 404
    && normalized.includes('page not found - legion energy')
    && normalized.includes('legion energy')
    && normalized.includes('page not found')
    && careersLinkCount >= 1
    && (hasLegacy404Copy || hasCurrent404Shell)
    && !hasSuspiciousPublicJobsSignal(html)
}

export const createLegionEnergyProductsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Legion Energy Products pvt ltd. verified official homepage no longer matches the known first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Legion Energy Products pvt ltd. homepage no longer links to the verified first-party careers page')
    }

    if (hasSuspiciousPublicJobsSignal(homepage.html)) {
      throw new Error('Legion Energy Products pvt ltd. homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (isVerifiedServerTimeoutPage(careersPage)) {
      for (const missingRouteUrl of MISSING_ROUTE_URLS) {
        const missingRoute = await fetchPage(missingRouteUrl)

        if (!isVerifiedServerTimeoutPage(missingRoute) && !isVerifiedMissingRoute(missingRoute)) {
          throw new Error('Legion Energy Products pvt ltd. missing careers routes changed materially')
        }
      }

      return []
    }

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Legion Energy Products pvt ltd. verified first-party careers surface no longer matches the known public page')
    }

    if (!hasVerifiedCultureCards(careersPage.html)) {
      throw new Error('Legion Energy Products pvt ltd. verified careers culture cards changed materially')
    }

    if (!hasEmailOnlyCareersSignal(careersPage.html)) {
      throw new Error('Legion Energy Products pvt ltd. verified email-only careers surface changed')
    }

    if (hasSuspiciousPublicJobsSignal(careersPage.html)) {
      throw new Error('Legion Energy Products pvt ltd. verified email-only careers surface drifted to a public jobs surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute) && !isVerifiedServerTimeoutPage(missingRoute)) {
        throw new Error('Legion Energy Products pvt ltd. missing careers routes changed materially')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLegionEnergyProductsScraper().run(options)

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
