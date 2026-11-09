import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { GAMES24X7_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = GAMES24X7_CATALOG.companyName
export const SOURCE = GAMES24X7_CATALOG.source
export const DARWINBOX_COMPANY_ID = GAMES24X7_CATALOG.darwinboxCompanyId
export const DARWINBOX_ORIGIN = GAMES24X7_CATALOG.darwinboxOrigin
export const HOMEPAGE_URL = GAMES24X7_CATALOG.homepageUrl
export const OFFICIAL_CAREERS_URL = GAMES24X7_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = GAMES24X7_CATALOG.officialCareersHandoffUrl
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = GAMES24X7_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = GAMES24X7_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = GAMES24X7_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/games24x7\.darwinbox\.in\/ms\/candidate\/a6150564417204\/careers/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialGames24x7HomepageSignals = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return extractTitle(page) === 'Games24x7: Where the Science of Gaming Meets AI & Data'
    && /entertaining 120 million\s*\+\s*players using the science of gaming/i.test(text)
    && /href=["'](?:https:\/\/www\.games24x7\.com)?\/life(?:["'#?\/]|$)/i.test(page)
}

export const hasOfficialGames24x7LifeSignals = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return extractTitle(page) === 'Bold Ideas, Bright Futures - Life At Games24x7'
    && text.includes('life at games24x7')
    && text.includes('level up your career with us')
    && text.includes('view all jobs')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'games24x7-official',
  timeoutMs: 15000,
})

export const createGames24x7Scraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialGames24x7HomepageSignals(homepageHtml)) {
      throw new Error('Games24x7 verified official homepage no longer matches the verified public surface')
    }

    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasOfficialGames24x7LifeSignals(careersHtml)) {
      throw new Error('Games24x7 verified official careers page no longer matches the verified public surface')
    }

    const jobs = await darwinboxScraper.run({
      maxPages,
      maxJobs,
      fetchListingPage,
    })
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createGames24x7Scraper().run(options)

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
