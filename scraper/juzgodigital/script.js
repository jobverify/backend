import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'juzgodigital'
export const COMPANY = 'Juzgodigital Private Limited'
export const HOMEPAGE_URL = 'https://www.juzgodigital.com/'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that https://www.juzgodigital.com/ remained JuzGoDigital Private Limited\'s first-party homepage and that its common same-domain careers routes such as https://www.juzgodigital.com/careers still returned a 403 AccessDenied response without exposing a trustworthy public jobs surface.'
export const CAREERS_ROUTE_URLS = [
  'https://www.juzgodigital.com/careers',
  'https://www.juzgodigital.com/careers/',
  'https://www.juzgodigital.com/career',
  'https://www.juzgodigital.com/career/',
  'https://www.juzgodigital.com/jobs',
  'https://www.juzgodigital.com/jobs/',
  'https://www.juzgodigital.com/join-us',
  'https://www.juzgodigital.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN = /href=["']https?:\/\/www\.juzgodigital\.com\/(?:careers?|jobs?|join-us)(?:[\/#?][^"']*)?["']|href=["']\/(?:careers?|jobs?|join-us)(?:[\/#?][^"']*)?["']|href=["']\.\/(?:careers?|jobs?|join-us)(?:[\/#?][^"']*)?["']/i
const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
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
    headers: {
      location: response.headers.get('location'),
      'content-type': response.headers.get('content-type'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const homepageTitle = normalizeWhitespace(rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')

  return /JuzGoDigital - Best IoT Application Development Services Company, Hedge Fund Tech Solutions In Coimbatore, Blockchain Development Company India\./i.test(homepageTitle)
    && /JuzGoDigital Private Limited,/i.test(normalized)
    && /contact@juzgodigital\.com/i.test(rawHtml)
    && /href=["']\.\/team\.html["']/i.test(rawHtml)
    && /Coimbatore, Tamil Nadu - 641013\./i.test(normalized)
    && /Second Phase, Phase 2, Electronic City, Bangalore, Karnataka - 560 100/i.test(normalized)
    && /JuzGoDigital Copyrights Reserved\./i.test(normalized)
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedBlockedCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 403) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page?.html)
  return /<Code>\s*AccessDenied\s*<\/Code>/i.test(String(page?.html ?? ''))
    && /<Message>\s*Access Denied\s*<\/Message>/i.test(String(page?.html ?? ''))
    && normalized === 'AccessDenied Access Denied'
}

export const createJuzGoDigitalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('JuzGoDigital verified official homepage no longer matches the known public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('JuzGoDigital homepage now exposes a first-party careers or jobs link')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('JuzGoDigital homepage now exposes a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedBlockedCareersRoute(careersRoute)) {
        throw new Error('JuzGoDigital careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createJuzGoDigitalScraper().run(options)

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
