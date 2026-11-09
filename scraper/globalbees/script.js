import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GLOBALBEES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = GLOBALBEES_CATALOG.source
export const COMPANY = GLOBALBEES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = GLOBALBEES_CATALOG.officialBrandName
export const VERIFIED_ON = GLOBALBEES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = GLOBALBEES_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = GLOBALBEES_CATALOG
export const HOMEPAGE_URL = GLOBALBEES_CATALOG.homepageUrl
export const CAREER_PAGE_URL = GLOBALBEES_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions in all locations\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bapply now\b/i,
  /href=["'][^"']*\/job\/[a-z0-9-]+/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) => {
  const candidate = String(html ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(candidate))
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('experience the world of brands with globalbees')
    && normalized.includes('globalbees')
    && normalized.includes('careers@globalbees.com')
    && String(html ?? '').includes('career.html')
}

export const hasOfficialCareerPageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes("we're expanding the hive")
    && normalized.includes("we're hiring across multiple functions")
    && normalized.includes('careers@globalbees.com')
    && normalized.includes('send us your cv')
    && normalized.includes('your name *')
    && normalized.includes('phone number *')
    && normalized.includes('email address *')
}

export const createGlobalBeesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('GlobalBees homepage no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(homepage.text)) {
      throw new Error('GlobalBees homepage now appears to expose public job listings')
    }

    const careerPage = await fetchPage(CAREER_PAGE_URL)
    if (hasPublicJobsSignal(careerPage.text)) {
      throw new Error('GlobalBees careers page now appears to expose public job listings')
    }
    if (!careerPage.ok || !hasOfficialCareerPageSignal(careerPage.text)) {
      throw new Error('GlobalBees careers page no longer matches the verified contact-form surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGlobalBeesScraper().run(options)

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
