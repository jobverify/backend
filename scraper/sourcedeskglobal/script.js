import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SOURCEDESKGLOBAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SOURCEDESKGLOBAL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#x27;|&#39;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
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

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractBetween = (text, startLabel, endLabel) => {
  const pattern = new RegExp(
    `${escapeRegExp(startLabel)}\\s+([\\s\\S]*?)\\s+${escapeRegExp(endLabel)}`,
    'i',
  )
  return normalizeWhitespace(pattern.exec(String(text ?? ''))?.[1] ?? '')
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /<title>\s*Find all Current Openings\s*-\s*Sourcedesk\s*<\/title>/i.test(raw)
    && normalized.includes('Find all Current Openings')
    && normalized.includes('Current Openings')
    && normalized.includes('Apply for Jobs')
    && /href=["']\/current-openings\/[^"']+["']/i.test(raw)
}

const isCurrentOpeningDetailUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.pathname.startsWith('/current-openings/')
      && parsed.pathname !== '/current-openings/'
  } catch {
    return false
  }
}

export const extractListingUrls = (html = '') => [...new Set(
  [...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean)
    .filter((url) => isCurrentOpeningDetailUrl(url)),
)]

export const hasJobDetailSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  const title = String(html ?? '').match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null

  return Boolean(normalizeWhitespace(title))
    && text.includes('Job Description')
    && text.includes('Job Information')
    && text.includes('Date Opened')
    && text.includes('Employment Type')
    && text.includes('Work Experience')
    && text.includes('Country India')
}

export const extractJobDetail = (html = '', detailUrl) => {
  if (!hasJobDetailSignal(html)) {
    throw new Error(`Sourcedesk Global first-party detail page changed materially: ${detailUrl}`)
  }

  const raw = String(html ?? '')
  const text = normalizeWhitespace(raw)
  const title = normalizeWhitespace(raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '')
  const jobDescription = extractBetween(text, 'Job Description', 'Job Information')
  const postingDate = extractBetween(text, 'Date Opened', 'Job Type')
  const jobType = extractBetween(text, 'Job Type', 'Employment Type')
  const employmentType = extractBetween(text, 'Employment Type', 'Work Experience')
  const experienceRequired = extractBetween(text, 'Work Experience', 'City')
  const city = extractBetween(text, 'City', 'Country')
  const country = extractBetween(text, 'Country', 'Department') || 'India'
  const department = extractBetween(text, 'Department', 'Share this job')

  return {
    title,
    company: COMPANY,
    department: department || null,
    location: [city, country].filter(Boolean).join(', ') || null,
    city: city || null,
    country,
    jobId: slugify(title),
    requisitionId: slugify(title),
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: employmentType || null,
    experienceRequired: experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: postingDate || null,
    closingDate: null,
    jobDescription: jobDescription || null,
    remoteStatus: /remote/i.test(jobType) ? 'Remote' : 'On-site',
  }
}

export const createSourcedeskGlobalScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow = now } = {}) {
    const listingHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCurrentOpeningsSignal(listingHtml)) {
      throw new Error('Sourcedesk Global verified first-party current-openings page changed materially')
    }

    const listingUrls = extractListingUrls(listingHtml)
    if (listingUrls.length === 0) {
      throw new Error('Sourcedesk Global verified current-openings page no longer exposes first-party job links')
    }

    const scrapedAt = overrideNow()
    const jobs = []
    for (const detailUrl of listingUrls) {
      const detailHtml = await fetchText(detailUrl)
      const detail = extractJobDetail(detailHtml, detailUrl)
      if (detail.country !== 'India') continue
      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSourcedeskGlobalScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await createSourcedeskGlobalScraper().run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
