import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIVGUARD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = LIVGUARD_CATALOG.source
export const COMPANY = LIVGUARD_CATALOG.companyName
export const VERIFIED_ON = LIVGUARD_CATALOG.verifiedOn
export const HOMEPAGE_URL = LIVGUARD_CATALOG.officialHomepageUrl
export const ABOUT_URL = LIVGUARD_CATALOG.officialAboutUrl
export const NO_PUBLIC_CAREERS_ROUTE_URLS = LIVGUARD_CATALOG.noPublicCareersRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob postings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Livguard Energy Storage Solutions for Inverters and Batteries\s*<\/title>/i.test(page)
    && normalized.includes('livguard')
    && normalized.includes('energy storage solutions')
}

export const hasVerifiedAboutSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*About Livguard\s*\|\s*Powering Innovation in Energy Solutions\s*<\/title>/i.test(page)
    && normalized.includes('about livguard')
    && normalized.includes('powering innovation in energy solutions')
}

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && !hasPublicJobsSignal(page?.html ?? '')

export const createLivguardScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('Livguard verified homepage no longer matches the official first-party surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasVerifiedAboutSignal(aboutPage.html) || hasPublicJobsSignal(aboutPage.html)) {
      throw new Error('Livguard verified about page no longer matches the official first-party surface')
    }

    for (const url of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const page = await fetchPage(url)
      if (!isVerifiedMissingCareerRoute(page)) {
        throw new Error(`Livguard no-public-careers route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLivguardScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
