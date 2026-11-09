import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'lakshmimachineworks'
export const COMPANY = 'Lakshmi Machine Works'
export const COMPANY_DOMAIN = 'lmwglobal.com'
export const HOMEPAGE_URL = 'https://www.lmwglobal.com/'
export const DARWINBOX_ORIGIN = 'https://lmwanubhav.darwinbox.in'
export const DARWINBOX_COMPANY_ID = 'main'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidate/careers`
export const PUBLIC_PORTAL_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`

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

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/lmwanubhav\.darwinbox\.in\/ms\/candidate\/careers/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'LMW Limited | Industrial Machinery Manufacturers'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.lmwglobal\.com["']/i.test(page)
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
    && text.includes('LMW Limited (formerly Lakshmi Machine Works Limited)')
    && text.includes('leading Textile Machinery Manufacturer in India')
    && text.includes('LMW diversified into CNC Machine Tools')
}

export const hasOfficialCareersShell = (html = '') => {
  const page = String(html ?? '')

  return /<base href="\/ms\/candidate\/">/i.test(page)
    && /<app-root\b/i.test(page)
    && /\/ms\/dboxuilibrary\/assets\/dboxuilib_dist\/www\/build\/db-components\.esm\.js/i.test(page)
    && /\/ms\/formbuilder\/assets\/db-form\/db-form\.js/i.test(page)
    && /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/i.test(page)
    && /\/ms\/bot\/candidateweb\/assets\/bot\.js/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createLakshmiMachineWorksScraper = ({
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
      throw new Error('Lakshmi Machine Works verified official homepage no longer matches the known public surface')
    }

    const careersShellHtml = await fetchText(OFFICIAL_CAREERS_HANDOFF_URL)

    if (!hasOfficialCareersShell(careersShellHtml)) {
      throw new Error('Lakshmi Machine Works verified public Darwinbox careers shell no longer matches the known public surface')
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

export const run = async (options = {}) => createLakshmiMachineWorksScraper().run(options)

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
