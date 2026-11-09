import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ranegroup'
export const COMPANY = 'Rane Group'
export const HOMEPAGE_URL = 'https://ranegroup.com/'
export const ROBOTS_URL = 'https://ranegroup.com/robots.txt'
export const CAREERS_ROUTE_URLS = [
  'https://ranegroup.com/careers',
  'https://ranegroup.com/careers/',
  'https://ranegroup.com/career',
  'https://ranegroup.com/career/',
]
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://ranegroup.com/jobs',
  'https://ranegroup.com/jobs/',
  'https://ranegroup.com/join-us',
  'https://ranegroup.com/join-us/',
  'https://ranegroup.com/openings',
  'https://ranegroup.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
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

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) =>
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value) => {
  try {
    const pathname = new URL(value).pathname
    return pathname !== '/' ? pathname.replace(/\/$/, '') : pathname
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8',
    },
    attempts: 3,
    baseDelayMs: 2000,
    timeoutMs: 20000,
    label: SOURCE,
  })

export const hasVerifiedCareersLink = (html) =>
  /href=["'](?:https:\/\/ranegroup\.com)?\/careers(?:\/[^"']*)?["']/i.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Rane Group – Expanding Horizons')
    && normalized.includes('Expanding Horizons in Automotive Excellence')
    && normalized.includes('Legacy Since 1929')
    && normalized.includes('Life @ Rane')
    && normalized.includes('Join Our Team')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Careers – Rane Group')
    && normalized.includes('Life @ Rane')
    && normalized.includes('Join Our Team')
    && normalized.includes('Group Companies')
    && normalized.includes('Rane Group is a trusted manufacturer of safety and critical auto components, delivering innovative mobility solutions to customers worldwide.')
    && normalized.includes('Rane (Madras) Limited')
}

export const hasOfficialRobotsSignal = (text) => {
  const normalized = normalizeWhitespace(text)

  return normalized.includes('User-agent: *')
    && normalized.includes('Disallow: /wp-admin/')
    && normalized.includes('Allow: /wp-admin/admin-ajax.php')
    && normalized.includes('Disallow: /wp-content/uploads/wpo/wpo-plugins-tables-list.json')
}

export const isVerifiedMissingRoute = (page = {}, expectedUrl = '') => {
  const normalized = normalizeWhitespace(page?.html)
  const actualPath = normalizePathname(page?.url || expectedUrl)
  const expectedPath = normalizePathname(expectedUrl)

  return Number(page?.status) === 404
    && Boolean(actualPath)
    && actualPath === expectedPath
    && /Page not found\s*(?:&#8211;|–|-)\s*Rane Group/i.test(String(page?.html ?? ''))
    && /page can(?:'|’|&rsquo;)t be found\./i.test(String(page?.html ?? ''))
    && normalized.includes('It looks like nothing was found at this location.')
    && normalized.includes('Group Companies')
    && normalized.includes('Rane Group is a trusted manufacturer of safety and critical auto components, delivering innovative mobility solutions to customers worldwide.')
    && !hasPublicJobsSignal(page?.html)
}

export const createRaneGroupScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchText = defaultFetchText } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html) || !hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Rane Group verified official homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Rane Group homepage now appears to expose public jobs')
    }

    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasOfficialRobotsSignal(robotsTxt)) {
      throw new Error('Rane Group robots.txt no longer matches the known first-party surface')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const careersPage = await fetchPage(routeUrl)
      if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
        throw new Error('Rane Group verified careers page no longer matches the known first-party surface')
      }
      if (hasPublicJobsSignal(careersPage.html)) {
        throw new Error('Rane Group careers page now appears to expose a public jobs surface')
      }
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage, routeUrl)) {
        throw new Error(
          `Rane Group missing first-party careers route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createRaneGroupScraper().run(options)

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
