import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const OFFICIAL_CAREERS_URL = 'https://careers.cardekho.com/'
export const DARWINBOX_ORIGIN = 'https://cardekho.darwinbox.in'
export const DARWINBOX_COMPANY_ID = '606876f7e2c79'
export const DARWINBOX_CAREERS_URL =
  'https://cardekho.darwinbox.in/ms/candidate/606876f7e2c79/careers'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PAGE_SIZE = 10

const darwinboxScraper = createDarwinboxScraper({
  companyName: 'CarDekho',
  source: 'cardekho',
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
  pageSize: PAGE_SIZE,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&#8217;|&apos;|&rsquo;/gi, "'")
  .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

export const extractDarwinboxCareersUrl = (html) => {
  const match = String(html ?? '').match(
    /https:\/\/cardekho\.darwinbox\.in\/ms\/candidate\/606876f7e2c79\/careers/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialCarDekhoCareersSignals = (html) => {
  const page = String(html ?? '')
  const text = stripHtml(page) || ''

  return /<title[^>]*>[\s\S]*(?:Career|CarDekho)[\s\S]*<\/title>/i.test(page)
    && /(?:View Openings|Join Our Team|Join CarDekho Group|start something big together)/i.test(text)
    && extractDarwinboxCareersUrl(page) === DARWINBOX_CAREERS_URL
}

const assertOfficialCareersSurface = (html) => {
  if (!hasOfficialCarDekhoCareersSignals(html)) {
    throw new Error('CarDekho verified official careers page no longer matches the verified public surface')
  }

  const darwinboxUrl = extractDarwinboxCareersUrl(html)
  if (darwinboxUrl !== DARWINBOX_CAREERS_URL) {
    throw new Error('CarDekho official careers page no longer points to the verified Darwinbox public careers URL')
  }

  return darwinboxUrl
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cardekho-official',
  timeoutMs: 15000,
  signal,
})

export const createCarDekhoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
    ...darwinboxOptions
  } = {}) {
    const { signal } = darwinboxOptions
    signal?.throwIfAborted()
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL, { signal })
    signal?.throwIfAborted()
    assertOfficialCareersSurface(careersHtml)

    if (!fetchListingPage) {
      return darwinboxScraper.run({
        ...darwinboxOptions,
        maxPages,
        maxJobs,
      })
    }

    return darwinboxScraper.run({
      ...darwinboxOptions,
      maxPages,
      maxJobs,
      fetchListingPage,
    })
  },
})

export const run = async (options = {}) => createCarDekhoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'cardekho')
  }
}
