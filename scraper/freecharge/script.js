import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { FREECHARGE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_PAGE_SIZE = 10
const TOKEN = 'IoV5vvUSMKLwmaa1Suou'
const BOARD_SOURCE = 'CAREERSITE'
const SEARCH_PATH = '/candidate/candidatejobsearch'
const DETAIL_PATH = '/candidate/candidatejobdetail'
const JOB_BOARD_TITLE = 'Freecharge Careers | Latest jobs at Freecharge - Ripplehire.com'
const FOREIGN_LOCATION_PATTERN =
  /\b(singapore|united states|usa|uk|united kingdom|canada|germany|australia|new zealand|uae|dubai|abu dhabi|saudi|qatar|oman|kuwait|europe|london|berlin)\b/i
const INDIA_LOCATION_PATTERN =
  /\b(india|gurugram|gurgaon|noida|delhi|new delhi|bangalore|bengaluru|mumbai|pune|hyderabad|chennai|remote)\b/i

const LOCATION_TO_CITY = [
  { pattern: /\bgurugram\b|\bgurgaon\b/i, city: 'Gurugram' },
  { pattern: /\bnoida\b/i, city: 'Noida' },
  { pattern: /\b(new delhi|delhi)\b/i, city: 'Delhi' },
  { pattern: /\b(bangalore|bengaluru)\b/i, city: 'Bengaluru' },
  { pattern: /\bmumbai\b/i, city: 'Mumbai' },
  { pattern: /\bpune\b/i, city: 'Pune' },
  { pattern: /\bhyderabad\b/i, city: 'Hyderabad' },
  { pattern: /\bchennai\b/i, city: 'Chennai' },
  { pattern: /\bremote\b/i, city: 'Remote' },
]

export const PROVIDER_METADATA = FREECHARGE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const COMPANY_CAREER_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const JOB_BOARD_URL = PROVIDER_METADATA.jobBoardUrl
export const JOB_SEARCH_API_URL = PROVIDER_METADATA.jobsApiUrl

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
    .replace(/<[^>]+>/g, ' ')
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

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractXmlTagValue = (tagName, value) => extractFirst(
  new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
  value,
)

const extractXmlBlocks = (tagName, xml) =>
  [...String(xml ?? '').matchAll(new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, 'gi'))]
    .map((match) => match[0])

const isXmlPayload = (payload) => typeof payload === 'string' && payload.trim().startsWith('<')

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

const parseSearchRecords = (payload) => {
  if (Array.isArray(payload?.jobVoList)) {
    return payload.jobVoList
  }

  if (!isXmlPayload(payload)) return []

  return extractXmlBlocks('jobVoList', payload).map((block) => ({
    jobSeq: extractXmlTagValue('jobSeq', block),
    jobTitle: extractXmlTagValue('jobTitle', block),
    jobLocation: extractXmlTagValue('jobLocation', block),
    jobReqExp: extractXmlTagValue('jobReqExp', block),
    jobPostingDate: extractXmlTagValue('jobPostingDate', block),
    locations: extractXmlTagValue('locations', block),
    jobId: extractXmlTagValue('jobId', block),
    bussinessUnit: extractXmlTagValue('bussinessUnit', block),
  }))
}

const parseDetailJob = (payload) => {
  if (payload?.jobVO) {
    return payload.jobVO
  }

  if (!isXmlPayload(payload)) return {}

  const block = extractFirst(/<jobVO>([\s\S]*?)<\/jobVO>/i, payload)
  if (!block) return {}

  return {
    jobSeq: extractXmlTagValue('jobSeq', block),
    jobId: extractXmlTagValue('jobId', block),
    jobTitle: extractXmlTagValue('jobTitle', block),
    jobDesc: extractXmlTagValue('jobDesc', block),
    jobLocation: extractXmlTagValue('jobLocation', block),
    jobReqExp: extractXmlTagValue('jobReqExp', block),
    jobType: extractXmlTagValue('jobType', block),
    jobPostingDate: extractXmlTagValue('jobPostingDate', block),
    locations: extractXmlTagValue('locations', block),
    bussinessUnit: extractXmlTagValue('bussinessUnit', block),
    jobTypeCustom3: extractXmlTagValue('jobTypeCustom3', block),
    jobSkills: extractXmlTagValue('jobSkills', block),
    publishDetails: {
      CAREER_SITE: extractFirst(/<publishDetails>[\s\S]*?<CAREER_SITE>([\s\S]*?)<\/CAREER_SITE>/i, block),
    },
  }
}

const extractFallbackSkills = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

export const isIndiaListing = ({ location, countryCode } = {}) => {
  const normalizedCountry = normalizeWhitespace(countryCode)?.toLowerCase() || ''
  const normalizedLocation = normalizeWhitespace(location) || ''
  const haystack = [normalizedCountry, normalizedLocation].filter(Boolean).join(' ')

  if (!haystack) return false
  if (/\b(ind|india)\b/i.test(normalizedCountry)) return true
  if (FOREIGN_LOCATION_PATTERN.test(haystack)) return false
  if (INDIA_LOCATION_PATTERN.test(haystack)) return true

  const city = normalizeCity(haystack)?.toLowerCase()
  return ['gurugram', 'noida', 'delhi', 'bengaluru', 'mumbai', 'pune', 'hyderabad', 'chennai', 'remote'].includes(city)
}

export const buildSearchRequestPayload = (page = 0) => ({
  page,
  search: '*:*',
  token: TOKEN,
  source: BOARD_SOURCE,
  pagesize: DEFAULT_PAGE_SIZE,
})

const buildSearchRequestBody = (page = 0) => new URLSearchParams({
  careerSiteUrlParams: JSON.stringify(buildSearchRequestPayload(page)),
  lang: 'en',
})

export const buildDetailUrl = (jobSeq) =>
  `${PORTAL_ORIGIN}/candidate/?source=${BOARD_SOURCE}&token=${TOKEN}#detail/job/${jobSeq}`

export const buildApplyUrl = (jobSeq) =>
  `${PORTAL_ORIGIN}/candidate/?source=${BOARD_SOURCE}&token=${TOKEN}#apply/job/${jobSeq}`

const buildDetailApiUrl = (jobSeq) => {
  const params = new URLSearchParams({
    token: TOKEN,
    jobSeq,
    source: BOARD_SOURCE,
    lang: 'en',
  })

  return `${PORTAL_ORIGIN}${DETAIL_PATH}?${params.toString()}`
}

export const extractSearchSummary = (payload = {}) => {
  if (isXmlPayload(payload)) {
    return {
      startJobIndex: extractFirst(/<startJobIndex>(\d+)<\/startJobIndex>/i, payload, (match) => Number.parseInt(match[1], 10)) || 0,
      pageSize: extractFirst(/<maxJobSize>(\d+)<\/maxJobSize>/i, payload, (match) => Number.parseInt(match[1], 10)) || DEFAULT_PAGE_SIZE,
      totalJobCount: extractFirst(/<totalJobCount>(\d+)<\/totalJobCount>/i, payload, (match) => Number.parseInt(match[1], 10)) || 0,
    }
  }

  return {
    startJobIndex: Number.parseInt(payload.startJobIndex, 10) || 0,
    pageSize: Number.parseInt(payload.maxJobSize, 10) || DEFAULT_PAGE_SIZE,
    totalJobCount: Number.parseInt(payload.totalJobCount, 10) || 0,
  }
}

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

export const extractSearchResults = (payload = {}) => parseSearchRecords(payload)
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

export const extractJobDetail = (payload = {}, listing = {}) => {
  const job = parseDetailJob(payload)
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
    ...extractFallbackSkills(job.jobSkills),
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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchPayload = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/javascript, application/xml, text/xml, */*; q=0.01',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const extractCareersHandoffUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/https:\/\/freecharge\.ripplehire\.com\/candidate\/\?[^"'\s<>]+/gi)) {
    const decoded = decodeHtmlEntities(match[0])

    try {
      const url = new URL(decoded)
      if (url.hostname !== 'freecharge.ripplehire.com') continue
      if (url.pathname !== '/candidate/') continue
      if (url.searchParams.get('token') !== TOKEN) continue
      if ((url.searchParams.get('source') || '').toUpperCase() !== BOARD_SOURCE) continue

      const canonicalUrl = new URL('https://freecharge.ripplehire.com/candidate/')
      canonicalUrl.searchParams.set('token', TOKEN)
      canonicalUrl.searchParams.set('source', BOARD_SOURCE)
      canonicalUrl.hash = '#list'
      return canonicalUrl.toString()
    } catch {
      // Ignore malformed candidate URLs and continue searching for the verified handoff.
    }
  }

  return null
}

export const hasVerifiedHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return normalized.includes('Freecharge')
    && /href=["']https:\/\/careers\.freecharge\.in\/?["']/i.test(String(html ?? ''))
    && normalized.includes('Freecharge Payment Technologies Pvt. Ltd. All Rights Reserved')
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /<title>\s*Careers at Freecharge\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('#ChangeYourFuture')
    && normalized.includes('Grow Your Career')
    && normalized.includes('open roles')
    && extractCareersHandoffUrl(html) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const hasVerifiedJobBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /<title\b[^>]*>/i.test(String(html ?? ''))
    && normalized.includes(JOB_BOARD_TITLE)
    && normalized.includes('Latest jobs at Freecharge')
}

const decorateJobs = (jobs, scrapedAt) => jobs.map((job) => ({
  ...job,
  company: COMPANY,
  source: SOURCE,
  scrapedAt,
}))

export const createFreeChargeScraper = ({
  now = () => new Date().toISOString(),
  fetchPayload = defaultFetchPayload,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchPayload: overrideFetchPayload,
    maxPages,
  } = {}) {
    const payloadFetcher = overrideFetchPayload || fetchPayload
    const scrapedAt = now()

    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('FreeCharge verified homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(COMPANY_CAREER_PAGE_URL)
    if (careersPage.status !== 200 || !hasVerifiedCareersPageSignal(careersPage.html)) {
      throw new Error('FreeCharge verified careers page no longer exposes the known RippleHire handoff')
    }

    const jobBoardPage = await fetchPage(JOB_BOARD_URL)
    if (jobBoardPage.status !== 200 || !hasVerifiedJobBoardSignal(jobBoardPage.html)) {
      throw new Error('FreeCharge verified public RippleHire board no longer matches the known surface')
    }

    const jobs = []
    const seenJobIds = new Set()
    const maxPagesToFetch = Number.isInteger(maxPages)
      ? maxPages
      : Number.isInteger(config.maxPages)
        ? config.maxPages
        : Number.POSITIVE_INFINITY

    for (let page = 0; page < maxPagesToFetch; page += 1) {
      const listingPayload = await payloadFetcher(`${PORTAL_ORIGIN}${SEARCH_PATH}`, {
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

        const detailPayload = await payloadFetcher(buildDetailApiUrl(listing.jobId))
        const detail = extractJobDetail(detailPayload, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: OFFICIAL_BRAND_NAME,
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          link: detail.applyUrl || listing.applyUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt,
        })
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || DEFAULT_PAGE_SIZE
      const nextStartIndex = (summary.startJobIndex ?? 0) + pageSize

      if (listings.length === 0 || nextStartIndex >= totalJobCount) break
    }

    return decorateJobs(jobs, scrapedAt)
  },
})

export const run = async (options = {}) => createFreeChargeScraper().run(options)

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
