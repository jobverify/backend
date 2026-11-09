import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'affle'
export const COMPANY_NAME = 'Affle'
export const COMPANY = COMPANY_NAME
export const COMPANY_ID = 'main'
export const VERIFIED_ON = '2026-07-19'
export const OFFICIAL_SITE_URL = 'https://affle.com/'
export const CAREERS_PAGE_URL = 'https://affle.com/career'
export const DARWINBOX_ORIGIN = 'https://affle.darwinbox.in'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidate/careers`
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

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/+$/g, '')
  } catch {
    return String(value ?? '').replace(/\/+$/g, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

export const extractDarwinboxHandoffUrl = (html = '') => {
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1]
    const text = normalizeWhitespace(match[2]) || ''

    if (!/darwinbox\.in/i.test(href)) continue
    if (!/current openings|openings|careers|jobs/i.test(text)) continue

    try {
      return new URL(href, CAREERS_PAGE_URL).toString().replace(/\/+$/g, '')
    } catch {
      return null
    }
  }

  return null
}

const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /^Affle Career$/i.test(extractTitle(page) || '')
    && text.includes('Why Affle')
    && text.includes("At Affle, we're on a mission")
    && /Check Our Current Openings/i.test(text)
}

export const hasOfficialCareersHandoffSignal = (html = '') => {
  const page = String(html ?? '')

  return hasOfficialCareersPageSignal(page)
    && sameUrl(extractDarwinboxHandoffUrl(page), OFFICIAL_CAREERS_HANDOFF_URL)
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

const createConfiguredDarwinboxScraper = () => createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
})

export const createAffleScraper = ({
  now = () => new Date().toISOString(),
  darwinboxScraper = createConfiguredDarwinboxScraper(),
} = {}) => ({
  ...darwinboxScraper,
  async run({
    fetchText = defaultFetchText,
    ...darwinboxOptions
  } = {}) {
    const { signal } = darwinboxOptions
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Affle careers page changed materially')
    }

    if (!sameUrl(extractDarwinboxHandoffUrl(careersHtml), OFFICIAL_CAREERS_HANDOFF_URL)) {
      throw new Error('The verified Affle Darwinbox handoff changed materially')
    }

    const jobs = await darwinboxScraper.run(darwinboxOptions)
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createAffleScraper().run(options)

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
