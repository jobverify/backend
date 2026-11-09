import path from 'path'
import { fileURLToPath } from 'url'

import { createRipplehireInventoryScraper } from '../altimetrik/ripplehireInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://altimetrik.ripplehire.com'
const TOKEN = 'SWCslMw2ct8eSm7LyqVb'
const SOURCE = 'CAREERSITE'
const SEARCH_PATH = '/candidate/candidatejobsearch'
const DETAIL_PATH = '/candidate/candidatejobdetail'
const DEFAULT_PAGE_SIZE = 10
const FOREIGN_LOCATION_PATTERN = /\b(singapore|united states|usa|uk|united kingdom|canada|germany|australia|new zealand|uae|dubai|abu dhabi|saudi|qatar|oman|kuwait)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

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
    .replace(/<(?!\/?[a-z][\w-]*\b)/gi, ' ')
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

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase()) || null

const normalizeCity = (value) => toTitleCase(value)

const extractFallbackSkills = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean) || []

export const isIndiaListing = ({ countryCode, city }) => {
  const normalizedCountry = normalizeWhitespace(countryCode)?.toLowerCase() || ''
  const normalizedCity = normalizeWhitespace(city)?.toLowerCase() || ''

  if (!normalizedCountry && !normalizedCity) return false
  if (normalizedCountry === 'ind' || normalizedCountry === 'india') return true

  return !FOREIGN_LOCATION_PATTERN.test([normalizedCountry, normalizedCity].filter(Boolean).join(' '))
}

const buildLocation = (city) => {
  const normalizedCity = normalizeCity(city)
  return normalizedCity ? `${normalizedCity}, India` : 'India'
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
    if (/hybrid|remote|on[\s-]*site|onsite|regular|permanent|full[\s-]*time|^r$/.test(normalized)) {
      return 'Full-time'
    }
  }

  if (/intern|internship|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchResults = (xml) => extractJobBlocks(xml)
  .map((block) => {
    const jobSeq = normalizeWhitespace(extractTagValue('jobSeq', block))
    const title = normalizeWhitespace(extractTagValue('jobTitle', block))
    const countryCode = normalizeWhitespace(extractTagValue('jobLocation', block))
    const city = normalizeCity(extractTagValue('locations', block))
    const requisitionId = normalizeWhitespace(extractTagValue('jobId', block))
    const experienceRequired = normalizeWhitespace(extractTagValue('jobReqExp', block))
    const postingDate = normalizeWhitespace(extractTagValue('jobPostingDate', block))

    if (!jobSeq || !title) return null
    if (!isIndiaListing({ countryCode, city })) return null

    return {
      title,
      location: buildLocation(city),
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
  const city = normalizeCity(extractTagValue('locations', jobBlock)) || listing.city || null
  const department = normalizeWhitespace(extractTagValue('bussinessUnit', jobBlock)) || listing.department || null
  const experienceRequired = normalizeWhitespace(extractTagValue('jobReqExp', jobBlock)) || listing.experienceRequired || null
  const employmentType = normalizeEmploymentType(
    extractTagValue('jobTypeCustom3', jobBlock) || extractTagValue('jobType', jobBlock),
    title,
  )
  const descriptionHtml = extractTagValue('jobDesc', jobBlock)
  const postingDate = normalizeWhitespace(extractFirst(
    /<publishDetails>[\s\S]*?<CAREER_SITE>([\s\S]*?)<\/CAREER_SITE>/i,
    jobBlock,
  ))
    || normalizeWhitespace(extractTagValue('jobPostingDate', jobBlock))
    || listing.postingDate
    || null
  const requiredSkills = extractFallbackSkills(extractTagValue('jobSkills', jobBlock))

  return {
    title,
    location: listing.location || buildLocation(city),
    city,
    jobId: jobSeq,
    requisitionId,
    employmentType,
    experienceRequired,
    department,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate,
    closingDate: null,
    applyUrl: listing.applyUrl || (jobSeq ? buildApplyUrl(jobSeq) : null),
    sourceUrl: listing.sourceUrl || (jobSeq ? buildDetailUrl(jobSeq) : null),
  }
}

export const createAltimetrikScraper = ({ fetchText } = {}) => ({
  run: (options = {}) => createRipplehireInventoryScraper({
    source: 'altimetrik', company: 'Altimetrik', origin: BASE_URL, token: TOKEN, parentCompanyId: 264,
    normalizeEmploymentType,
  }).run({ ...(fetchText === undefined ? {} : { fetchText }), ...options }),
})

export const run = async (options = {}) => createAltimetrikScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Altimetrik scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'altimetrik')
    console.log('DB result:', result)
    process.exit(0)
  }
}
