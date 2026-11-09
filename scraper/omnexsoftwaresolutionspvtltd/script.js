import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'omnexsoftwaresolutionspvtltd'
export const COMPANY = 'Omnex Software Solutions Pvt.Ltd.'
export const HOME_URL = 'https://www.omnexsystems.com/'
export const ABOUT_URL = 'https://www.omnexsystems.com/about'
export const CAREERS_URL = 'http://careers.omnexsystems.com/Users/Jobs'
export const JOBS_API_URL = 'http://careers.omnexsystems.com/Users/GetJobs'
export const CLIENT_ID = '27'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&lsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^in$/i.test(normalized) || /^india$/i.test(normalized)) return 'India'
  return normalized
}

const buildLocation = (...parts) => {
  const normalizedParts = parts.map((part) => normalizeWhitespace(part)).filter(Boolean)
  return normalizedParts.length > 0 ? normalizedParts.join(', ') : null
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const dotNetDateMatch = normalized.match(/^\/Date\((\d+)(?:[+-]\d+)?\)\/$/)
  if (dotNetDateMatch) {
    const date = new Date(Number.parseInt(dotNetDateMatch[1], 10))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const candidate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}Z`
    : normalized

  const date = new Date(candidate)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export const extractHiddenInputValue = (html, fieldName) => {
  const fieldPattern = escapeRegExp(fieldName)
  const patterns = [
    new RegExp(
      `<input[^>]+(?:id|name)=["']${fieldPattern}["'][^>]+value=["']([^"']*)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<input[^>]+value=["']([^"']*)["'][^>]+(?:id|name)=["']${fieldPattern}["'][^>]*>`,
      'i',
    ),
  ]

  for (const pattern of patterns) {
    const match = String(html ?? '').match(pattern)
    if (match) return normalizeWhitespace(match[1])
  }

  return null
}

const hasOfficialCareersHandoffLink = (html) =>
  /https:\/\/careers\.omnexsystems\.com\/Users\/Jobs/i.test(String(html ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return normalized.includes('omnex')
    && hasOfficialCareersHandoffLink(page)
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('omnex systems, llc')
    && normalized.includes('ann arbor, michigan')
    && hasOfficialCareersHandoffLink(html)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return extractHiddenInputValue(page, 'hiddenFooterClientName') === COMPANY
    && extractHiddenInputValue(page, 'hdnClientId') === CLIENT_ID
    && /\/Scripts\/UsersJobs\.js/i.test(page)
}

const isOfficialListingRecord = (record) => {
  const company = normalizeWhitespace(record?.ClientName)
  const jobId = normalizeWhitespace(record?.Id)
  const title = normalizeWhitespace(record?.Title)

  return company === COMPANY
    && Boolean(jobId)
    && Boolean(title)
}

const unwrapListingsPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.Jobs)) return payload.Jobs
  return null
}

export const isOfficialListingsPayload = (records) =>
  Array.isArray(unwrapListingsPayload(records))
  && unwrapListingsPayload(records).every((record) => isOfficialListingRecord(record))

export const buildListingsApiUrl = ({
  pageNumber = 1,
  rowsPerPage = 100,
  sorting = '',
  clientId = CLIENT_ID,
  searchQuery = '',
  location = '',
  experience = '',
  jobType = '',
  skills = '',
} = {}) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('pageNumber', String(pageNumber))
  url.searchParams.set('rowsPerPage', String(rowsPerPage))
  url.searchParams.set('sorting', sorting)
  url.searchParams.set('ClientId', String(clientId))
  url.searchParams.set('SearchQuery', searchQuery)
  url.searchParams.set('Location', location)
  url.searchParams.set('Experience', experience)
  url.searchParams.set('JobType', jobType)
  url.searchParams.set('skills', skills)
  return url.toString()
}

export const buildJobDetailUrl = (jobId) => {
  const url = new URL('http://careers.omnexsystems.com/Users/Index')
  url.searchParams.set('JobId', String(jobId))
  return url.toString()
}

export const extractSearchResults = (records) => {
  const listingRecords = unwrapListingsPayload(records)

  if (!Array.isArray(listingRecords) || !isOfficialListingsPayload(records)) {
    throw new Error('Response is not the verified Omnex Software Solutions jobs feed')
  }

  return listingRecords
    .map((record) => {
      const country = normalizeCountry(record?.Country)
      if (country && country !== 'India') return null

      const jobId = normalizeWhitespace(record?.Id)
      const location = buildLocation(record?.City, record?.State, country || 'India')
      const city = normalizeWhitespace(record?.City)
      const description = stripTags(record?.Description)
      const sourceUrl = buildJobDetailUrl(jobId)

      return {
        title: normalizeWhitespace(record?.Title),
        company: COMPANY,
        department: null,
        location,
        city,
        country: country || 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record?.Job_Type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDate(record?.CreatedDate),
        closingDate: toIsoDate(record?.EndDate),
        jobDescription: description,
      }
    })
    .filter(Boolean)
}

const buildJobPostingFromRawJsonLd = (rawJson) => {
  if (!/"@type"\s*:\s*"JobPosting"/i.test(rawJson)) return null

  const readField = (fieldName) =>
    normalizeWhitespace(
      rawJson.match(new RegExp(`"${escapeRegExp(fieldName)}"\\s*:\\s*"([\\s\\S]*?)"`, 'i'))?.[1],
    )

  return {
    '@type': 'JobPosting',
    title: readField('title'),
    description: readField('description'),
    datePosted: readField('datePosted'),
    validThrough: readField('validThrough'),
    employmentType: readField('employmentType'),
    identifier: {
      name: normalizeWhitespace(
        rawJson.match(/"identifier"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([\s\S]*?)"/i)?.[1],
      ),
      value: normalizeWhitespace(
        rawJson.match(/"identifier"\s*:\s*\{[\s\S]*?"value"\s*:\s*"([\s\S]*?)"/i)?.[1],
      ),
    },
    hiringOrganization: {
      name: normalizeWhitespace(
        rawJson.match(/"hiringOrganization"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([\s\S]*?)"/i)?.[1],
      ),
    },
    jobLocation: {
      address: {
        addressLocality: readField('addressLocality'),
        addressRegion: readField('addressRegion'),
        addressCountry: readField('addressCountry'),
      },
    },
  }
}

const parseJobPostingJsonLd = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (Array.isArray(parsed)) {
        const match = parsed.find((item) => item?.['@type'] === 'JobPosting')
        if (match) return match
      } else if (parsed?.['@type'] === 'JobPosting') {
        return parsed
      }
    } catch {
      const fallbackJobPosting = buildJobPostingFromRawJsonLd(rawJson)
      if (fallbackJobPosting) return fallbackJobPosting
    }
  }

  return null
}

const readPrimaryAddress = (jobPosting = {}) => {
  const jobLocations = Array.isArray(jobPosting.jobLocation)
    ? jobPosting.jobLocation
    : [jobPosting.jobLocation]

  for (const jobLocation of jobLocations) {
    const address = jobLocation?.address || jobLocation
    if (address) return address
  }

  return {}
}

const extractJobDetail = (html, listing = {}) => {
  const jobPosting = parseJobPostingJsonLd(html)
  const footerClientName = extractHiddenInputValue(html, 'hiddenFooterClientName')

  if (footerClientName !== COMPANY) {
    throw new Error('Response is not the verified Omnex Software Solutions job detail page')
  }

  const hiringOrganizationName = normalizeWhitespace(jobPosting?.hiringOrganization?.name)
  const identifierName = normalizeWhitespace(jobPosting?.identifier?.name)

  if (!jobPosting || (hiringOrganizationName !== COMPANY && identifierName !== COMPANY)) {
    throw new Error('Response is not the verified Omnex Software Solutions job detail page')
  }

  const address = readPrimaryAddress(jobPosting)
  const country = normalizeCountry(address.addressCountry)
  const description = stripTags(extractHiddenInputValue(html, 'hdnDescription'))
    || stripTags(jobPosting.description)

  return {
    company: COMPANY,
    location: buildLocation(address.addressLocality, address.addressRegion, country),
    city: normalizeWhitespace(address.addressLocality),
    country: country || listing.country || 'India',
    requisitionId: normalizeWhitespace(jobPosting?.identifier?.value) || listing.requisitionId,
    employmentType: normalizeWhitespace(jobPosting?.employmentType) || listing.employmentType,
    postingDate: toIsoDate(jobPosting?.datePosted) || listing.postingDate,
    closingDate: toIsoDate(jobPosting?.validThrough) || listing.closingDate,
    jobDescription: description || listing.jobDescription,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createOmnexSoftwareSolutionsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  rowsPerPage = 100,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOME_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified Omnex Systems homepage')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Response is not the verified Omnex Systems about page')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified Omnex Software Solutions jobs page')
    }

    const records = await fetchJson(buildListingsApiUrl({ rowsPerPage }))
    const listings = extractSearchResults(records)
    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(buildJobDetailUrl(listing.jobId))
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
      })
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createOmnexSoftwareSolutionsScraper().run(options)

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
