import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TRAWEX_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TRAWEX_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|bangalore|bengaluru|karnataka|hyderabad|pune|chennai)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.trawex.com') return null
    return url.toString()
  } catch {
    return null
  }
}

const extractJobId = (url, title) => {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop()?.replace(/\.php$/i, '')
    return name || normalizeWhitespace(title)?.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  } catch {
    return normalizeWhitespace(title)?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers\s*-\s*Travel Technology Company\s*\|\s*Online Travel Solutions\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && page.includes('box-new-career')
    && normalized.includes('Senior Angular Developer')
    && normalized.includes('Business Development Manager')
}

export const extractJobs = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<div[^>]*class=["'][^"']*box-new-career[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const block = match[1]
    const href = toAbsoluteUrl(block.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])
    const title = normalizeWhitespace(block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
    const location = normalizeWhitespace(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const jobId = extractJobId(href, title)

    if (!href || !title || !location || !jobId || !INDIA_LOCATION_PATTERN.test(location)) {
      continue
    }

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: normalizeWhitespace(location.split(',')[0]),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: href,
      applyUrl: href,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

export const createTrawexTechnologiesScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Trawex Technologies careers surface no longer matches the trusted first-party page')
    }

    const jobs = extractJobs(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createTrawexTechnologiesScraper().run(options)

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
