import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = OMPRIME_TECHNOLOGY_PRIVATE_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('We Are Looking For You!')
    && normalized.includes('Jobs List')
    && normalized.includes('Choose Region:')
}

const extractVisibleRegion = (html = '') => {
  const match = String(html ?? '').match(/Choose Region:\s*<\/[^>]+>\s*<[^>]+>([^<]+)/i)
  return normalizeWhitespace(match?.[1] || '')
}

export const extractJobCards = (html = '') => {
  const region = extractVisibleRegion(html)
  const jobs = []

  for (const match of String(html ?? '').matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi)) {
    const sourceUrl = match[1]
    const title = normalizeWhitespace(match[2])

    if (!title || /details/i.test(title) || !/^https:\/\/omprime\.com\/careers\//i.test(sourceUrl)) {
      continue
    }

    jobs.push({
      title,
      sourceUrl,
      region,
    })
  }

  return jobs
}

const isIndiaRegion = (region) => /\b(in|india)\b/i.test(String(region ?? ''))

export const createOmprimeTechnologyPrivateLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Omprime careers page changed materially')
    }

    return extractJobCards(html)
      .filter((job) => isIndiaRegion(job.region))
      .map((job) => ({
        title: job.title,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        jobId: job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        requisitionId: null,
        sourceUrl: job.sourceUrl,
        applyUrl: job.sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
  },
})

export const run = async (options = {}) => createOmprimeTechnologyPrivateLimitedScraper().run(options)

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
