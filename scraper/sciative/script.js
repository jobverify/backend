import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SCIATIVE_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const titleCase = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-api`,
  timeoutMs: 20000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Explore Exciting Careers and Growth Opportunities \| Sciative\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/sciative\.com\/careers["']/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Advance Your Career with the Global Leader in Dynamic Pricing and AI-Driven Pricing Intelligence Software\./i.test(page)
}

export const hasOfficialCareersApiSignal = (payload) =>
  Array.isArray(payload)
  && payload.length > 0
  && payload.every((item) =>
    Number.isInteger(item?.id)
    && normalizeOptionalValue(item?.title)
    && item?.contentName === 'career'
    && Array.isArray(item?.subsections),
  )

const normalizeLocation = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) {
    return {
      location: 'India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  const parts = normalized
    .split(',')
    .map((part) => titleCase(part.trim()))
    .filter(Boolean)

  if (parts.at(-1)?.toLowerCase() !== 'india') {
    parts.push('India')
  }

  return {
    location: parts.join(', '),
    city: parts.length >= 2 ? parts.at(-2) : null,
    state: null,
    country: 'India',
  }
}

const normalizePostingDate = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  const isoDate = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  return isoDate?.[1] || null
}

const buildJobDescription = (item) => {
  const parts = []
  const introduction = normalizeOptionalValue(item?.introduction)
  if (introduction) {
    parts.push(`<p>${escapeHtml(introduction)}</p>`)
  }

  for (const subsection of Array.isArray(item?.subsections) ? item.subsections : []) {
    const heading = normalizeOptionalValue(subsection?.heading)
    const content = String(subsection?.content ?? '').trim()
    if (!heading && !content) continue

    parts.push([
      heading ? `<h3>${escapeHtml(heading)}</h3>` : '',
      content,
    ].filter(Boolean).join(''))
  }

  return parts.join('') || null
}

export const extractJobsFromApiPayload = (payload = []) =>
  (Array.isArray(payload) ? payload : [])
    .flatMap((item, index) => {
      if (!Number.isInteger(item?.id) || item?.is_deleted === true || item?.isLive === false) {
        return []
      }

      const title = normalizeOptionalValue(item.title)
      if (!title) return []

      const locationBits = normalizeLocation(item.location)

      return [{
        title,
        company: COMPANY,
        department: null,
        location: locationBits.location,
        city: locationBits.city,
        state: locationBits.state,
        country: locationBits.country,
        jobId: String(item.id),
        requisitionId: String(item.id),
        sourceUrl: `${CAREERS_URL}#${item.id}_${index}`,
        applyUrl: `${CAREERS_URL}#${item.id}_${index}`,
        employmentType: null,
        experienceRequired: normalizeOptionalValue(item.experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizePostingDate(item.created),
        closingDate: null,
        jobDescription: buildJobDescription(item),
      }]
    })

export const createSciativeSolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The official Sciative Solutions careers page no longer matches the verified public surface')
    }

    const careersPayload = await fetchJson(CAREERS_API_URL)
    if (!hasOfficialCareersApiSignal(careersPayload)) {
      throw new Error('The official Sciative Solutions careers API no longer matches the verified public surface')
    }

    return extractJobsFromApiPayload(careersPayload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSciativeSolutionsScraper().run(options)

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
