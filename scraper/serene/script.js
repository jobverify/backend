import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import SERENE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SERENE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOBS_URL = PROVIDER_METADATA.officialJobsPageUrl
export const APPLICATION_URL = PROVIDER_METADATA.officialApplicationPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const slugify = (value) => String(value ?? '')
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

const VERIFIED_ROLE_TITLES = [
  'Bench Sales Recruiter',
  'Talent Acquisition Associate',
  'Resource Executive',
  'US IT Recruiter',
]

const DETAIL_URL_PATTERN = /https:\/\/www\.sereneinfosolutions\.in\/job\/[^"'#?]+\/?/i

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'careers - serene info solutions'
    && text.includes('shape your future with a career at serene')
    && text.includes('excellent opportunity to explore your passions.')
    && text.includes('at serene info solutions')
    && page.includes(JOBS_URL)
    && page.includes(APPLICATION_URL)
}

export const hasOfficialJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const title = (extractTitle(page) || '').toLowerCase()
  const detailUrls = extractJobListings(page)

  return title === 'job listing - serene info solutions'
    && page.includes('View Job')
    && detailUrls.length >= 3
    && VERIFIED_ROLE_TITLES.every((roleTitle) => page.includes(roleTitle))
}

export const hasOfficialApplicationFormSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'join us - serene info solutions'
    && text.includes('join us')
    && text.includes('upload cv')
    && text.includes('interested jobs')
    && text.includes('submit form')
}

const extractRoleExperience = (description) => {
  const match = String(description ?? '').match(/\b(\d+\s*-\s*\d+\s*years)\b/i)
  return normalizeWhitespace(match?.[1]) || null
}

export const extractJobListings = (html = '') => {
  const listings = []
  const seenSlugs = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["'](https:\/\/www\.sereneinfosolutions\.in\/job\/[^"']+\/?)["'][^>]*>[\s\S]*?View Job[\s\S]*?<\/a>/gi,
  )) {
    const detailUrl = normalizeWhitespace(match[1])
    const prefix = String(html ?? '').slice(Math.max(0, match.index - 2000), match.index)
    const title = normalizeWhitespace(
      [...prefix.matchAll(/<h1[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/gi)]
        .at(-1)?.[1],
    )
    const slug = slugify(detailUrl?.split('/').filter(Boolean).at(-1))

    if (!title || !detailUrl || !slug || seenSlugs.has(slug)) continue

    seenSlugs.add(slug)
    listings.push({
      slug,
      title,
      detailUrl,
    })
  }

  return listings
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const title = (extractTitle(page) || '').toLowerCase()

  return title.endsWith(' - serene info solutions')
    && /<link rel="canonical" href="https:\/\/www\.sereneinfosolutions\.in\/job\//i.test(page)
    && page.includes(APPLICATION_URL)
    && /Apply Now/i.test(page)
}

export const extractJobDetail = (html = '', listing = {}) => {
  const canonicalUrl = normalizeWhitespace(
    String(html ?? '').match(/<link rel="canonical" href="([^"]+)"/i)?.[1],
  )
  const title = normalizeWhitespace(
    String(html ?? '').match(/<h1[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title
  const detailUrl = canonicalUrl || listing.detailUrl
  const slug = slugify(detailUrl?.split('/').filter(Boolean).at(-1))
  const text = normalizeWhitespace(html) || ''
  const contentStart = title ? text.toLowerCase().lastIndexOf(title.toLowerCase()) : -1
  const bodyText = contentStart >= 0 ? text.slice(contentStart + title.length).trim() : text
  const locationSummary = normalizeWhitespace(
    bodyText.match(/^([\s\S]*?)\s+(?:Overview|Responsibilities|Qualifications)\b/i)?.[1],
  )
  const description = normalizeWhitespace(
    bodyText
      .replace(/\bApply Now\b[\s\S]*$/i, '')
      .replace(/\bHave a question\?.*$/i, '')
      .replace(/\bRequest a callback\..*$/i, '')
      .trim(),
  )

  if (!title || !detailUrl || !slug) {
    return null
  }

  return {
    slug,
    title,
    sourceUrl: detailUrl,
    applyUrl: APPLICATION_URL,
    experienceRequired: extractRoleExperience(description),
    jobDescription: description,
    locationSummary,
  }
}

export const createSereneScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Serene careers page changed materially')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsSignal(jobsHtml)) {
      throw new Error('The verified Serene jobs page changed materially')
    }

    const applicationHtml = await fetchText(APPLICATION_URL)
    if (!hasOfficialApplicationFormSignal(applicationHtml)) {
      throw new Error('The verified Serene application form changed materially')
    }

    const extractedJobs = extractJobListings(jobsHtml)
    if (extractedJobs.length === 0) {
      throw new Error('The verified Serene jobs page did not expose any public job listings')
    }

    const detailedJobs = []

    for (const listing of extractedJobs) {
      const detailHtml = await fetchText(listing.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`The verified Serene job detail page changed materially: ${listing.detailUrl}`)
      }

      const detail = extractJobDetail(detailHtml, listing)
      if (!detail) {
        throw new Error(`The verified Serene job detail page no longer returns a normalized job: ${listing.detailUrl}`)
      }

      detailedJobs.push(detail)
    }

    const limitedJobs = maxJobs ? detailedJobs.slice(0, maxJobs) : detailedJobs

    return limitedJobs.map((job) => ({
      title: job.title,
      company: COMPANY_NAME,
      department: null,
      location: job.locationSummary || 'India',
      city: null,
      country: 'India',
      jobId: job.slug,
      requisitionId: null,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: job.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSereneScraper(options).run(options)

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
