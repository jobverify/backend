import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FLOCK_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FLOCK_CATALOG.source
export const COMPANY = FLOCK_CATALOG.companyName
export const HOMEPAGE_URL = FLOCK_CATALOG.homepageUrl
export const CAREERS_URL = FLOCK_CATALOG.companyCareerPage
export const VERIFIED_ON = FLOCK_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FLOCK_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = FLOCK_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bview job\b/i,
  /\bjob description\b/i,
  /\bcurrent openings\b/i,
  /\bopen roles\b/i,
  /\bopen positions\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /successfactors/i,
  /darwinbox/i,
  /jobvite/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
  /href=["']https:\/\/careers\.flock\.com\/jobs\/[^"']+/i,
  /class=["'][^"']*\bjob-card\b/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&#x27;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    const url = new URL(value, baseUrl)
    if (url.hostname.toLowerCase() === 'careers.flock.com') {
      url.protocol = 'https:'
    }
    return url.toString()
  } catch {
    return null
  }
}

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

export const extractHomepageCareersUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']*careers\.flock\.com\/?[^"']*)["']/i)
  return toAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('team messenger')
    && normalized.includes('online collaboration platform')
    && normalized.includes('flock')
    && normalized.includes('sign in')
    && extractHomepageCareersUrl(html) === CAREERS_URL
}

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Flock Careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('changing how teams communicate and work together')
    && normalized.includes('join the team')
    && normalized.includes('all teams')
    && normalized.includes('all locations')
    && normalized.includes('search jobs')
    && normalized.includes('work@flock.com')
    && normalized.includes('why join flock')
    && normalized.includes('our culture')
    && normalized.includes('benefits and perks')
}

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasNoPublicJobsShellSignal = (html) =>
  hasOfficialCareersPageSignal(html) && !hasPublicJobListingSignal(html)

export const createFlockScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeUrl(homepage.url) !== HOMEPAGE_URL
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Flock homepage changed materially or no longer matches the verified official homepage')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || normalizeUrl(careersPage.url) !== CAREERS_URL
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Flock careers page changed materially or no longer matches the verified first-party careers shell')
    }

    if (!hasNoPublicJobsShellSignal(careersPage.html)) {
      throw new Error('Flock careers page changed materially or now exposes a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFlockScraper().run(options)

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
