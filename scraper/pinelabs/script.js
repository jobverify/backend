import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PINE_LABS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PINE_LABS_CATALOG.source
export const COMPANY = PINE_LABS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PINE_LABS_CATALOG.officialBrandName
export const VERIFIED_ON = PINE_LABS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PINE_LABS_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = PINE_LABS_CATALOG.homepageUrl
export const CAREERS_URL = PINE_LABS_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards(?:\.eu)?\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /\bapply now\b/i,
  /\bopen roles\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
]

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

export const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasVerifiedCareersSurface = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at Pine Labs\b[\s\S]*Join Our Fintech Innovation Team\s*<\/title>/i.test(rawHtml)
    && /Explore exciting career opportunities at Pine Labs/i.test(rawHtml)
    && /href="https:\/\/www\.pinelabs\.com\/careers"/i.test(rawHtml)
    && /Pine Labs Logo/i.test(rawHtml)
    && /\/contact-sales/i.test(rawHtml)
    && /Careers at Pine Labs/i.test(normalized)
    && /Join our fintech innovation team/i.test(normalized)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createPineLabsScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasVerifiedCareersSurface(careersPage.html)) {
      throw new Error('Pine Labs verified careers surface no longer matches the official first-party page')
    }

    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Pine Labs official careers surface now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createPineLabsScraper().run(options)

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
