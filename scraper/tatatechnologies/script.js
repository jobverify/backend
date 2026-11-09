import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://tatatechnologies.ripplehire.com'
const TOKEN = 'jjZIWXgr7fPCCF6T5yk4'
const SOURCE = 'CAREERSITE'
const SEARCH_PATH = '/candidate/candidatejobsearch'
const DETAIL_PATH = '/candidate/candidatejobdetail'
const DEFAULT_PAGE_SIZE = 10
const INDIA_LOCATION_KEYS = [
  'ahmedabad',
  'bangalore',
  'banglore',
  'baramulla',
  'baroda',
  'bengaluru',
  'chennai',
  'coimbatore',
  'delhi',
  'gurgaon',
  'gurugram',
  'halol',
  'hyderabad',
  'india',
  'jamshedpur',
  'mumbai',
  'new delhi',
  'noida',
  'pimpri',
  'pune',
  'sanand',
  'thane',
  'trivandrum',
  'vadodara',
]
const CITY_CANONICAL_MAP = new Map([
  ['bangalore', 'Bangalore'],
  ['banglore', 'Bangalore'],
  ['bengaluru', 'Bangalore'],
  ['baroda', 'Baroda'],
  ['gurgaon', 'Gurgaon'],
  ['gurugram', 'Gurugram'],
  ['pimpri', 'Pimpri'],
  ['pune', 'Pune'],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const toTitleCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const canonicalizeLocationSegment = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const canonical = CITY_CANONICAL_MAP.get(normalized.toLowerCase())
  return canonical || toTitleCase(normalized)
}

const normalizeLocationText = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const repairBrokenMarkup = (value) => decodeHtmlEntities(value)
  .replace(/<(?=\s*(?:\r?\n|$))/g, '\n')

const stripTags = (value) => normalizeWhitespace(
  repairBrokenMarkup(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(value)
  return match ? transform(match) : null
}

const extractTagValue = (tagName, value) => extractFirst(
  new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
  value,
)

const extractJobBlocks = (xml) => [...String(xml).matchAll(/<jobVoList>\s*<jobSeq>[\s\S]*?<\/jobVoList>/gi)]
  .map((match) => match[0])

const extractListItems = (value) => [...repairBrokenMarkup(value).matchAll(/<li\b[^>]*>([\s\S]*?)(?=<li\b|<\/ul>|<\/ol>|<p\b|$)/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const splitLocationSegments = (value) => normalizeWhitespace(value)
  ?.split(/\s*(?:,|\/|&|\|)\s*/g)
  .map((segment) => normalizeWhitespace(segment))
  .filter(Boolean) || []

export const isIndiaListing = (value) => {
  const normalizedLocation = normalizeLocationText(value)
  if (!normalizedLocation) return false

  return INDIA_LOCATION_KEYS.some((key) => {
    const pattern = new RegExp(`(^|[^a-z])${key.replace(/\s+/g, '\\s+')}([^a-z]|$)`, 'i')
    return pattern.test(normalizedLocation)
  })
}

const getPrimaryCity = (value) => {
  const segments = splitLocationSegments(value)
  const indiaSegment = segments.find((segment) => isIndiaListing(segment))
  return canonicalizeLocationSegment(indiaSegment || normalizeWhitespace(value))
}

const formatLocation = (value) => {
  const segments = splitLocationSegments(value)
  const normalized = segments.length > 0
    ? segments.map((segment) => canonicalizeLocationSegment(segment)).filter(Boolean).join(', ')
    : canonicalizeLocationSegment(value)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

export const buildSearchRequestPayload = (page = 0) => ({
  page,
  search: '*:*',
  campaignSeq: '',
  token: TOKEN,
  source: SOURCE,
  pagesize: DEFAULT_PAGE_SIZE,
})

export const buildDetailUrl = (jobSeq) =>
  `${BASE_URL}/candidate/?token=${TOKEN}&source=${SOURCE}#detail/job/${jobSeq}`

export const buildApplyUrl = (jobSeq) =>
  `${BASE_URL}/candidate/?token=${TOKEN}&source=${SOURCE}#apply/job/${jobSeq}`

export const extractSearchSummary = (xml) => ({
  startJobIndex: extractFirst(/<startJobIndex>(\d+)<\/startJobIndex>/i, xml, (match) => Number.parseInt(match[1], 10)),
  pageSize: extractFirst(/<maxJobSize>(\d+)<\/maxJobSize>/i, xml, (match) => Number.parseInt(match[1], 10)),
  totalJobCount: extractFirst(/<totalJobCount>(\d+)<\/totalJobCount>/i, xml, (match) => Number.parseInt(match[1], 10)),
})

export const normalizeEmploymentType = (value, title = '') => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''

  if (normalized) {
    if (/intern|internship|apprentice/.test(normalized)) return 'Internship'
    if (/fixed term|temporary|contract/.test(normalized)) return 'Contract'
    if (/full[\s-]*time|regular|permanent/.test(normalized)) return 'Full-time'
  }

  if (/intern|internship|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchResults = (xml) => extractJobBlocks(xml)
  .map((block) => {
    const jobSeq = normalizeWhitespace(extractTagValue('jobSeq', block))
    const title = normalizeWhitespace(extractTagValue('jobTitle', block))
    const rawLocation = normalizeWhitespace(extractTagValue('locations', block))
    const requisitionId = normalizeWhitespace(extractTagValue('jobId', block))
    const experienceRequired = normalizeWhitespace(extractTagValue('jobReqExp', block))
    const postingDate = normalizeWhitespace(extractTagValue('jobPostingDate', block))

    if (!jobSeq || !title || !rawLocation) return null
    if (!isIndiaListing(rawLocation)) return null

    const city = getPrimaryCity(rawLocation)
    const location = formatLocation(rawLocation)

    return {
      title,
      location,
      city,
      jobId: jobSeq,
      requisitionId: requisitionId || jobSeq,
      sourceUrl: buildDetailUrl(jobSeq),
      applyUrl: buildApplyUrl(jobSeq),
      experienceRequired,
      postingDate,
      department: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (xml, listing = {}) => {
  const jobBlock = extractFirst(/<jobVO>([\s\S]*?)<\/jobVO>/i, xml)
  const title = normalizeWhitespace(extractTagValue('jobTitle', jobBlock)) || listing.title || null
  const jobSeq = normalizeWhitespace(extractTagValue('jobSeq', jobBlock)) || listing.jobId || null
  const requisitionId = normalizeWhitespace(extractTagValue('jobId', jobBlock)) || listing.requisitionId || jobSeq
  const rawLocation = normalizeWhitespace(extractTagValue('locations', jobBlock))
    || normalizeWhitespace(extractTagValue('jobLocation', jobBlock))
    || listing.city
    || null
  const city = getPrimaryCity(rawLocation)
  const department = normalizeWhitespace(extractTagValue('bussinessUnit', jobBlock)) || listing.department || null
  const experienceRequired = normalizeWhitespace(extractTagValue('jobReqExp', jobBlock)) || listing.experienceRequired || null
  const employmentType = normalizeEmploymentType(
    extractTagValue('jobTypeCustom3', jobBlock) || extractTagValue('jobType', jobBlock),
    title,
  )
  const descriptionHtml = extractTagValue('jobDesc', jobBlock)
  const postingDate = normalizeWhitespace(extractTagValue('jobPostingDate', jobBlock))
    || listing.postingDate
    || null
  const normalizedLocation = listing.location
    || (rawLocation && isIndiaListing(rawLocation) ? formatLocation(rawLocation) : normalizeWhitespace(rawLocation))

  return {
    title,
    location: normalizedLocation,
    city,
    jobId: jobSeq,
    requisitionId,
    employmentType,
    experienceRequired,
    department,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate,
    closingDate: null,
    applyUrl: listing.applyUrl || (jobSeq ? buildApplyUrl(jobSeq) : null),
    sourceUrl: listing.sourceUrl || (jobSeq ? buildDetailUrl(jobSeq) : null),
  }
}

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/xml,text/xml,text/html;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const run = async () => {
  const jobs = []
  const seenJobIds = new Set()
  const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY

  for (let page = 0; page < maxPages; page += 1) {
    const payload = buildSearchRequestPayload(page)
    const body = new URLSearchParams({
      careerSiteUrlParams: JSON.stringify(payload),
      lang: 'en',
    })
    const listingXml = await fetchText(`${BASE_URL}${SEARCH_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body,
    })
    const listings = extractSearchResults(listingXml)
    const summary = extractSearchSummary(listingXml)

    for (const listing of listings) {
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailParams = new URLSearchParams({
        token: TOKEN,
        jobSeq: listing.jobId,
        source: SOURCE,
        lang: 'en',
      })
      const detailXml = await fetchText(`${BASE_URL}${DETAIL_PATH}?${detailParams.toString()}`)
      const detail = extractJobDetail(detailXml, listing)

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: 'Tata Technologies',
        department: detail.department || listing.department,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        link: detail.applyUrl || listing.applyUrl,
        applyUrl: detail.applyUrl || listing.applyUrl,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: 'tatatechnologies',
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
    if (nextStartIndex >= totalJobCount) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tata Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'tatatechnologies')
    console.log('DB result:', result)
    process.exit(0)
  }
}
