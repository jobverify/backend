import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.publicissapient.com'
const DEFAULT_PAGE_SIZE = 50

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
      .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
      .replace(/&ndash;|&#8211;/gi, '-')
      .replace(/&mdash;|&#8212;/gi, '-')
      .replace(/&bull;|&#8226;/gi, '•')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')

    if (next === decoded) break
    decoded = next
  }

  return decoded
}

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value) => {
  if (!value) return null
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractTagListItems = (html) => [...String(html ?? '').matchAll(
  /<li class="level-item">([\s\S]*?)<\/li>/gi,
)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const decodeEmbeddedJsonString = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
  .replace(/\\r\\n|\\n|\\r/g, ' ')
  .replace(/\\t/g, ' ')
  .replace(/\\"/g, '"')
  .replace(/\\\//g, '/')

const extractEmbeddedSectionHtml = (html, sectionKey, nextKeys = []) => {
  const nextPattern = nextKeys.map(escapeRegex).join('|')
  if (!nextPattern) return null

  const match = String(html ?? '').match(
    new RegExp(
      `&#34;${escapeRegex(sectionKey)}&#34;:\\{[\\s\\S]*?&#34;body&#34;:&#34;([\\s\\S]*?)&#34;\\},&#34;(?:${nextPattern})&#34;:`,
      'i',
    ),
  )

  return match ? decodeEmbeddedJsonString(match[1]) : null
}

const extractParagraphBulletItems = (html) => [...decodeEmbeddedJsonString(html).matchAll(
  /<(?:p|div)\b[^>]*>\s*(?:•|-)\s*([\s\S]*?)<\/(?:p|div)>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSectionItems = (html) => [...new Set([
  ...extractListItems(html),
  ...extractParagraphBulletItems(html),
])]

const extractJsonLdJobPosting = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed JSON-LD blocks until the public JobPosting payload is found.
    }
  }

  return null
}

const extractSectionHtml = (html, heading) => extractFirst(
  new RegExp(
    `<h2>${heading}<\\/h2>\\s*<div>([\\s\\S]*?)<\\/div>\\s*<\\/div>`,
    'i',
  ),
  html,
)

const extractDescriptionHtml = (html) => extractFirst(
  /<div class="job-details-content content">\s*([\s\S]*?)<\/div>\s*<\/div>\s*<div class="siov-column is-4-desktop job-details-other-jobs">/i,
  html,
)

const extractApplyUrl = (html) => toAbsoluteUrl(
  extractFirst(
    /v-bind:href="'([^'?]+)(?:\?'?\+[^']*)?'[\s\S]*?class="button is-rounded apply-now"/i,
    html,
  ),
)
  || toAbsoluteUrl(
    decodeEmbeddedJsonString(
      extractFirst(
        /&#34;primaryCta&#34;:\{[\s\S]*?&#34;ctaLinkUrl&#34;:&#34;([\s\S]*?)&#34;,[\s\S]*?&#34;ctaOpenLinkInNewTab&#34;/i,
        html,
      ),
    ),
  )
  || toAbsoluteUrl(
    extractFirst(
      /<a class="sr-only" href="([^"]+)">\s*Apply now/i,
      html,
    ),
  )

const extractLocationFromJsonLd = (jobPosting = {}) => {
  const address = jobPosting?.jobLocation?.address || {}
  const streetAddress = normalizeWhitespace(address.streetAddress)
  const region = normalizeWhitespace(address.addressRegion)
  const country = normalizeWhitespace(address.addressCountry)
  const location = normalizeWhitespace(
    [streetAddress, region, country].filter(Boolean).join(', '),
  )

  return {
    location,
    country,
  }
}

export const buildJobsApiUrl = ({ start = 0, rows = DEFAULT_PAGE_SIZE } = {}) => {
  const url = new URL('/apps/ps-rebrand/careersJobsearch', BASE_URL)
  url.searchParams.set('searchType', '/search')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('q', '')
  url.searchParams.set('start', String(Math.max(0, Number(start) || 0)))
  url.searchParams.set('rows', String(Math.max(1, Number(rows) || DEFAULT_PAGE_SIZE)))
  url.searchParams.set('country', 'India')
  return url.toString()
}

export const extractJobsPayload = (payload = {}) => ({
  jobs: Array.isArray(payload?.response?.docs) ? payload.response.docs : [],
  totalCount: Number.isInteger(payload?.response?.numFound) ? payload.response.numFound : 0,
  start: Number.isInteger(payload?.response?.start) ? payload.response.start : 0,
})

export const normalizeJobListing = (job = {}) => ({
  title: normalizeWhitespace(job.name),
  department: normalizeWhitespace(job.teams || job.costCenterName || null),
  location: normalizeWhitespace(job.displayLocation),
  city: normalizeWhitespace(job.city),
  country: normalizeWhitespace(job.countryName),
  jobId: normalizeWhitespace(job.jobId || job.id),
  requisitionId: normalizeWhitespace(job.jobId || job.id),
  employmentType: normalizeWhitespace(job.typeOfEmployment),
  experienceRequired: normalizeWhitespace(job.experienceLevel),
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: normalizeWhitespace(job.releasedDate),
  closingDate: null,
  sourceUrl: toAbsoluteUrl(job.jobDetailUrl),
  applyUrl: toAbsoluteUrl(job.jobUrl),
  jobDescription: null,
})

export const extractJobDetail = (html, listing = {}) => {
  const jobPosting = extractJsonLdJobPosting(html)
  const tagItems = extractTagListItems(html)
  const descriptionHtml = extractDescriptionHtml(html)
    || extractEmbeddedSectionHtml(html, 'jobDescriptionSection', [
      'qualificationDescriptionSection',
      'additionalInformationSection',
      'companyDetailsSection',
      'primaryCta',
    ])
    || null
  const qualificationsHtml = extractSectionHtml(html, 'Qualifications')
    || extractEmbeddedSectionHtml(html, 'qualificationDescriptionSection', [
      'additionalInformationSection',
      'companyDetailsSection',
      'primaryCta',
    ])
  const additionalInfoHtml = extractSectionHtml(html, 'Additional Information')
    || extractEmbeddedSectionHtml(html, 'additionalInformationSection', [
      'companyDetailsSection',
      'primaryCta',
    ])
  const locationFromJsonLd = extractLocationFromJsonLd(jobPosting)
  const minimumQualification = stripTags(qualificationsHtml)
  const preferredQualification = stripTags(additionalInfoHtml)
  const requiredSkills = extractSectionItems(qualificationsHtml)
  const jobDescription = stripTags(descriptionHtml) || normalizeWhitespace(jobPosting?.description)
  const publicExperienceChecked = Boolean(
    jobDescription
    || minimumQualification
    || preferredQualification
    || requiredSkills.length > 0,
  )

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1 class="job-title">([\s\S]*?)<\/h1>/i, html),
    ) || normalizeWhitespace(jobPosting?.title) || listing.title || null,
    department: normalizeWhitespace(
      extractFirst(/<p class="job-details-header-teams">([\s\S]*?)<\/p>/i, html),
    ) || listing.department || null,
    location: tagItems[1] || locationFromJsonLd.location || listing.location || null,
    city: listing.city || null,
    country: locationFromJsonLd.country || listing.country || 'India',
    employmentType: tagItems[2] || normalizeWhitespace(jobPosting?.employmentType) || listing.employmentType || null,
    experienceRequired: listing.experienceRequired || null,
    minimumQualification,
    preferredQualification,
    requiredSkills,
    postingDate: normalizeWhitespace(jobPosting?.datePosted) || listing.postingDate || null,
    closingDate: normalizeWhitespace(jobPosting?.validThrough) || null,
    applyUrl: extractApplyUrl(html) || listing.applyUrl || null,
    sourceUrl: listing.sourceUrl || null,
    jobDescription,
    publicExperienceChecked,
  }
}

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://careers.publicissapient.com/job-search',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const fetchText = async (url, referer = 'https://careers.publicissapient.com/job-search') => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: referer,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createPublicisSapientScraper = () => ({
  buildJobsApiUrl,
  extractJobsPayload,
  normalizeJobListing,
  extractJobDetail,
  run: async (options = {}) => {
    const getJson = options.fetchJson || fetchJson
    const getText = options.fetchText || fetchText
    const pageSize = Number.isInteger(options.rows) ? options.rows : DEFAULT_PAGE_SIZE
    const maxPages = Number.isInteger(options.maxPages)
      ? options.maxPages
      : (Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY)
    const maxJobs = Number.isInteger(options.maxJobs) ? options.maxJobs : Number.POSITIVE_INFINITY

    const jobs = []
    const seenListingUrls = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize
      const payload = extractJobsPayload(
        await getJson(buildJobsApiUrl({ start, rows: pageSize })),
      )

      if (!payload.jobs.length) break

      for (const item of payload.jobs) {
        const listing = normalizeJobListing(item)
        const uniqueListingKey = listing.sourceUrl || listing.jobId
        if (!listing.jobId || !uniqueListingKey || seenListingUrls.has(uniqueListingKey)) continue
        seenListingUrls.add(uniqueListingKey)

        const detailHtml = await getText(listing.sourceUrl, buildJobsApiUrl({ start, rows: pageSize }))
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          ...listing,
          ...Object.fromEntries(
            Object.entries(detail).filter(([, value]) => value != null),
          ),
          company: 'Publicis Sapient',
          source: 'publicissapient',
          link: detail.applyUrl || listing.applyUrl || listing.sourceUrl,
          scrapedAt: new Date().toISOString(),
        })

        if (jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (payload.jobs.length < pageSize) break
      if (payload.totalCount > 0 && start + payload.jobs.length >= payload.totalCount) break
    }

    return jobs
  },
})

export const run = async () => createPublicisSapientScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Publicis Sapient scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'publicissapient')
    console.log('DB result:', result)
    process.exit(0)
  }
}
