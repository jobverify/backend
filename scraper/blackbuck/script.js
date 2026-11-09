import path from 'node:path'
import { fileURLToPath } from 'node:url'
import{createCurrentSurfaceScraper}from'../atomberg/currentSurface.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'blackbuck'
export const COMPANY = 'BlackBuck'
export const HOMEPAGE_URL = 'https://blackbuck.com/'
export const CAREERS_URL = 'https://blackbuck.com/team-blackbuck.html'
export const BROKEN_ROUTE_URLS = [
  'https://blackbuck.com/careers',
  'https://blackbuck.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title[^>]*>\s*(?:Home\s*-\s*)?BlackBuck\s*<\/title>/i.test(rawHtml)
    && normalized.includes('blackbuck')
    && (normalized.includes('logistics') || normalized.includes('digital trucking platform'))
    && /team-blackbuck\.html/i.test(rawHtml)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*(?:Team BlackBuck|Life@BlackBuck\s*-\s*BlackBuck)\s*<\/title>/i.test(rawHtml)
    && normalized.includes('BlackBuck')
    && (
      normalized.includes('Team BlackBuck')
      || normalized.includes('Fueling Great Minds')
      || normalized.includes('Life at BlackBuck')
    )
}

export const hasEmailOnlyCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  const page = String(html ?? '')

  return normalized.includes('careers@blackbuck.com')
    && /href=["']mailto:careers@blackbuck\.com["']/i.test(page)
}

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue

    let absoluteUrl
    try {
      absoluteUrl = new URL(href, CAREERS_URL).toString()
    } catch {
      continue
    }

    if (seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const sameHost = ['blackbuck.com', 'www.blackbuck.com'].includes(url.hostname)
    const suspiciousSameHostPath = sameHost && /\/(jobs?|careers?)(\/|$)/i.test(url.pathname)

    if (
      PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl))
      || suspiciousSameHostPath
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

export const isVerifiedBrokenRoute = ({ status }) => status === 502


export const createBlackBuckScraper=defaults=>createCurrentSurfaceScraper({source:SOURCE,url:CAREERS_URL,canonicalUrl:CAREERS_URL,requireCanonical:false,title:/Life@BlackBuck.*BlackBuck/i,companySignal:'Blackbuck',email:'careers@blackbuck.com',recruitingCopy:/Ready to Join\?/i},defaults)

export const run = async (options = {}) => createBlackBuckScraper().run(options)

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
