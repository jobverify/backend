import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { THE_DIGITAL_GROUP_INFOTECH_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const absolutizeUrl = (value) => new URL(value, 'https://www.thedigitalgroup.com/').toString()

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return `${normalized.replace(/\s*-\s*/g, ', ')}, India`
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Job ID')
    && normalized.includes('Date Posted')
    && normalized.includes('Job Title')
    && normalized.includes('Location')
    && normalized.includes('Apply')
  }

export const extractJobs = (html = '') => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('The Digital Group careers page no longer matches the verified The Digital Group careers surface')
  }

  const jobs = [...String(html ?? '').matchAll(
    /<tr>[\s\S]*?<td[^>]*>\s*([0-9]+)\s*<\/td>[\s\S]*?<td[^>]*>\s*([^<]+?)\s*<\/td>[\s\S]*?<td[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/td>[\s\S]*?<td[^>]*>\s*([^<]+?)\s*<\/td>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>\s*Apply\s*<\/a>[\s\S]*?<\/tr>/gi,
  )].map((match) => ({
    jobId: normalizeWhitespace(match[1]),
    postedOn: normalizeWhitespace(match[2]),
    sourceUrl: absolutizeUrl(match[3]),
    title: normalizeWhitespace(match[4]),
    location: normalizeLocation(match[5]),
    applyUrl: absolutizeUrl(match[6]),
  })).filter((job) => job.jobId && job.postedOn && job.title && job.location && job.applyUrl)

  if (jobs.length === 0) {
    throw new Error('The Digital Group verified careers rows changed or disappeared')
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

export const createTheDigitalGroupInfotechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractJobs(html).map((job) => ({
      ...job,
      company: COMPANY,
      department: null,
      country: 'India',
      city: normalizeCity(job.location.split(',')[0]),
      requisitionId: `${SOURCE}-${job.jobId}`,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: job.postedOn,
      closingDate: null,
      jobDescription: null,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
      jobSlug: slugify(`${job.title}-${job.jobId}`),
    }))
  },
})

export const run = async (options = {}) => createTheDigitalGroupInfotechScraper().run(options)

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
