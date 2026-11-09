import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { STRATEGIC_ERP_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (value) => new URL(value, CAREERS_URL).href

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  return normalized.includes('Why work')
    && normalized.includes('Apply Now')
    && /job_details\.php\?id=\d+/i.test(page)
    && normalized.includes('Mumbai')
}

export const extractPositionCards = (html) =>
  Array.from(
    String(html ?? '').matchAll(
      /<div class='position-box'>[\s\S]*?<h4>\s*([^<]+?)\s*<small class='ms-3'>\(([^)]+)\)<\/small><\/h4>[\s\S]*?<p class='mb-3'>([^<]+)<\/p>[\s\S]*?<p><img[^>]+>\s*([^<]+)<\/p>[\s\S]*?<a href='([^']*job_details\.php\?id=\d+)'/gi,
    ),
    (match) => ({
      title: normalizeWhitespace(match[1]),
      employmentType: normalizeWhitespace(match[2]) || null,
      experienceRequired: normalizeWhitespace(match[3]) || null,
      location: normalizeWhitespace(match[4]) || null,
      applyUrl: toAbsoluteUrl(match[5]),
    }),
  )
    .filter((job) => job.title && job.applyUrl)
    .map((job) => ({
      ...job,
      city: job.location,
      country: 'India',
      jobId: slugify(job.title),
      sourceUrl: job.applyUrl,
      link: job.applyUrl,
    }))

export const createStrategicErpScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('StrategicERP first-party careers page changed materially')
    }

    return extractPositionCards(careersHtml)
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((job) => ({
        title: job.title,
        company: COMPANY,
        location: job.location,
        city: job.city,
        country: job.country,
        jobId: job.jobId,
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
        employmentType: job.employmentType,
        experienceRequired: job.experienceRequired,
        jobDescription: null,
        source: SOURCE,
        link: job.link,
        scrapedAt: now(),
      }))
  },
})

export const run = async (options = {}) => createStrategicErpScraper(options).run(options)

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
