import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import EIDIKO_SYSTEMS_INTEGRATORS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EIDIKO_SYSTEMS_INTEGRATORS_CATALOG.source
export const COMPANY = EIDIKO_SYSTEMS_INTEGRATORS_CATALOG.companyName
export const CAREERS_URL = EIDIKO_SYSTEMS_INTEGRATORS_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')

const normalizeWhitespace = (value = '') => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const extractText = (value = '') => normalizeWhitespace(value) || null

const extractSlug = (url = '') => {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname.split('/').pop() || null
  } catch {
    return null
  }
}

const extractSpecification = (html = '', name = '') =>
  extractText(
    String(html ?? '').match(
      new RegExp(`awsm-job-specification-${name}[\\s\\S]*?<span[^>]*class=["'][^"']*awsm-job-specification-term[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, 'i'),
    )?.[1] || '',
  )

const extractMetaDescription = (html = '') =>
  extractText(String(html ?? '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || '')

const isIndiaLocation = (value = '') =>
  /\bindia\b|bangalore|bengaluru|hyderabad|chennai|pune|mumbai|gurgaon|gurugram|noida|delhi/i
    .test(String(value ?? ''))

const normalizeLocation = (value = '') => {
  const location = extractText(value)
  if (!location) return null
  if (/,\s*india$/i.test(location)) return location
  return isIndiaLocation(location) ? `${location}, India` : location
}

const extractCity = (value = '') => extractText(value)?.split(',')[0]?.trim() || null

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('Current Openings in Eidiko')
    && /awsm_job_openings/i.test(page)
    && /https:\/\/eidiko\.com\/job\//i.test(page)
}

export const extractListingJobs = (html = '') =>
  [...String(html ?? '').matchAll(/<article[^>]*class=["'][^"']*awsm_job_openings[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)]
    .map((match) => {
      const body = match[1]
      const detailUrl = String(body.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] || '')
      const title = extractText(body.match(/<h[1-6][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h[1-6]>/i)?.[1] || '')
      const summary = extractText(body.match(/<div[^>]*class=["'][^"']*elementor-post__excerpt[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '')

      return {
        title,
        detailUrl,
        jobId: extractSlug(detailUrl),
        requisitionId: extractSlug(detailUrl),
        summary,
      }
    })
    .filter((job) => job.title && job.detailUrl && job.jobId)

export const extractJobDetail = (html = '', listing = {}) => {
  const page = String(html ?? '')
  const metaDescription = extractMetaDescription(page) || ''
  const rawTitle = extractText(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    || extractText(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
    || listing.title
  const title = extractText(rawTitle?.replace(/\s*-\s*Eidiko Systems Integrators\s*$/i, '')) || listing.title
  const location = normalizeLocation(extractSpecification(page, 'job-location'))
  const employmentType = extractSpecification(page, 'job-type')
  const experienceRequired = extractSpecification(page, 'experience')
    || extractText(metaDescription.match(/Experience:\s*([^.]*)/i)?.[1] || '')
  const description = extractText(
    page.match(/<div[^>]*class=["'][^"']*awsm-job-entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div[^>]*class=["'][^"']*awsm-job-form/i)?.[1]
      || listing.summary
      || '',
  )

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractCity(location),
    country: isIndiaLocation(location) ? 'India' : null,
    jobId: listing.jobId,
    requisitionId: listing.requisitionId,
    sourceUrl: listing.detailUrl,
    applyUrl: listing.detailUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

export const run = async ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Eidiko Systems Integrators verified careers page changed materially')
  }

  const listings = extractListingJobs(careersHtml)
  const jobs = []

  for (const listing of listings) {
    const detailHtml = await fetchText(listing.detailUrl)
    const job = extractJobDetail(detailHtml, listing)
    if (!isIndiaLocation(job.location || '')) continue

    jobs.push({
      ...job,
      country: 'India',
      source: SOURCE,
      link: listing.detailUrl,
      scrapedAt: now(),
    })
  }

  return jobs
}

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
