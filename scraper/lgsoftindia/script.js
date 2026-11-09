import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'lgsoftindia'
export const COMPANY = 'LG Soft India'
export const COMPANY_DOMAIN = 'lgsoftindia.com'
export const HOMEPAGE_URL = 'https://lgsoftindia.com/'
export const DARWINBOX_ORIGIN = 'https://lgsihrms.darwinbox.in'
export const DARWINBOX_COMPANY_ID = 'a6914476a29263'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/home`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY,
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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Home - LG Soft India'
    && /<a[^>]+href=["']https:\/\/lgsihrms\.darwinbox\.in\/ms\/candidatev2\/a6914476a29263\/careers\/home["'][^>]*>Careers<\/a>/i.test(page)
    && text.includes("WE BRING HAPPINESS TO OUR CUSTOMER'S LIFE")
    && text.includes('LG Soft India, the largest global R&D center of LG Electronics.')
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return (
    (
      extractTitle(page) === 'LG Soft India Private Limited'
      && /<base href="\/ms\/candidate\/">/i.test(page)
      && /<app-root\b/i.test(page)
      && /\/ms\/bot\/candidateweb\/assets\/bot\.js/i.test(page)
    )
    || (
      /<base href="\/ms\/candidatev2\/">/i.test(page)
      && /<app-root\b/i.test(page)
      && /db-components\.esm\.js/i.test(page)
      && /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/i.test(page)
    )
  )
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createLgSoftIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('LG Soft India verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(OFFICIAL_CAREERS_HANDOFF_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('LG Soft India verified public Darwinbox careers handoff no longer matches the known public surface')
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

export const run = async (options = {}) => createLgSoftIndiaScraper().run(options)

export const {
  buildCareersPageUrl,
  buildListingApiUrl,
  buildJobDetailUrl,
  extractSearchResults,
} = darwinboxScraper

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

