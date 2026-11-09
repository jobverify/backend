import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'upgrad'
export const COMPANY_NAME = 'upGrad'
export const COMPANY = COMPANY_NAME
export const COMPANY_ID = 'main'
export const VERIFIED_ON = '2026-07-25'
export const OFFICIAL_SITE_URL = 'https://www.upgrad.com/'
export const CAREERS_PAGE_URL = 'https://www.upgrad.com/careers/'
export const DARWINBOX_ORIGIN = 'https://upgrad.darwinbox.in'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidate/main/careers`
export const PUBLIC_ALL_JOBS_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/allJobs`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const normalizeComparableUrl = (value) => String(value ?? '')
  .replace(/\\\//g, '/')
  .replace(/\\+$/g, '')
  .replace(/\/+$/g, '')

export const extractDarwinboxHandoffUrls = (html = '') => {
  const normalizedPage = normalizeComparableUrl(String(html ?? ''))
  const matches = normalizedPage.matchAll(
    /https:\/\/upgrad\.darwinbox\.in\/ms\/candidate(?:\/main)?\/careers/gi,
  )

  return [...new Set([...matches].map((match) => match[0]))]
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const darwinboxUrls = extractDarwinboxHandoffUrls(page)

  return extractTitle(page) === 'Careers | upGrad – Transforming Online Higher Education'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.upgrad\.com\/careers\/["']/i.test(page)
    && /Shape the future of education with upGrad!/i.test(page)
    && /Explore open positions/i.test(page)
    && darwinboxUrls.includes(OFFICIAL_CAREERS_HANDOFF_URL)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const createConfiguredDarwinboxScraper = () => createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

export const createUpgradScraper = ({
  now = () => new Date().toISOString(),
  darwinboxScraper = createConfiguredDarwinboxScraper(),
} = {}) => ({
  ...darwinboxScraper,
  async run({
    fetchText = defaultFetchText,
    ...darwinboxOptions
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified upGrad careers page changed materially')
    }

    const jobs = await darwinboxScraper.run(darwinboxOptions)
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createUpgradScraper().run(options)

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
