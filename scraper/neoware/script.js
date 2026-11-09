import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neoware'
export const COMPANY = 'Neoware'
export const VERIFIED_ON = '2026-08-03'
export const HOMEPAGE_URL = 'https://www.neoware.io/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.neoware.io/careers',
  'https://www.neoware.io/careers/',
  'https://www.neoware.io/career',
  'https://www.neoware.io/career/',
  'https://www.neoware.io/jobs',
  'https://www.neoware.io/jobs/',
  'https://www.neoware.io/openings',
  'https://www.neoware.io/openings/',
  'https://www.neoware.io/join-us',
  'https://www.neoware.io/join-us/',
  'https://www.neoware.io/sitemap.xml',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?neoware\.io)?\/(?:careers?|jobs?|openings|join-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&copy;/gi, '\u00a9')
    .replace(/\u00c2?\u00a9/g, '\u00a9')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHtml = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

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

export const hasUnexpectedCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*NeoWare\s+\u2014\s+NeoZip\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+NeoWare builds next-generation data tools that combine archiving, blockchain authenticity and modern cryptography\. Maker of NeoZip\./i.test(page)
    && normalized.includes('Trusted data, built for the next generation')
    && normalized.includes('NeoWare designs open source tools and standards')
    && normalized.includes('A foundation you can trust')
    && normalized.includes('Verifiable by design')
    && normalized.includes('Built on standards')
    && normalized.includes('Open and extensible')
    && normalized.includes('Our flagship product')
    && normalized.includes('NeoZip')
}

export const isVerifiedMissingRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return Number(page?.status) === 404
    && /<title>\s*NeoWare\s+\u2014\s+NeoZip\s*<\/title>/i.test(String(page?.html ?? ''))
    && normalized.includes('Page not found')
    && normalized.includes("Sorry, we couldn't find the page you're looking for.")
    && normalized.includes('Go to the home page')
    && normalized.includes('Looking for an article?')
    && normalized.includes('Browse all articles')
    && normalized.includes('Building the next generation of trusted data infrastructure.')
    && normalized.includes('\u00a9 2026 NeoWare. All rights reserved.')
    && normalized.includes('Privacy Policy')
    && !hasUnexpectedCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createNeowareScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Neoware verified official homepage no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(homepage.html)) {
      throw new Error('Neoware homepage now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Neoware homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error(
          `Neoware verified missing first-party route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNeowareScraper().run(options)

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
