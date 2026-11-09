import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://citiustech.ripplehire.com'
const TOKEN = 'bCKlfz3OO8vQIgiM2vuI'
const SOURCE = 'CAREERSITE'
const SEARCH_PATH = '/candidate/candidatejobsearch'
const DETAIL_PATH = '/candidate/candidatejobdetail'
const DEFAULT_PAGE_SIZE = 10
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const FOREIGN_LOCATION_PATTERN =
  /\b(new jersey|princeton|dallas|denver|brentwood|rochester|usa|united states|remote\s*\(usa\)|tn\b|nj\b|co\b|mn\b)\b/i
const INDIA_LOCATION_PATTERN =
  /\b(pune|mumbai|chennai|hyderabad|bangalore|bengaluru|india|eon|qubix|sez|wilco source hyderabad)\b/i

const LOCATION_TO_CITY = [
  { pattern: /\b(pune|eon|qubix)\b/i, city: 'Pune' },
  { pattern: /\bmumbai\b/i, city: 'Mumbai' },
  { pattern: /\bchennai\b/i, city: 'Chennai' },
  { pattern: /\bhyderabad\b/i, city: 'Hyderabad' },
  { pattern: /\b(bangalore|bengaluru)\b/i, city: 'Bengaluru' },
  { pattern: /\bremote\b/i, city: 'Remote' },
  { pattern: /\bnew jersey\b/i, city: 'New Jersey' },
  { pattern: /\bprinceton\b/i, city: 'Princeton' },
  { pattern: /\bdallas\b/i, city: 'Dallas' },
  { pattern: /\bdenver\b/i, city: 'Denver' },
  { pattern: /\bbrentwood\b/i, city: 'Brentwood' },
  { pattern: /\brochester\b/i, city: 'Rochester' },
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x2F;/gi, '/')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')
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

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSectionListItems = (html, headingPattern) => {
  const content = String(html ?? '')
  const match = headingPattern.exec(content)
  if (!match) return []

  const remainder = content.slice(match.index)
  const listMatch = remainder.match(/<ul>([\s\S]*?)<\/ul>/i)
  return listMatch ? extractListItems(listMatch[1]) : []
}

const normalizeCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  for (const candidate of LOCATION_TO_CITY) {
    if (candidate.pattern.test(normalized)) {
      return candidate.city
    }
  }

  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const buildLocation = (value, fallbackCities = []) => {
  const city = normalizeCity(value) || normalizeCity(fallbackCities[0])
  if (city) {
    return city === 'Remote' ? 'Remote, India' : `${city}, India`
  }

  const normalized = normalizeWhitespace(value)
  return normalized ? `${normalized}, India` : 'India'
}

export const isIndiaListing = ({ location, countryCode } = {}) => {
  const haystack = [location, countryCode]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')

  if (!haystack) return false
  if (FOREIGN_LOCATION_PATTERN.test(haystack)) return false
  if (INDIA_LOCATION_PATTERN.test(haystack)) return true

  const city = normalizeCity(haystack)?.toLowerCase()
  return ['pune', 'mumbai', 'chennai', 'hyderabad', 'bengaluru', 'remote'].includes(city)
}

export const buildSearchRequestPayload = (page = 0) => ({
  page,
  search: '*:*',
  token: TOKEN,
  source: SOURCE,
  pagesize: DEFAULT_PAGE_SIZE,
})

const buildSearchRequestBody = (page = 0) => new URLSearchParams({
  careerSiteUrlParams: JSON.stringify(buildSearchRequestPayload(page)),
  lang: 'en',
})

export const buildDetailUrl = (jobSeq) =>
  `${BASE_URL}/candidate/?token=${TOKEN}&source=${SOURCE}#detail/job/${jobSeq}`

export const buildApplyUrl = (jobSeq) =>
  `${BASE_URL}/candidate/?token=${TOKEN}&source=${SOURCE}#apply/job/${jobSeq}`

const buildDetailApiUrl = (jobSeq) => {
  const params = new URLSearchParams({
    token: TOKEN,
    jobSeq,
    source: SOURCE,
    lang: 'en',
  })

  return `${BASE_URL}${DETAIL_PATH}?${params.toString()}`
}

export const extractSearchSummary = (payload = {}) => ({
  startJobIndex: Number.parseInt(payload.startJobIndex, 10) || 0,
  pageSize: Number.parseInt(payload.maxJobSize, 10) || DEFAULT_PAGE_SIZE,
  totalJobCount: Number.parseInt(payload.totalJobCount, 10) || 0,
})

export const normalizeEmploymentType = (value, title = '') => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''

  if (normalized) {
    if (/intern|internship|apprentice/.test(normalized)) return 'Internship'
    if (/fixed term|temporary|contract/.test(normalized)) return 'Contract'
    if (/employee|regular|permanent|full[\s-]*time|^r$/.test(normalized)) return 'Full-time'
  }

  if (/intern|internship|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchResults = (payload = {}) => {
  const records = Array.isArray(payload.jobVoList) ? payload.jobVoList : []

  return records
    .map((record) => {
      const jobSeq = normalizeWhitespace(record.jobSeq)
      const title = normalizeWhitespace(record.jobTitle)
      const rawLocation = normalizeWhitespace(record.locations || record.jobLocation)
      const requisitionId = normalizeWhitespace(record.jobId) || jobSeq
      const department = normalizeWhitespace(record.bussinessUnit)

      if (!jobSeq || !title || !rawLocation) return null
      if (!isIndiaListing({ location: rawLocation, countryCode: record.jobLocation })) return null

      return {
        title,
        location: buildLocation(rawLocation),
        city: normalizeCity(rawLocation),
        jobId: jobSeq,
        requisitionId,
        sourceUrl: buildDetailUrl(jobSeq),
        applyUrl: buildApplyUrl(jobSeq),
        experienceRequired: normalizeWhitespace(record.jobReqExp),
        postingDate: normalizeWhitespace(record.jobPostingDate),
        department,
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (payload = {}, listing = {}) => {
  const job = payload.jobVO || {}
  const title = normalizeWhitespace(job.jobTitle) || listing.title || null
  const jobSeq = normalizeWhitespace(job.jobSeq) || listing.jobId || null
  const requisitionId = normalizeWhitespace(job.jobId) || listing.requisitionId || jobSeq
  const rawLocation = normalizeWhitespace(job.locations || job.jobLocation) || listing.location || null
  const descriptionHtml = job.jobDesc || ''
  const locationOptions = extractSectionListItems(descriptionHtml, /location\s*:\s*-?/i)
  const city = listing.city || normalizeCity(rawLocation) || normalizeCity(locationOptions[0]) || null
  const qualifications = extractSectionListItems(descriptionHtml, /educational qualifications\s*:\s*-?/i)
  const skills = [
    ...extractSectionListItems(descriptionHtml, /mandatory technical skills\s*:\s*-?/i),
    ...extractSectionListItems(descriptionHtml, /good to have skills\s*:\s*-?/i),
  ]

  return {
    title,
    location: listing.location || buildLocation(rawLocation, locationOptions),
    city,
    jobId: jobSeq,
    requisitionId,
    employmentType: normalizeEmploymentType(job.jobTypeCustom3 || job.jobType, title),
    experienceRequired: normalizeWhitespace(job.jobReqExp) || listing.experienceRequired || null,
    department: normalizeWhitespace(job.bussinessUnit) || listing.department || null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: qualifications[0] || null,
    preferredQualification: qualifications[1] || null,
    requiredSkills: [...new Set(skills.map((value) => normalizeWhitespace(value)).filter(Boolean))],
    postingDate: normalizeWhitespace(job.publishDetails?.CAREER_SITE)
      || normalizeWhitespace(job.jobPostingDate)
      || listing.postingDate
      || null,
    closingDate: null,
    applyUrl: listing.applyUrl || (jobSeq ? buildApplyUrl(jobSeq) : null),
    sourceUrl: listing.sourceUrl || (jobSeq ? buildDetailUrl(jobSeq) : null),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    ...(options.headers || {}),
  },
})

export const createCitiusTechScraper = ({ fetchJson = defaultFetchJson } = {}) => ({
  run: async ({ fetchJson: overrideFetchJson, maxPages: overrideMaxPages } = {}) => {
    const fetchImpl = overrideFetchJson || fetchJson
    const jobs = []
    const seenJobIds = new Set()
    const maxPages = Number.isInteger(overrideMaxPages)
      ? overrideMaxPages
      : Number.isInteger(config.maxPages)
        ? config.maxPages
        : Number.POSITIVE_INFINITY

    for (let page = 0; page < maxPages; page += 1) {
      const listingPayload = await fetchImpl(`${BASE_URL}${SEARCH_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: buildSearchRequestBody(page),
      })

      const listings = extractSearchResults(listingPayload)
      const summary = extractSearchSummary(listingPayload)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailPayload = await fetchImpl(buildDetailApiUrl(listing.jobId))
        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: 'CitiusTech',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          link: detail.applyUrl || listing.applyUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'citiustech',
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        })
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || DEFAULT_PAGE_SIZE
      const nextStartIndex = (summary.startJobIndex ?? 0) + pageSize

      if (listings.length === 0 || nextStartIndex >= totalJobCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createCitiusTechScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  console.log(`Running CitiusTech scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'citiustech')
    console.log('DB result:', result)
    process.exit(0)
  }
}
