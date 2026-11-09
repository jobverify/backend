import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NUCSOFT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NUCSOFT_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPENINGS_URL = PROVIDER_METADATA.openingsPageUrl
export const APPLICATION_FORM_URL = PROVIDER_METADATA.applicationFormUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const stripTags = (value = '') => String(value).replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value = '') => decodeHtml(stripTags(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html)
  return /Unlock Your Potential with/i.test(page)
    && /View career opportunities/i.test(page)
    && /Apply Now/i.test(page)
    && /https:\/\/nucsoft\.com\/openings\?job=/i.test(page)
}

export const extractVisibleJobCards = (html = '') => {
  const page = String(html)
  const cardPattern = /<p class="card-header">\s*([^<]+?)\s*<\/p>[\s\S]*?<p>\s*([\s\S]*?)\s*<\/p>[\s\S]*?<a href="(https:\/\/nucsoft\.com\/openings\?job=[^"]+)"[^>]*class="apply-button">/gi
  const jobs = []

  for (const match of page.matchAll(cardPattern)) {
    const title = normalizeWhitespace(match[1])
    const description = normalizeWhitespace(match[2])
    const applyUrl = toAbsoluteUrl(match[3])

    if (!title || !description || !applyUrl) continue

    jobs.push({
      title,
      jobDescription: description,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      remoteStatus: null,
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNucsoftScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Nucsoft verified first-party careers page no longer matches the trusted contract')
    }

    const jobs = extractVisibleJobCards(careersHtml)
      .map((job) => ({
        ...job,
        company: COMPANY,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: now(),
      }))
      .sort((left, right) => left.title.localeCompare(right.title))

    return jobs
  },
})

export const run = async (options = {}) => createNucsoftScraper().run(options)

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
