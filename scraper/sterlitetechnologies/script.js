import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STERLITE_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = STERLITE_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LINKED_JOBS_PORTAL_URL = PROVIDER_METADATA.linkedJobsPortalUrl
export const LINKED_JOBS_PORTAL_HOST = PROVIDER_METADATA.linkedJobsPortalHost
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const JOB_BOARD_URL = PROVIDER_METADATA.jobBoardUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

export const TOKEN = 'v0cOTxD3fgZqIF393gqj'
export const PORTAL_SOURCE = 'CAREERSITE'
export const SEARCH_PATH = '/candidate/candidatejobsearch'
export const DETAIL_PATH = '/candidate/candidatejobdetail'
export const DEFAULT_PAGE_SIZE = 10

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FOREIGN_LOCATION_PATTERN =
  /\b(chicago|germany|france|italy|london|singapore|uk|united kingdom|usa|united states|canada|toronto|dubai|uae)\b/i

const INDIA_LOCATION_TOKENS = [
  'ahmedabad',
  'bangalore',
  'bengaluru',
  'bhubaneswar',
  'chennai',
  'cochin',
  'dadra',
  'delhi',
  'gurgaon',
  'gurugram',
  'hyderabad',
  'jharsuguda',
  'kharadi',
  'kochi',
  'kolkata',
  'koregaon park',
  'mumbai',
  'nellore',
  'new delhi',
  'nizamabad',
  'noida',
  'ofc rakholi',
  'pune',
  'rakholi',
  'shendra',
  'silvassa',
  'tuticorin',
  'udaipur',
  'waluj',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#xd;|&#13;/gi, '\n')
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

const normalizeLocationValue = (value) => normalizeWhitespace(value)
  ?.replace(/_/g, ' ')
  .replace(/\s*\|\s*/g, ', ')
  .replace(/\s*,\s*/g, ', ')
  .replace(/\s{2,}/g, ' ')
  .trim() || null

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

const extractJobBlocks = (xml) => [...String(xml ?? '').matchAll(/<jobVoList>\s*<jobSeq>[\s\S]*?<\/jobVoList>/gi)]
  .map((match) => match[0])

const extractListItems = (value) => [...repairBrokenMarkup(value).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

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

  return text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .map((line) => line.match(/^\d+\.\s*(.+)$/)?.[1] || null)
    .filter(Boolean)
    .filter((skill) => !/^(job title:|location:|experience:|who we are|required qualifications)$/i.test(skill))
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const extractRequiredSkills = (descriptionHtml) => unique([
  ...extractListItems(descriptionHtml),
  ...extractNumberedSkills(descriptionHtml),
])

const extractAbsoluteUrls = (html = '') => unique(
  [...decodeHtmlEntities(html).matchAll(/https?:\/\/[^'"<>\s)]+/gi)].map((match) => match[0]),
)

const isExpectedLinkedJobsPortalUrl = (url) => {
  try {
    const parsed = new URL(url)
    return parsed.origin === PORTAL_ORIGIN
      && /^\/candidate\/?$/.test(parsed.pathname)
      && parsed.searchParams.get('token') === TOKEN
      && parsed.searchParams.get('source') === PORTAL_SOURCE
  } catch {
    return false
  }
}

export const hasEnumerablePublicJobsSignal = (html = '') => [
  /"@type"\s*:\s*"JobPosting"/i,
  /\blatest job openings\b/i,
  /\bjob openings\b/i,
  /\bcandidatejobsearch\b/i,
  /\bgoogleJobPosting\b/i,
].some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Join STL Tech \| Life at STL Tech \| Careers\s*<\/title>/i.test(page)
    && normalized.includes('WORLD OF OPPORTUNITIES')
    && normalized.includes('Join us')
    && normalized.includes('Apply for your next job here')
    && extractAbsoluteUrls(page).some(isExpectedLinkedJobsPortalUrl)
    && /\bSTL Tech\b/i.test(normalized)
    && /\ball rights reserved\b/i.test(normalized)
}

export const hasLinkedJobsPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*STL and STL Digital Careers\s*\|\s*Latest jobs at STL and STL Digital - Ripplehire\.com\s*<\/title>/i.test(page)
    && /id=["']token["'][^>]+value=["']v0cOTxD3fgZqIF393gqj["']/i.test(page)
    && /id=["']source["'][^>]+value=["']CAREERSITE["']/i.test(page)
    && hasEnumerablePublicJobsSignal(page)
}

export const hasRippleHireSearchResultsSignal = (xml = '') =>
  /<JobPageVO>/i.test(String(xml ?? '')) && /<totalJobCount>\d+<\/totalJobCount>/i.test(String(xml ?? ''))

const isConnectTimeoutError = (error) => {
  const haystacks = []
  let current = error
  const visited = new Set()

  while (current && !visited.has(current)) {
    visited.add(current)
    if (typeof current?.code === 'string') {
      haystacks.push(current.code)
    }
    if (typeof current?.message === 'string') {
      haystacks.push(current.message)
    }
    current = current?.cause
  }

  return haystacks.some((value) => /UND_ERR_CONNECT_TIMEOUT|connect timeout error|timed out/i.test(value))
}

export const isIndiaListing = ({ jobCode, jobLocation, locations }) => {
  const normalizedJobCode = normalizeWhitespace(jobCode)?.toLowerCase() || ''
  const normalizedJobLocation = normalizeLocationValue(jobLocation)?.toLowerCase() || ''
  const normalizedLocations = normalizeLocationValue(locations)?.toLowerCase() || ''
  const haystack = [normalizedJobCode, normalizedJobLocation, normalizedLocations].filter(Boolean).join(' ')

  if (!haystack) return false
  if (FOREIGN_LOCATION_PATTERN.test(haystack)) return false
  if (normalizedJobCode.startsWith('ind/')) return true
  if (/\bindia\b/.test(haystack)) return true
  return INDIA_LOCATION_TOKENS.some((token) => haystack.includes(token))
}

const buildLocation = (value) => {
  const normalizedLocation = normalizeLocationValue(value)
  return normalizedLocation ? `${normalizedLocation}, India` : 'India'
}

export const buildSearchRequestPayload = (page = 0) => ({
  page,
  search: '*:*',
  token: TOKEN,
  source: PORTAL_SOURCE,
  pagesize: DEFAULT_PAGE_SIZE,
})

export const buildDetailUrl = (jobSeq) =>
  `${JOB_BOARD_URL}#detail/job/${jobSeq}`

export const buildApplyUrl = (jobSeq) =>
  `${JOB_BOARD_URL}#apply/job/${jobSeq}`

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
    if (/contract|temporary|fixed term/.test(normalized)) return 'Contract'
    if (/full[\s-]*time|permanent|probationer|regular/.test(normalized)) return 'Full-time'
  }

  if (/intern|internship|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchResults = (xml) => extractJobBlocks(xml)
  .map((block) => {
    const jobSeq = normalizeWhitespace(extractTagValue('jobSeq', block))
    const title = normalizeWhitespace(extractTagValue('jobTitle', block))
    const jobCode = normalizeWhitespace(extractTagValue('jobCode', block))
    const jobLocation = normalizeLocationValue(extractTagValue('jobLocation', block))
    const locations = normalizeLocationValue(extractTagValue('locations', block))
    const requisitionId = normalizeWhitespace(extractTagValue('jobId', block))
    const experienceRequired = normalizeWhitespace(extractTagValue('jobReqExp', block))
    const postingDate = normalizeWhitespace(extractTagValue('jobPostingDate', block))
    const city = locations || jobLocation

    if (!jobSeq || !title) return null
    if (!isIndiaListing({ jobCode, jobLocation, locations })) return null

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
      jobCode,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (xml, listing = {}) => {
  const jobBlock = extractFirst(/<jobVO>([\s\S]*?)<\/jobVO>/i, xml) || ''
  const title = normalizeWhitespace(extractTagValue('jobTitle', jobBlock)) || listing.title || null
  const jobSeq = normalizeWhitespace(extractTagValue('jobSeq', jobBlock)) || listing.jobId || null
  const requisitionId = normalizeWhitespace(extractTagValue('jobId', jobBlock)) || listing.requisitionId || jobSeq
  const jobLocation = normalizeLocationValue(extractTagValue('jobLocation', jobBlock))
  const locations = normalizeLocationValue(extractTagValue('locations', jobBlock))
  const city = locations || jobLocation || listing.city || null
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
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate,
    closingDate: null,
    applyUrl: listing.applyUrl || (jobSeq ? buildApplyUrl(jobSeq) : null),
    sourceUrl: listing.sourceUrl || (jobSeq ? buildDetailUrl(jobSeq) : null),
    publicExperienceChecked: true,
  }
}

const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
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

export const createSterliteTechnologiesScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ fetchText: overrideFetchText, maxPages: overrideMaxPages } = {}) {
    const fetchImpl = overrideFetchText || fetchText
    try {
      const careersHtml = await fetchImpl(CAREERS_URL)

      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Sterlite Technologies verified first-party careers page no longer matches the live RippleHire handoff surface')
      }
    } catch (error) {
      if (!isConnectTimeoutError(error)) {
        throw error
      }

      const linkedJobsPortalHtml = await fetchImpl(LINKED_JOBS_PORTAL_URL)
      if (!hasLinkedJobsPortalSignal(linkedJobsPortalHtml)) {
        throw new Error('Sterlite Technologies verified linked RippleHire board no longer matches the live public jobs surface')
      }
    }

    const jobs = []
    const seenJobIds = new Set()
    const maxPages = Number.isInteger(overrideMaxPages)
      ? overrideMaxPages
      : Number.POSITIVE_INFINITY

    for (let page = 0; page < maxPages; page += 1) {
      const body = new URLSearchParams({
        careerSiteUrlParams: JSON.stringify(buildSearchRequestPayload(page)),
        lang: 'en',
      })
      const listingXml = await fetchImpl(JOBS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body,
      })

      if (!hasRippleHireSearchResultsSignal(listingXml)) {
        throw new Error('Sterlite Technologies RippleHire listing API no longer returns the verified public XML surface')
      }

      const listings = extractSearchResults(listingXml)
      const summary = extractSearchSummary(listingXml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailParams = new URLSearchParams({
          token: TOKEN,
          source: PORTAL_SOURCE,
          lang: 'en',
          jobSeq: listing.jobId,
        })
        const detailXml = await fetchImpl(`${PORTAL_ORIGIN}${DETAIL_PATH}?${detailParams.toString()}`)
        const detail = extractJobDetail(detailXml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: COMPANY_NAME,
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
          publicExperienceChecked: detail.publicExperienceChecked,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        })
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || DEFAULT_PAGE_SIZE
      const nextStartIndex = (summary.startJobIndex ?? 0) + pageSize
      if (nextStartIndex >= totalJobCount || listings.length === 0) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createSterliteTechnologiesScraper().run(options)

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
