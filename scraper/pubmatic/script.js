import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { PUBMATIC_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DETAIL_FETCH_CONCURRENCY = 4

const INDIA_LOCATIONS = {
  'Gurugram, IN': { city: 'Gurugram', state: 'Haryana', country: 'India' },
  'Pune, IN': { city: 'Pune', state: 'Maharashtra', country: 'India' },
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const decodeHtml = (value) => normalizeWhitespace(value)

const extractDetailSectionHtml = (html = '') => {
  const page = String(html ?? '')
  const startMatch = /<div[^>]*class=["'][^"']*pubm-job__description[^"']*["'][^>]*>/i.exec(page)
  if (!startMatch) return null

  const tail = page.slice(startMatch.index + startMatch[0].length)
  const endPatterns = [
    /<div[^>]*class=["'][^"']*pubm-job__sidebar[^"']*["'][^>]*>/i,
    /<div[^>]*class=["'][^"']*pubm-job__apply-box[^"']*["'][^>]*>/i,
    /<div[^>]*class=["'][^"']*pubm-job__form-wrap[^"']*["'][^>]*>/i,
  ]

  let endIndex = tail.length
  for (const pattern of endPatterns) {
    const match = pattern.exec(tail)
    if (match && match.index < endIndex) {
      endIndex = match.index
    }
  }

  return tail.slice(0, endIndex)
}

const extractExperienceRequirement = (description = '') => {
  const experienceProfile = extractJobFilterSignals({
    description,
  })?.experienceProfile

  if (!experienceProfile || experienceProfile.confidence !== 'high') {
    return null
  }

  if (experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0) {
    return 'No experience required'
  }

  return experienceProfile.evidence || null
}

const extractJobDetail = (html = '') => {
  const description = normalizeWhitespace(extractDetailSectionHtml(html))
  if (!description) {
    return {
      jobDescription: null,
      experienceRequired: null,
    }
  }

  return {
    jobDescription: description,
    experienceRequired: extractExperienceRequirement(description),
  }
}

export const hasOfficialJobsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const page = String(html ?? '')

  const hasLegacySignal = normalized.includes('OPPORTUNITY. DELIVERED.')
    && /\b\d+\s+open positions\b/i.test(normalized)
    && normalized.includes('Gurugram, IN')

  const hasCurrentSignal = /\b\d+\s+open positions\b/i.test(normalized)
    && normalized.includes('Gurugram, IN')
    && normalized.includes('Pune, IN')
    && normalized.includes('View Engineering Jobs')
    && /class=["'][^"']*postings-count[^"']*["']/i.test(page)

  return hasLegacySignal || hasCurrentSignal
}

const toAbsoluteUrl = (value = '') => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractJobsFromGroupBody = (body = '') =>
  Array.from(
    String(body ?? '').matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi),
    (jobMatch) => ({
      title: decodeHtml(jobMatch[2]),
      applyUrl: toAbsoluteUrl(jobMatch[1]),
    }),
  ).filter((job) => job.title && job.applyUrl)

const extractLegacyLocationGroups = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(
      /<section[\s\S]*?<h4>([^<]+)<\/h4>([\s\S]*?)<\/section>/gi,
    ),
    (match) => ({
      location: decodeHtml(match[1]),
      jobs: extractJobsFromGroupBody(match[2]),
    }),
  )

const extractCurrentLocationGroups = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(
      /<h4[^>]*class=["'][^"']*location-name[^"']*["'][^>]*>([^<]+)<\/h4>([\s\S]*?)(?=<h4[^>]*class=["'][^"']*location-name[^"']*["']|<\/body>|$)/gi,
    ),
    (match) => ({
      location: decodeHtml(match[1]),
      jobs: extractJobsFromGroupBody(match[2]),
    }),
  )

export const extractLocationGroups = (html = '') => {
  const legacyGroups = extractLegacyLocationGroups(html)
  const groups = legacyGroups.length > 0
    ? legacyGroups
    : extractCurrentLocationGroups(html)

  return groups.filter((group) => group.location && group.jobs.length > 0)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 90000,
})

export const createPubMaticScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialJobsSignal(html)) {
      throw new Error('PubMatic first-party jobs page changed materially')
    }

    const jobs = extractLocationGroups(html)
      .flatMap((group) => {
        const locationMeta = INDIA_LOCATIONS[group.location]
        if (!locationMeta) return []

        return group.jobs.map((job) => ({
          title: job.title,
          company: COMPANY,
          location: `${locationMeta.city}, ${locationMeta.state}, ${locationMeta.country}`,
          city: locationMeta.city,
          state: locationMeta.state,
          country: locationMeta.country,
          jobId: slugify(job.title),
          sourceUrl: job.applyUrl,
          applyUrl: job.applyUrl,
          jobDescription: null,
          source: SOURCE,
          link: job.applyUrl,
          scrapedAt: now(),
        }))
      })
      .sort((left, right) => left.title.localeCompare(right.title))

    return mapWithConcurrency(
      jobs,
      DETAIL_FETCH_CONCURRENCY,
      async (job) => {
        try {
          const detailHtml = await fetchText(job.sourceUrl)
          const detail = extractJobDetail(detailHtml)

          return {
            ...job,
            jobDescription: detail.jobDescription || job.jobDescription,
            experienceRequired: detail.experienceRequired || job.experienceRequired,
          }
        } catch {
          return job
        }
      },
    )
  },
})

export const run = async (options = {}) => createPubMaticScraper(options).run(options)

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
