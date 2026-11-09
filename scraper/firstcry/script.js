import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FIRSTCRY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FIRSTCRY_CATALOG.source
export const COMPANY = FIRSTCRY_CATALOG.companyName
export const HOMEPAGE_URL = FIRSTCRY_CATALOG.homepageUrl
export const CAREERS_URL = FIRSTCRY_CATALOG.companyCareerPage
export const VERIFIED_ON = FIRSTCRY_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FIRSTCRY_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = FIRSTCRY_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob description\b/i,
  /\bjob id\b/i,
  /\brequisition id\b/i,
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
  /peoplestrong/i,
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

export const extractHomepageCareersUrl = (html) => {
  const match = String(html ?? '').match(
    /href=["']([^"']+)["'][^>]*>\s*Current Openings at FirstCry\.com\s*<\/a>/i,
  )

  if (!match?.[1]) return null

  try {
    return new URL(match[1], HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Baby Products Online India: Newborn Baby Products & Kids Online Shopping at FirstCry\.com\s*<\/title>/i.test(rawHtml)
    && /CAREER AT FIRSTCRY\.COM/i.test(normalized)
    && /Current Openings at FirstCry\.com/i.test(normalized)
}

export const hasInformationalCareersPageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return /FirstCry Careers/i.test(normalized)
    && /working at firstcry\.com/i.test(normalized)
    && /Design If you love new challenge everyday/i.test(normalized)
    && /Marketing Explore Marketing @FirstCry/i.test(normalized)
    && /Product Product is an innovative, insightful & creative function within the organisation/i.test(normalized)
    && /Technology The technology team forms a core part of the Firstcry business/i.test(normalized)
    && /Our colleagues-their voice/i.test(normalized)
    && /Arpit Agrawal/i.test(normalized)
    && /Megha Arora/i.test(normalized)
  }

export const hasPublicJobListingSignal = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createFirstCryScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('FirstCry verified homepage no longer matches the official first-party surface')
    }

    if (extractHomepageCareersUrl(homepage.html) !== CAREERS_URL) {
      throw new Error('FirstCry verified homepage careers handoff no longer matches the official first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if ((careersPage.url || CAREERS_URL) !== CAREERS_URL) {
      throw new Error('FirstCry verified careers page no longer matches the official first-party surface')
    }

    if (hasPublicJobListingSignal(careersPage.html)) {
      throw new Error('FirstCry careers page now appears to expose a public jobs board')
    }

    if (careersPage.status !== 200 || !hasInformationalCareersPageSignal(careersPage.html)) {
      throw new Error('FirstCry verified careers page no longer matches the official first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFirstCryScraper().run(options)

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
