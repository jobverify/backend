import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MOTHERSON_SUMI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MOTHERSON_SUMI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_LANDING_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.handoffBoardUrl
export const BOARD_ORIGIN = 'https://careers.motherson.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeText = (value) => stripTags(value)?.toLowerCase() || ''

const toLocation = (job = {}) => {
  const city = normalizeWhitespace(job?.location?.name)
  const country = normalizeWhitespace(job?.location?.country?.name)

  if (!city && !country) return { location: null, city: null, country: null }
  if (!city) return { location: country, city: null, country }
  if (!country) return { location: city, city, country: null }

  return {
    location: `${city}, ${country}`,
    city,
    country,
  }
}

const extractNextData = (html) => {
  const match = String(html ?? '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i)
  if (!match?.[1]) {
    throw new Error('Motherson Sumi verified public jobs board no longer exposes embedded Next.js data')
  }

  return JSON.parse(match[1])
}

const extractAllJobs = (data) => {
  const pageProps = data?.props?.pageProps || {}
  if (Array.isArray(pageProps.allJobs)) return pageProps.allJobs
  if (Array.isArray(pageProps.jobsListing?.allJobs)) return pageProps.jobsListing.allJobs
  return []
}

const extractRequisitionId = (value) => normalizeWhitespace(String(value ?? '').match(/-(\d+)$/)?.[1]) || null

const extractDepartmentFromSearchTerms = (job = {}) => {
  const initial = normalizeWhitespace(job?.searchTerms)
  if (!initial) return null

  let remainder = initial
  const removals = [
    job?.title,
    job?.location?.name,
    job?.location?.country?.name,
    job?.careerLevel?.name,
  ].map((value) => normalizeWhitespace(value)).filter(Boolean)

  for (const value of removals) {
    remainder = remainder.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, 'ig'), ' ')
  }

  const normalized = normalizeWhitespace(remainder)
  return normalized || null
}

const buildSection = (label, value) => {
  const text = stripTags(value)
  return text ? `${label}: ${text}` : null
}

const buildJobDescription = (job = {}) => [
  buildSection('Introduction', job.introduction),
  buildSection('Tasks', job.tasks),
  buildSection('Profile', job.profile),
  buildSection('What we offer', job.whatWeOffer),
].filter(Boolean).join('\n\n') || null

export const buildDetailUrl = (slug) => `${BOARD_ORIGIN}/en/job/${String(slug ?? '')}`

export const hasOfficialCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Careers and internships\s*-\s*Motherson Group\s*<\/title>/i.test(rawHtml)
    && normalized.includes('our global family at motherson')
    && /https:\/\/careers\.motherson\.com\/en/i.test(rawHtml)
    && normalized.includes('your career opportunities')
}

export const hasOfficialJobsBoardSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title\b[^>]*>\s*Jobs\s*(?:—|&mdash;|&#8212;|-)\s*Motherson Careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('all jobs')
    && normalized.includes('job portal')
    && /\bwe(?:l)?come to our careers platform\b/i.test(normalized)
    && /__NEXT_DATA__/i.test(rawHtml)
}

export const extractIndiaJobListings = (html) => {
  const data = extractNextData(html)
  const jobs = extractAllJobs(data)

  return jobs
    .filter((job) => /india/i.test(normalizeWhitespace(job?.location?.country?.name) || ''))
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const slug = normalizeWhitespace(job?.slug)
      const jobId = normalizeWhitespace(job?.id)
      const { location, city, country } = toLocation(job)
      const sourceUrl = slug ? buildDetailUrl(slug) : null

      if (!title || !slug || !jobId || !location || !country || !sourceUrl) {
        throw new Error('Motherson Sumi verified public jobs board no longer exposes the expected India listing fields')
      }

      return {
        title,
        company: COMPANY_NAME,
        department: extractDepartmentFromSearchTerms(job),
        location,
        city,
        country,
        jobId,
        requisitionId: extractRequisitionId(slug),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
}

export const extractJobDetail = (html, listing = {}) => {
  const data = extractNextData(html)
  const job = data?.props?.pageProps?.job

  if (!job?.slug || !job?.title || !job?.location?.country?.name) {
    throw new Error('Motherson Sumi verified public job detail page changed materially')
  }

  const { location, city, country } = toLocation(job)
  const sourceUrl = buildDetailUrl(job.slug)
  const applyUrl = normalizeWhitespace(job.applyUrl) || sourceUrl

  return {
    title: normalizeWhitespace(job.title) || listing.title || null,
    company: COMPANY_NAME,
    department: listing.department || null,
    location: location || listing.location || null,
    city: city || listing.city || null,
    country: country || listing.country || null,
    jobId: normalizeWhitespace(job.id) || listing.jobId || null,
    requisitionId: extractRequisitionId(job.slug) || listing.requisitionId || listing.jobId || null,
    sourceUrl,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(job),
  }
}

export const isMissingPublicDetailPageError = (error, sourceUrl) => {
  const targetUrl = normalizeWhitespace(sourceUrl)
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    if (current?.status === 404) {
      return true
    }

    const message = normalizeWhitespace(current?.message)
    if (targetUrl && message?.includes(`HTTP 404 for ${targetUrl}`)) {
      return true
    }

    current = current?.cause
  }

  return false
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMothersonSumiScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const landingHtml = await fetchText(CAREERS_LANDING_URL)
    if (!hasOfficialCareersLandingSignal(landingHtml)) {
      throw new Error('Motherson Sumi verified official careers page changed materially')
    }

    const jobsBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasOfficialJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('Motherson Sumi verified public jobs board changed materially')
    }

    const listings = extractIndiaJobListings(jobsBoardHtml)
    const scrapedAt = now()
    const jobs = []
    let skippedMissingDetailCount = 0

    for (const listing of listings) {
      try {
        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt,
        })
      } catch (error) {
        if (isMissingPublicDetailPageError(error, listing.sourceUrl)) {
          skippedMissingDetailCount += 1
          continue
        }
        throw error
      }
    }

    if (skippedMissingDetailCount > 0 && jobs.length === 0 && listings.length > 0) {
      throw new Error('Motherson Sumi India listings no longer expose any live public detail pages')
    }

    return jobs
  },
})

export const run = async (options = {}) => createMothersonSumiScraper(options).run()

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
