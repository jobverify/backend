import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AIRCEL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AIRCEL_CATALOG.source
export const COMPANY = AIRCEL_CATALOG.companyName
export const VERIFIED_ON = AIRCEL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AIRCEL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AIRCEL_CATALOG
export const HOMEPAGE_URL = AIRCEL_CATALOG.companyCareerPage
export const CAREERS_ROUTE_URLS = [
  'https://aircel.com/careers',
  'https://aircel.com/career',
  'https://aircel.com/jobs',
  'https://aircel.com/join-us',
  'https://aircel.com/openings',
]
export const CRAWL_SURFACE_URLS = [
  'https://aircel.com/robots.txt',
  'https://aircel.com/sitemap.xml',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const hasMetaContent = (html, name, content) => new RegExp(
  `<meta\\b(?=[^>]*\\bname=["']?${name}["']?)(?=[^>]*\\bcontent=["']?${content}["']?)[^>]*>`,
  'i',
).test(String(html ?? ''))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'aircel.com' || hostname === 'www.aircel.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?aircel\.com)?\/(?:career|careers|jobs?|join-us|openings)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Aircel - Moile Service Provider\s*<\/title>/i.test(rawHtml)
    && hasMetaContent(rawHtml, 'description', 'Aircel website')
    && hasMetaContent(rawHtml, 'author', 'Arun Mahajan')
    && /href=(["']?)0_webportal_2022\/nclt\.html\1/i.test(rawHtml)
    && /Aircel website/i.test(rawHtml)
}

export const isMissingCareerRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && !hasPublicJobsSignal(page.html)
  && !hasFirstPartyCareerLikeLink(page.html)

export const createAircelScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Aircel verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Aircel homepage now appears to expose public jobs')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Aircel homepage now exposes a first-party careers or jobs link')
    }

    for (const routeUrl of [...CAREERS_ROUTE_URLS, ...CRAWL_SURFACE_URLS]) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Aircel verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAircelScraper().run(options)

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
