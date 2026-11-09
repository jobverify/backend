import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'

import { VSERVE_EBUSINESS_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = VSERVE_EBUSINESS_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

const decodeEscapedJsString = (value = '') => normalizeWhitespace(
  decodeHtmlEntities(
    String(value)
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/\\r/g, ' ')
      .replace(/\\n/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\//g, '/')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\-/g, '-'),
  ),
)

const extractEscapedJsonProperty = (page = '', propertyName = '') => {
  const pattern = new RegExp(`"${escapeRegex(propertyName)}":"((?:\\\\.|[^"\\\\])*)"`, 'i')
  return page.match(pattern)?.[1] || ''
}

const extractJobOtherDetail = (page = '', fieldLabel = '') => {
  const pattern = new RegExp(`"fieldLabel":"${escapeRegex(fieldLabel)}"[\\s\\S]*?"value":"((?:\\\\.|[^"\\\\])*)"`, 'i')
  return page.match(pattern)?.[1] || ''
}

const extractFieldFromDescription = (text = '', label = '', nextLabels = []) => {
  if (!text || !label) {
    return null
  }

  const tail = nextLabels.length > 0
    ? `(?=\\b(?:${nextLabels.map((value) => escapeRegex(value)).join('|')})\\b|$)`
    : '$'
  const pattern = new RegExp(`\\b${escapeRegex(label)}\\b\\s+(.+?)\\s*${tail}`, 'i')
  const match = text.match(pattern)
  return match ? normalizeWhitespace(match[1]) : null
}

const parseIndiaLocation = ({ city, state, location, country }) => {
  const scopedCity = getValidIndiaCityForJob({
    city: normalizeCity(city || location || '') || city || location || '',
    location,
    country,
  })

  if (!scopedCity) {
    return null
  }

  const normalizedCity = normalizeCity(scopedCity) || scopedCity
  const normalizedState = normalizeWhitespace(state || '') || null
  const locationParts = [normalizedCity, normalizedState, 'India']
    .filter((value, index, values) => value && values.indexOf(value) === index)

  return {
    location: locationParts.join(', '),
    city: normalizedCity,
    state: normalizedState,
    country: 'India',
  }
}

export const extractEmbeddedZohoPortalUrl = (html = '') => {
  const page = String(html)
  const rawPortalUrl = page.match(/<iframe\b[^>]*\bsrc="(https:\/\/recruit\.zoho\.com\/recruit\/Portal\.na\?iframe=false[^"]+)"/i)?.[1]
    || page.match(/data-lazy-src="(https:\/\/recruit\.zoho\.com\/recruit\/Portal\.na\?iframe=false[^"]+)"/i)?.[1]
    || page.match(/<noscript><iframe[^>]+src="(https:\/\/recruit\.zoho\.com\/recruit\/Portal\.na\?iframe=false[^"]+)"/i)?.[1]

  return rawPortalUrl ? rawPortalUrl.replace(/(?:&amp;|&#0*38;)/gi, '&') : null
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Current Job Openings and Opportunities in Vserve Ebusiness Solutions')
    && normalized.includes('Careers')
    && Boolean(extractEmbeddedZohoPortalUrl(html))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) return current
    current = current?.cause
  }

  return null
}

const hasAnyHttpStatus = (error, statuses) => Boolean(
  findErrorInChain(error, (candidate) => statuses.includes(Number(candidate?.status))),
)

const createBlockedAccessError = (label, cause) => Object.assign(
  new Error(`Vserve Ebusiness Solutions ${label} is currently blocked by upstream access controls`, {
    cause,
  }),
  {
    code: 'VSERVE_CAREERS_BLOCKED',
    failureKind: 'blocked_or_access_denied',
    softFailure: true,
    upstreamOutage: true,
    abortRetries: true,
  },
)

const fetchTextOrBlocked = async (fetchText, url, label) => {
  try {
    return await fetchText(url)
  } catch (error) {
    if (hasAnyHttpStatus(error, [307, 403, 429])) {
      throw createBlockedAccessError(label, error)
    }
    throw error
  }
}

export const hasZohoJobPortalSignal = (html = '') => {
  const page = String(html)
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Posting Title')
    && normalized.includes('Job Type')
    && normalized.includes('Date Opened')
    && normalized.includes('City')
    && /class="jobListTable"|class="jobDetailRow"|PortalDetail\.na\?iframe=true|zr-joblist-detail_/i.test(page)
}

export const extractPortalListings = (html = '', portalUrl = '') => {
  const page = String(html)
  const listingsById = new Map()
  const rowPattern = /<tr id="zr-joblist-detail_(\d+)" class="jobDetailRow"[\s\S]*?<\/tr>/gi

  for (const match of page.matchAll(rowPattern)) {
    const row = match[0]
    const jobId = normalizeWhitespace(match[1] || '')
    const detailPath = row.match(/<a class=['"]jobdetail['"] href=['"]([^'"]+)['"]/i)?.[1] || ''
    const detailUrl = buildAbsoluteUrl(detailPath.replace(/&amp;/g, '&'), portalUrl)
    const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cellMatch) => normalizeWhitespace(cellMatch[1] || ''))
    const title = normalizeWhitespace(row.match(/<a class=['"]jobdetail['"][^>]*>([\s\S]*?)<\/a>/i)?.[1] || cells[0] || '')
    const employmentType = cells[1] || null
    const openedOn = cells[2] || null
    const city = cells[3] || null

    if (!jobId || !detailUrl || !title || !employmentType || !city) {
      continue
    }

    if (listingsById.has(jobId)) {
      continue
    }

    listingsById.set(jobId, {
      jobId,
      title,
      employmentType,
      openedOn,
      city,
      detailUrl,
    })
  }

  return [...listingsById.values()]
}

export const extractZohoJobDetail = (html = '', detailUrl = '') => {
  const page = String(html)
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    || decodeEscapedJsString(extractEscapedJsonProperty(page, 'headerName'))
    || decodeEscapedJsString(extractEscapedJsonProperty(page, 'jobTitle'))
  const jobDescription = decodeEscapedJsString(
    page.match(/"jobDescriptionDetails":\s*\[\{"richText":\{"fieldLabel":"Job Description","uitype":5501,"value":"((?:\\.|[^"\\])*)"\}\}\]/i)?.[1]
      || '',
  ) || normalizeWhitespace(page.match(/<meta name="description" content="([\s\S]*?)"/i)?.[1] || '')
  const location = decodeEscapedJsString(extractEscapedJsonProperty(page, 'location'))
  const employmentType = decodeEscapedJsString(extractEscapedJsonProperty(page, 'jobType'))
  const country = decodeEscapedJsString(extractEscapedJsonProperty(page, 'country'))
  const city = decodeEscapedJsString(extractJobOtherDetail(page, 'City')) || location
  const state = decodeEscapedJsString(extractJobOtherDetail(page, 'State/Province'))
  const department = extractFieldFromDescription(jobDescription, 'Department', [
    'Reports To',
    'Job Summary',
    'Key Responsibilities',
    'Required Skills',
    'Education',
  ])

  return {
    title,
    location,
    city,
    state,
    country,
    employmentType,
    department,
    jobDescription,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    link: detailUrl,
  }
}

export const createVserveEbusinessSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchTextOrBlocked(fetchText, CAREERS_URL, 'careers route')

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Vserve Ebusiness Solutions verified first-party careers page no longer matches the trusted public careers contract')
    }

    const portalUrl = extractEmbeddedZohoPortalUrl(careersHtml)
    if (!portalUrl) {
      throw new Error('Vserve Ebusiness Solutions careers page no longer exposes the embedded Zoho Recruit portal')
    }

    const portalHtml = await fetchTextOrBlocked(fetchText, portalUrl, 'embedded Zoho portal')
    if (!hasZohoJobPortalSignal(portalHtml)) {
      throw new Error('Vserve Ebusiness Solutions embedded Zoho portal no longer matches the verified public job table')
    }

    const listings = extractPortalListings(portalHtml, portalUrl)
    if (listings.length === 0) {
      throw new Error('Vserve Ebusiness Solutions embedded Zoho portal no longer exposes trusted visible jobs')
    }

    const jobs = (await Promise.all(listings.map(async (listing) => {
      const detailHtml = await fetchTextOrBlocked(fetchText, listing.detailUrl, 'embedded Zoho detail page')
      const detail = extractZohoJobDetail(detailHtml, listing.detailUrl)
      const scopedLocation = parseIndiaLocation({
        city: detail.city || listing.city,
        state: detail.state,
        location: detail.location || listing.city,
        country: detail.country,
      })

      if (!scopedLocation) {
        return null
      }

      return {
        title: detail.title || listing.title,
        company: COMPANY,
        location: scopedLocation.location,
        city: scopedLocation.city,
        state: scopedLocation.state,
        country: scopedLocation.country,
        employmentType: detail.employmentType || listing.employmentType,
        remoteStatus: null,
        jobDescription: detail.jobDescription || listing.title,
        department: detail.department,
        sourceUrl: detail.sourceUrl || listing.detailUrl,
        applyUrl: detail.applyUrl || listing.detailUrl,
        link: detail.link || listing.detailUrl,
        jobId: listing.jobId,
        requisitionId: listing.jobId,
        source: SOURCE,
        scrapedAt: now(),
      }
    })))
      .filter(Boolean)
      .sort((left, right) => left.title.localeCompare(right.title))

    if (jobs.length === 0) {
      throw new Error('Vserve Ebusiness Solutions embedded Zoho portal no longer exposes trusted India-scoped jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createVserveEbusinessSolutionsScraper().run(options)

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
