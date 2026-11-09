import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = EASTERN_SOFTWARE_SOLUTIONS_PVT_LTD_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.essindia.com') return null
    return url.toString()
  } catch {
    return null
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
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Explore Careers at Eastern Software Solutions\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Find Your Next Job')
    && normalized.includes('Job Related Queries')
    && normalized.includes('Eastern Software Solutions')
}

export const extractJobCards = (html = '') => {
  const jobs = []
  const pattern = /<a href="(https:\/\/www\.essindia\.com\/apply-now\.php\?post_name=[^"]+)" class="job-list">([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const applyUrl = toAbsoluteUrl(match[1])
    const block = match[2]
    const title = normalizeWhitespace(block.match(/<h6[^>]*class="title"[^>]*>([\s\S]*?)<\/h6>/i)?.[1])
    const meta = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)

    if (!applyUrl || !title) continue

    const location = meta.find((item) =>
      /india|noida|mumbai|sector/i.test(item) && !/^essindia$/i.test(item),
    ) || 'Noida, Uttar Pradesh, India'

    jobs.push({
      title,
      location,
      city: normalizeWhitespace(location.split(',')[0]),
      country: 'India',
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: 'Full Time',
      experienceRequired: null,
      jobDescription: meta.join(' '),
      requiredSkills: [],
    })
  }

  return jobs
}

export const createEasternSoftwareSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Eastern Software Solutions careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('The verified Eastern Software Solutions careers page no longer exposes trusted first-party job links')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      department: null,
      jobId: slugify(job.title),
      requisitionId: slugify(job.title),
      minimumQualification: null,
      preferredQualification: null,
      postingDate: null,
      closingDate: null,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createEasternSoftwareSolutionsScraper().run(options)

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
