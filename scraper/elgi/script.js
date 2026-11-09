import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const OFFICIAL_CAREERS_URL = 'https://www.elgi.com/careers/'
export const OFFICIAL_PAGE_TITLE = 'Careers in ELGi'
export const DARWINBOX_ORIGIN = 'https://elgi.darwinbox.in'
export const DARWINBOX_COMPANY_ID = 'a61e65404e890b'
export const DARWINBOX_CAREERS_URL =
  'https://elgi.darwinbox.in/ms/candidate/a61e65404e890b/careers'
export const DARWINBOX_PUBLIC_ALL_JOBS_URL =
  'https://elgi.darwinbox.in/ms/candidatev2/a61e65404e890b/careers/allJobs'
export const DARWINBOX_LISTING_API_URL =
  'https://elgi.darwinbox.in/ms/candidateapi/job/alljobs?companyId=a61e65404e890b'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PAGE_SIZE = 10
const OFFICIAL_PROMISE_TEXT = "WE'RE ALWAYS BETTER. AND THAT'S A PROMISE"
const OFFICIAL_FIT_TEXT = 'ARE YOU RIGHT FOR US?'
const OFFICIAL_JOBS_TEXT = 'EXPLORE OUR JOBS'

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

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractDarwinboxCareersUrl = (html) => {
  const match = String(html ?? '').match(
    /https:\/\/elgi\.darwinbox\.in\/ms\/candidate\/a61e65404e890b\/careers/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialElgiCareersSignals = (html) => {
  const page = String(html ?? '')
  const text = stripHtml(page) || ''

  return extractTitle(page) === OFFICIAL_PAGE_TITLE
    && text.includes(OFFICIAL_PROMISE_TEXT)
    && text.includes(OFFICIAL_FIT_TEXT)
    && text.includes(OFFICIAL_JOBS_TEXT)
    && extractDarwinboxCareersUrl(page) === DARWINBOX_CAREERS_URL
}

const assertOfficialCareersSurface = (html) => {
  if (!hasOfficialElgiCareersSignals(html)) {
    throw new Error('ELGi verified official careers page no longer matches the verified public surface')
  }

  const darwinboxUrl = extractDarwinboxCareersUrl(html)

  if (darwinboxUrl !== DARWINBOX_CAREERS_URL) {
    throw new Error('ELGi official careers page no longer points to the verified Darwinbox public careers URL')
  }

  return darwinboxUrl
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'elgi-official',
  timeoutMs: 15000,
})

export const createElgiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchImpl = fetch,
} = {}) => {
  const darwinboxScraper = createDarwinboxScraper({
    companyName: 'ELGi',
    source: 'elgi',
    companyId: DARWINBOX_COMPANY_ID,
    origin: DARWINBOX_ORIGIN,
    pageSize: PAGE_SIZE,
    fetchImpl,
  })

  return {
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    assertOfficialCareersSurface(careersHtml)

    return darwinboxScraper.run({
      maxPages,
      maxJobs,
      fetchListingPage,
    })
  },
  }
}

export const run = async (options = {}) => createElgiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ELGi scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'elgi')
    console.log('DB result:', result)
    process.exit(0)
  }
}
