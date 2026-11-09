import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import {
  KOCHARTECH_CATALOG,
  VERIFIED_JOB_DETAIL_URLS as VERIFIED_JOB_DETAIL_URLS_CONST,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KOCHARTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREER_API_URL = PROVIDER_METADATA.careerApiUrl
export { VERIFIED_JOB_DETAIL_URLS_CONST as VERIFIED_JOB_DETAIL_URLS }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const parsed = new Date(String(value ?? ''))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const isVerifiedApplyUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return /(^|\.)maxicus\.com$/i.test(url.hostname)
  } catch {
    return false
  }
}

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
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers\b[^<]*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.kochartech\.com\/careers\/["']/i.test(page)
    && /\bOpen Positions\b/i.test(page)
    && /https:\/\/www\.kochartech\.com\/career\/senior-manager-sales-2\//i.test(page)
    && /https:\/\/www\.kochartech\.com\/career\/inside-sales-executive-sales\//i.test(page)
    && /page-numbers/i.test(page)
}

export const extractDetailApplyUrl = (html = '') => {
  const page = String(html ?? '')
  const hrefMatch = page.match(
    /<a\b(?=[^>]*class=["'][^"']*kt-jobs-btn-apply-now[^"']*["'])[^>]*href=["']([^"']+)["'][^>]*>/i,
  ) || page.match(
    /<a\b(?=[^>]*href=["'][^"']+["'])[^>]*class=["'][^"']*kt-jobs-btn-apply-now[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i,
  )
  const applyUrl = toAbsoluteUrl(hrefMatch?.[1], CAREERS_URL)

  return isVerifiedApplyUrl(applyUrl) ? applyUrl : null
}

export const extractDetailDescription = (html = '') => {
  const match = String(html ?? '').match(/<div[^>]+id=["']job-des["'][^>]*>([\s\S]*?)<\/div>/i)
  return stripHtml(match?.[1]) || null
}

export const extractJobsFromRestPayload = (payload = []) => {
  if (!Array.isArray(payload)) {
    throw new Error('KocharTech careers API response no longer matches the expected payload')
  }

  return payload
    .filter((record) => record?.status === 'publish' && record?.type === 'career')
    .map((record) => {
      const title = normalizeWhitespace(record?.ACF?.job_profile || record?.title?.rendered)
      const rawLocation = normalizeWhitespace(record?.ACF?.job_location)
      const city = normalizeCity(rawLocation)
      const department = normalizeWhitespace(record?.ACF?.job_department)
      const sourceUrl = toAbsoluteUrl(record?.link, CAREERS_URL)

      if (!title || !rawLocation || !sourceUrl || !record?.id) return null

      return {
        title,
        company: COMPANY,
        department,
        location: `${city || rawLocation}, India`,
        city: city || rawLocation,
        country: 'India',
        jobId: String(record.id),
        requisitionId: String(record.id),
        sourceUrl,
        applyUrl: null,
        employmentType: null,
        experienceRequired: normalizeWhitespace(record?.ACF?.experience),
        minimumQualification: normalizeWhitespace(record?.ACF?.desired_candidate_profile),
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(record?.date),
        closingDate: null,
        jobDescription: stripHtml(record?.ACF?.job_description),
        remoteStatus: null,
      }
    })
    .filter(Boolean)
}

export const createKocharTechScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('KocharTech verified careers page no longer matches the known first-party surface')
    }

    const listings = extractJobsFromRestPayload(await fetchJson(CAREER_API_URL))
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings

    const jobs = await Promise.all(selectedListings.map(async (listing) => {
      const detailHtml = await fetchText(listing.sourceUrl)
      const applyUrl = extractDetailApplyUrl(detailHtml)

      if (!applyUrl) {
        throw new Error('KocharTech detail page no longer exposes the verified Maxicus apply handoff')
      }

      return {
        ...listing,
        applyUrl,
        jobDescription: extractDetailDescription(detailHtml) || listing.jobDescription,
        source: SOURCE,
        link: applyUrl,
        scrapedAt: now(),
      }
    }))

    return jobs
  },
})

export const run = async (options = {}) => createKocharTechScraper().run(options)

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
