import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from '../../scraper-support/myworkday/engine.js'

import { BENTLEY_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BENTLEY_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_HOST_URL = PROVIDER_METADATA.officialJobsHostUrl
export const INDIA_SEARCH_URL = PROVIDER_METADATA.indiaSearchUrl
export const SAMPLE_JOB_URL = PROVIDER_METADATA.sampleJobUrl
export const WORKDAY_BOARD_URL = 'https://bentleysystems.wd5.myworkdayjobs.com/bentley'
export const WORKDAY_JOBS_API_URL = 'https://bentleysystems.wd5.myworkdayjobs.com/wday/cxs/bentleysystems/bentley/jobs'
const WORKDAY_DETAIL_API_BASE_URL = 'https://bentleysystems.wd5.myworkdayjobs.com/wday/cxs/bentleysystems/bentley'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, '\'')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const EXPERIENCE_CONTEXT_PATTERN = String.raw`(?:\s+of\s+(?:[a-z0-9+/,-]+\s+){0,8}?experience|\s+experience)`
const DESCRIPTION_CONTAINER_PATTERN = /<(div|span)\b(?=[^>]*\bitemprop=["']description["'])(?=[^>]*\bclass=["'][^"']*\bjobdescription\b[^"']*["'])[^>]*>/i

const findMatchingClosingTagIndex = (html, tagName, fromIndex) => {
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = fromIndex
  let depth = 1
  let match = tagPattern.exec(html)

  while (match) {
    const tag = match[0]
    const isClosingTag = tag.startsWith('</')
    const isSelfClosingTag = /\/>$/.test(tag)

    if (isClosingTag) {
      depth -= 1
      if (depth === 0) return match.index
    } else if (!isSelfClosingTag) {
      depth += 1
    }

    match = tagPattern.exec(html)
  }

  return -1
}

const extractJobDescriptionHtml = (html = '') => {
  const rawHtml = String(html ?? '')
  const openingMatch = rawHtml.match(DESCRIPTION_CONTAINER_PATTERN)

  if (!openingMatch || openingMatch.index == null) return null

  const containerTagName = String(openingMatch[1] ?? '').toLowerCase()
  const contentStartIndex = openingMatch.index + openingMatch[0].length
  const closingTagIndex = findMatchingClosingTagIndex(rawHtml, containerTagName, contentStartIndex)

  if (closingTagIndex === -1) return null

  return rawHtml.slice(contentStartIndex, closingTagIndex).trim() || null
}

const formatExperienceYears = (minimum, maximum = null, suffix = '') => {
  if (!minimum) return null
  if (maximum) return `${minimum}-${maximum} years`
  return `${minimum}${suffix} years`
}

const extractExperienceRequired = (value) => {
  const text = stripTags(value)
  if (!text) return null

  const rangeMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to)\\s*(\\d+(?:\\.\\d+)?)\\s+years?${EXPERIENCE_CONTEXT_PATTERN}`, 'i'))
  if (rangeMatch) {
    return formatExperienceYears(rangeMatch[1], rangeMatch[2])
  }

  const plusMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\+\\s+years?${EXPERIENCE_CONTEXT_PATTERN}`, 'i'))
  if (plusMatch) {
    return formatExperienceYears(plusMatch[1], null, '+')
  }

  const singleMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s+years?${EXPERIENCE_CONTEXT_PATTERN}`, 'i'))
  if (singleMatch) {
    return formatExperienceYears(singleMatch[1])
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const timestamp = normalized ? Date.parse(normalized) : Number.NaN
  if (Number.isNaN(timestamp)) return normalized
  return new Date(timestamp).toISOString().slice(0, 10)
}

const extractJobIdFromUrl = (value) => {
  const match = String(value ?? '').match(/\/(\d+)\/?$/)
  return match ? match[1] : null
}

export const hasOfficialJobsHostSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*(?:Careers \| )?Bentley Systems/i.test(page)
    && /https:\/\/www\.bentley\.com\/company\/careers\//i.test(page)
    && /https:\/\/jobs\.bentley\.com\/search\/\?searchby=location/i.test(page)
    && /locationsearch=/i.test(page)
}

export const hasWorkdayJobsHostSignal = (html = '') =>
  /bentleysystems\.wd5\.myworkdayjobs\.com\/bentley/i.test(String(html ?? ''))

export const hasOfficialWorkdayHandoffSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title[^>]*>\s*Careers\s*\|\s*Bentley Systems\s*\|\s*Infrastructure Engineering Software Company\s*<\/title>/i.test(page)
    && /A career at Bentley/i.test(stripTags(page))
    && /href=["']https:\/\/bentleysystems\.wd5\.myworkdayjobs\.com\/bentley["']/i.test(page)
}

export const getWorkdayIndiaLocationIds = (payload) => {
  if (!Array.isArray(payload?.facets)) {
    throw new Error('Bentley Workday jobs API no longer exposes location facets')
  }
  const groups = payload.facets.find((facet) => facet.facetParameter === 'locationMainGroup')?.values
  const locations = groups?.find((group) => group.facetParameter === 'locations')?.values
  if (!Array.isArray(locations)) {
    throw new Error('Bentley Workday jobs API no longer exposes location facets')
  }
  const ids = locations.filter((location) => /,\s*India$/i.test(location.descriptor ?? ''))
    .map((location) => location.id)
    .filter(Boolean)
  if (ids.length === 0) {
    throw new Error('Bentley Workday jobs API no longer exposes verified India locations')
  }
  return ids
}

export const hasIndiaSearchResultsSignal = (html = '') => {
  const page = String(html ?? '')
  return /locationsearch=India/i.test(page)
    && /class="data-row"/i.test(page)
    && /href="\/job\//i.test(page)
}

export const extractSearchResults = (html = '') => {
  const results = []
  const seenUrls = new Set()

  for (const match of String(html ?? '').matchAll(
    /<tr class="data-row">([\s\S]*?)<\/tr>/gi,
  )) {
    const rowHtml = match[1]
    const relativeUrl = rowHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    const sourceUrl = toAbsoluteUrl(relativeUrl, JOBS_HOST_URL)
    const title = stripTags(rowHtml.match(/class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '')
    const location = stripTags(rowHtml.match(/<span class="jobLocation">([\s\S]*?)<\/span>/i)?.[1] || '')
    const postingDate = stripTags(rowHtml.match(/<span class="jobDate">([\s\S]*?)<\/span>/i)?.[1] || '')

    if (!sourceUrl || !title || !location || seenUrls.has(sourceUrl)) continue
    seenUrls.add(sourceUrl)

    const jobId = extractJobIdFromUrl(sourceUrl)

    results.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: normalizeWhitespace(location.split(',')[0]),
      country: /,\s*IN$/i.test(location) ? 'India' : null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: null,
    })
  }

  return results
}

export const extractJobDetail = (html = '', listing = {}) => {
  const rawHtml = String(html ?? '')
  const applyUrl = toAbsoluteUrl(
    rawHtml.match(/<a[^>]+class="btn[^"]*apply[^"]*"[^>]+href="([^"]+)"/i)?.[1],
    listing.sourceUrl || SAMPLE_JOB_URL,
  )
  const jobDescription = extractJobDescriptionHtml(rawHtml)
  const detailLocation = stripTags(rawHtml.match(/<span class="jobGeoLocation">([\s\S]*?)<\/span>/i)?.[1] || '')
  const postingDate = stripTags(rawHtml.match(/<p[^>]+class="jobDate"[\s\S]*?<strong>\s*Date:\s*<\/strong>([\s\S]*?)<\/p>/i)?.[1] || '')
  const closingDate = toIsoDate(rawHtml.match(/itemprop="validThrough" content="([^"]+)"/i)?.[1] || null)
  const title = stripTags(rawHtml.match(/<h1 id="job-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || listing.title || '')
  const experienceRequired = extractExperienceRequired(jobDescription)

  return {
    ...listing,
    title: title || listing.title || null,
    location: detailLocation || listing.location || null,
    city: normalizeWhitespace((detailLocation || listing.location || '').split(',')[0]),
    country: /,\s*IN$/i.test(detailLocation || listing.location || '') ? 'India' : listing.country,
    sourceUrl: listing.sourceUrl,
    applyUrl: applyUrl || listing.applyUrl,
    postingDate: postingDate || listing.postingDate,
    closingDate: closingDate || listing.closingDate,
    jobDescription: jobDescription || listing.jobDescription,
    experienceRequired: experienceRequired || listing.experienceRequired || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, { method = 'GET', body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const html = await response.text()
  if (hasWorkdayOutageSignal({html, url: response.url})) {
    throw new WorkdayUpstreamOutageError(`[${SOURCE}] Workday is currently unavailable upstream at ${url}`)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return JSON.parse(html)
}

const fetchWorkdayIndiaJobs = async ({ fetchJson, now }) => {
  const body = (appliedFacets, offset = 0) => ({ appliedFacets, limit: 20, offset, searchText: '' })
  const overview = await fetchJson(WORKDAY_JOBS_API_URL, { method: 'POST', body: body({}) })
  const locationIds = getWorkdayIndiaLocationIds(overview)
  const appliedFacets = { locations: locationIds }
  const postings = []
  let offset = 0
  let total = null
  do {
    const page = await fetchJson(WORKDAY_JOBS_API_URL, { method: 'POST', body: body(appliedFacets, offset) })
    if (!Number.isInteger(page?.total) || !Array.isArray(page?.jobPostings)) {
      throw new Error('Bentley Workday India jobs response changed materially')
    }
    total = page.total
    if (total > 0 && page.jobPostings.length === 0) {
      throw new Error('Bentley Workday India jobs response ended before the reported total')
    }
    postings.push(...page.jobPostings)
    offset += page.jobPostings.length
  } while (offset < total)

  const jobs = []
  for (const posting of postings) {
    const externalPath = String(posting?.externalPath ?? '')
    const location = normalizeWhitespace(posting?.locationsText)
    if (!/^\/job\/[A-Za-z0-9/_-]+$/.test(externalPath)
      || !/,\s*India$/i.test(location ?? '')
      || !normalizeWhitespace(posting?.title)) {
      throw new Error('Bentley Workday India listing changed materially')
    }
    const payload = await fetchJson(`${WORKDAY_DETAIL_API_BASE_URL}${externalPath}`)
    const detail = payload?.jobPostingInfo
    const applyUrl = `${WORKDAY_BOARD_URL}${externalPath}`
    if (!detail
      || detail.externalUrl !== applyUrl
      || detail.title !== posting.title
      || !/,\s*India$/i.test(detail.location ?? '')) {
      throw new Error('Bentley Workday detail no longer matches the verified public board')
    }
    const description = stripTags(detail.jobDescription)
    jobs.push({
      title: detail.title,
      company: COMPANY,
      department: null,
      location: detail.location,
      city: normalizeWhitespace(detail.location.split(',')[0]),
      country: 'India',
      jobId: String(detail.id ?? detail.jobReqId ?? ''),
      requisitionId: normalizeWhitespace(detail.jobReqId),
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: extractExperienceRequired(description),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: detail.startDate ?? null,
      closingDate: null,
      jobDescription: description,
      source: SOURCE,
      link: applyUrl,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: 'workday',
      scrapedAt: now(),
    })
  }
  return jobs
}

export const createBentleySystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    let jobsHostHtml
    try {
      jobsHostHtml = await fetchText(JOBS_HOST_URL)
    } catch (error) {
      if (!/HTTP[\s_:-]*404\b/i.test(error?.message || '')) throw error
      const careersHtml = await fetchText(CAREERS_URL)
      if (!hasOfficialWorkdayHandoffSignal(careersHtml)) {
        throw new Error('Bentley official careers page no longer links to the verified Workday board')
      }
      return fetchWorkdayIndiaJobs({fetchJson, now})
    }
    if (hasWorkdayJobsHostSignal(jobsHostHtml)) {
      const careersHtml = await fetchText(CAREERS_URL)
      if (!hasOfficialWorkdayHandoffSignal(careersHtml)) {
        throw new Error('Bentley official careers page no longer links to the verified Workday board')
      }
      return fetchWorkdayIndiaJobs({ fetchJson, now })
    }
    if (!hasOfficialJobsHostSignal(jobsHostHtml)) {
      throw new Error('Bentley verified first-party jobs host no longer matches the known public surface')
    }

    const searchHtml = await fetchText(INDIA_SEARCH_URL)
    if (!hasIndiaSearchResultsSignal(searchHtml)) {
      throw new Error('Bentley verified India search surface no longer matches the known public results page')
    }

    const listings = extractSearchResults(searchHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        source: SOURCE,
        link: listing.sourceUrl,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: 'successfactors',
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createBentleySystemsScraper(options).run(options)

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
