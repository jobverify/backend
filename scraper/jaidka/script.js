import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { JAIDKA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = JAIDKA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const TEAM_PAGE_URL = PROVIDER_METADATA.teamPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bsearch jobs\b/i,
  /\bcareers?\b/i,
  /\bjoin us\b/i,
  /\brecruit(?:ment)?\b/i,
  /\bJobPosting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Jaidka Power Systems Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && normalized.includes('Jaidka Power Systems Pvt. Ltd.')
    && normalized.includes('Become a Dealer')
    && normalized.includes('JPS Arjun')
    && normalized.includes('info@jaidka.in')
  }

export const hasVerifiedAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Jaidka Power Systems Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && normalized.includes('About Company')
    && normalized.includes('Jaidka Group')
    && normalized.includes('electric 3-wheeler')
    && normalized.includes('stellamoto.com')
  }

export const hasVerifiedTeamPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Jaidka Power Systems Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && normalized.includes('Our Team')
    && normalized.includes('GOPAL K JAIDKA')
    && normalized.includes('RACHNA JAIDKA')
    && normalized.includes('Human Resources')
  }

export const hasPublicJobSignals = (content = '') => {
  const page = String(content ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

export const createJaidkaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasPublicJobSignals(homepageHtml)) {
      throw new Error('Jaidka homepage now appears to expose a public jobs surface')
    }
    if (!hasVerifiedHomepageSignal(homepageHtml)) {
      throw new Error('Jaidka verified homepage no longer matches the known first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_PAGE_URL)
    if (hasPublicJobSignals(aboutHtml)) {
      throw new Error('Jaidka about page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedAboutPageSignal(aboutHtml)) {
      throw new Error('Jaidka verified about page no longer matches the known first-party surface')
    }

    const teamHtml = await fetchText(TEAM_PAGE_URL)
    if (hasPublicJobSignals(teamHtml)) {
      throw new Error('Jaidka team page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedTeamPageSignal(teamHtml)) {
      throw new Error('Jaidka verified team page no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createJaidkaScraper().run(options)

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
