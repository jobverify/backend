import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { SAMUNNATI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = SAMUNNATI_CATALOG.companyName
export const SOURCE = SAMUNNATI_CATALOG.source
export const DARWINBOX_COMPANY_ID = SAMUNNATI_CATALOG.darwinboxCompanyId
export const DARWINBOX_ORIGIN = SAMUNNATI_CATALOG.darwinboxOrigin
export const OFFICIAL_SITE_URL = SAMUNNATI_CATALOG.homepageUrl
export const OFFICIAL_ABOUT_URL = SAMUNNATI_CATALOG.officialAboutUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = SAMUNNATI_CATALOG.officialCareersHandoffUrl
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = SAMUNNATI_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SAMUNNATI_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = SAMUNNATI_CATALOG

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
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
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
    /https:\/\/samunnati\.darwinbox\.in\/ms\/candidate\/careers/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = extractTitle(page)

  return /^home - samunnati - india's largest agri enterprise$/i.test(title || '')
    && text.includes('work with us.')
    && text.includes('careers@samunnati.com')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const hasOfficialAboutSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = extractTitle(page)

  return /^about us - samunnati - india's largest agri enterprise$/i.test(title || '')
    && text.includes('samunnati 2.0')
    && text.includes('join the movement: empowering growth with samunnati')
    && text.includes('careers@samunnati.com')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'samunnati-official',
  timeoutMs: 15000,
})

export const createSamunnatiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  ...darwinboxScraper,
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const homepageHtml = await fetchText(OFFICIAL_SITE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Samunnati verified homepage no longer matches the verified public surface')
    }

    const aboutHtml = await fetchText(OFFICIAL_ABOUT_URL)

    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Samunnati verified about page no longer matches the verified public surface')
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

export const run = async (options = {}) => createSamunnatiScraper().run(options)

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
