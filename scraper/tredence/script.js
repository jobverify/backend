import path from 'path'
import { fileURLToPath } from 'url'

import { createRipplehireInventoryScraper } from '../altimetrik/ripplehireInventory.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const BASE_URL = 'https://tredence.ripplehire.com'
const TOKEN = 'rzuz0vttMaz0VxxVzDiY'
const SOURCE = 'CAREERSITE'
const SEARCH_PATH = '/candidate/candidatejobsearch'
const DETAIL_PATH = '/candidate/candidatejobdetail'
const DEFAULT_PAGE_SIZE = 10
const INDIA_CITY_SET = new Set([
  'bangalore',
  'bengaluru',
  'chennai',
  'delhi',
  'gurgaon',
  'gurugram',
  'hyderabad',
  'kolkata',
  'mumbai',
  'new delhi',
  'noida',
  'pune',
])
const FOREIGN_LOCATION_PATTERN = /\b(canada|toronto|san jose|united states|usa|bentonville|uk|united kingdom|london|singapore|australia|germany|uae|dubai)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#xd;|&#13;/gi, '\n')
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

const repairBrokenMarkup = (value) => decodeHtmlEntities(value)
  .replace(/\r\n?/g, '\n')
  .replace(/<(?=\s*(?:\r?\n|$))/g, '\n')

const stripTags = (value) => normalizeWhitespace(
  repairBrokenMarkup(value)
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
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

const buildLocation = (city) => {
  const normalizedCity = normalizeCity(city)
  return normalizedCity ? `${normalizedCity}, India` : 'India'
}

const extractNumberedSkills = (descriptionHtml) => {
  const text = repairBrokenMarkup(descriptionHtml)
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

  return [...new Set(
    text
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)
      .map((line) => line.match(/^\d+\.\s*(.+)$/)?.[1] || null)
      .filter(Boolean)
      .filter((skill) => !/^(roles and responsibilities|key competencies|job role:|experience:)/i.test(skill)),
  )]
}

export const isIndiaListing = ({ countryCode, city }) => {
  const normalizedCountry = normalizeWhitespace(countryCode)?.toLowerCase() || ''
  const normalizedCity = normalizeWhitespace(city)?.toLowerCase() || ''
  if (!normalizedCountry && !normalizedCity) return false

  const haystack = [normalizedCountry, normalizedCity].filter(Boolean).join(' ')
  if (FOREIGN_LOCATION_PATTERN.test(haystack)) return false
  if (normalizedCountry === 'india' || normalizedCountry === 'ind' || normalizedCity === 'india') {
    return true
  }

  return INDIA_CITY_SET.has(normalizedCountry) || INDIA_CITY_SET.has(normalizedCity)
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
    const countryCode = normalizeWhitespace(extractTagValue('jobLocation', block))
    const city = normalizeCity(extractTagValue('locations', block))
    const requisitionId = normalizeWhitespace(extractTagValue('jobId', block))
    const experienceRequired = normalizeWhitespace(extractTagValue('jobReqExp', block))
    const postingDate = normalizeWhitespace(extractTagValue('jobPostingDate', block))

    if (!jobSeq || !title || !city) return null
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
    requiredSkills: extractNumberedSkills(descriptionHtml),
    postingDate,
    closingDate: null,
    applyUrl: listing.applyUrl || (jobSeq ? buildApplyUrl(jobSeq) : null),
    sourceUrl: listing.sourceUrl || (jobSeq ? buildDetailUrl(jobSeq) : null),
  }
}

// These are explicit workplace fields in the role's own current description.
// The board's numeric country IDs and company/phone defaults are not a country map.
const countryWords = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const foreignCountryLabels = (() => {
  const names = new Set(['United States of America', 'USA', 'U.S.A.', 'U.S.', 'US', 'UK', 'UAE', 'Great Britain'])
  const regions = new Intl.DisplayNames(['en'], { type: 'region' })
  for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
    const code = String.fromCharCode(first, second), name = regions.of(code)
    if (code !== 'IN' && name && name !== code) names.add(name)
  }
  return [...names].map(name => ` ${countryWords(name)} `)
})()
const countryFromOwnRoleLocation = ({ listing, nativeDetail }) => {
  const html = nativeDetail.jobVO.jobDesc
  if (typeof html !== 'string') return null
  const title = normalizeWhitespace(nativeDetail.jobVO.jobTitle)
  let locations, method
  if (!/<[a-z!/?]/i.test(html)) {
    const header = html.split(/\r?\n\s*\r?\n/)[0].split(/\r?\n/).map(normalizeWhitespace)
    if (header[0] !== `Job Title: ${title}`) return null
    const field = line => /^Location\s*:\s*(.*)$/i.exec(line)
    if (!header.some(field)) return null
    locations = html.split(/\r?\n/).map(normalizeWhitespace).map(field).filter(Boolean).map(match => match[1])
    method = 'header'
  } else {
    const document = readNativeDocument(html)
    const root = document.nodes(node => node.tag === 'root')[0]
    const blocks = root.children.filter(node => typeof node !== 'string' && !node.inert)
    if (blocks[0]?.tag !== 'p' || normalizeWhitespace(document.text(blocks[0])) !== title || blocks[1]?.tag !== 'table'
      || root.children.some(node => typeof node === 'string' && node.trim())) return null
    const pair = row => row.children.filter(node => typeof node !== 'string' && !node.inert && ['td', 'th'].includes(node.tag)).map(document.text)
    const headerRows = document.nodes(node => node.tag === 'tr', blocks[1]).map(pair)
    if (headerRows.length !== 4 || headerRows.some(row => row.length !== 2)
      || headerRows.map(row => row[0]).join('|') !== 'Function|Location|Reports To|Works Closely With') return null
    locations = document.nodes(node => node.tag === 'tr').map(pair).filter(row => /^Location\s*:?$/i.test(row[0])).map(row => row.length === 2 ? row[1] : null)
    method = 'table'
  }
  const explicitIndia = value => /^[^,;|\r\n]{1,120},\s*India(?:\s*\((?:Hybrid|Remote|On[- ]site)\))?$/i.test(value)
  if (!locations.some(explicitIndia)) return null
  if (locations.length !== 1) throw new Error('Tredence contradictory or ambiguous native role Location headers')
  for (const value of [...locations, listing.jobLocation, listing.locations, nativeDetail.jobVO.jobLocation, nativeDetail.jobVO.locations]) {
    if (value == null) continue
    if (typeof value !== 'string') throw new Error('Tredence ambiguous native workplace field schema')
    const words = ` ${countryWords(value)} `
    if (foreignCountryLabels.some(country => words.includes(country))) throw new Error('Tredence contradictory native workplace country')
  }
  return { country: 'India', evidence: `native-own-role-location-${method}:${locations[0]}` }
}

export const createTredenceScraper = ({ fetchText } = {}) => ({
  run: (options = {}) => createRipplehireInventoryScraper({
    source: 'tredence', company: 'Tredence', origin: BASE_URL, token: TOKEN, parentCompanyId: 191,
    normalizeEmploymentType, extractSkills: extractNumberedSkills,
    countryResolver: countryFromOwnRoleLocation,
  }).run({ ...(fetchText === undefined ? {} : { fetchText }), ...options }),
})

export const run = async (options = {}) => createTredenceScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tredence scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'tredence')
    console.log('DB result:', result)
    process.exit(0)
  }
}
