import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'acronisindia'
export const COMPANY = 'Acronis India'
export const OFFICIAL_BRAND_NAME = 'Acronis'
export const VERIFIED_AT = '2026-07-14'
export const CAREERS_URL = 'https://www.acronis.com/en/careers/'
export const JOBS_URL = 'https://www.acronis.com/en/careers/jobs/'
export const WORKDAY_DETAIL_BASE_URL = 'https://acronis.wd502.myworkdayjobs.com/acronis_careers/'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: OFFICIAL_BRAND_NAME,
  adapter: 'script',
  modulePath: '../../scraper/acronisindia.workday/script.js',
  companyCareerPage: CAREERS_URL,
  officialCareersHandoffUrl: JOBS_URL,
  workdayDetailBaseUrl: WORKDAY_DETAIL_BASE_URL,
  atsPlatform: 'workday',
  countryFilter: 'India',
  paginationStrategy: 'verified-first-party-careers-page-plus-first-party-jobs-page-embedded-workday-items',
  extractionStrategy:
    'verified-official-careers-page+verified-first-party-jobs-page+embedded-workday-items',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'acronis.com',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified https://www.acronis.com/en/careers/ and https://www.acronis.com/en/careers/jobs/ on July 14, 2026. The official Acronis careers landing links to the first-party jobs page, and that jobs page exposes public embedded Workday job records with detail URLs on https://acronis.wd502.myworkdayjobs.com/acronis_careers/, including an India - Remote opening.',
  dryRunFile: 'acronisindia.workday/jobs.json',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n+/g, '\n')
  .trim()

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    const normalized = normalizeWhitespace(match?.[1])
    if (normalized) return normalized
  }

  return null
}

const findMatchingBracket = (source, startIndex) => {
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '[') {
      depth += 1
      continue
    }

    if (char === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

const parseJsonArrayAt = (source, arrayStart) => {
  if (arrayStart < 0) return []

  const arrayEnd = findMatchingBracket(source, arrayStart)
  if (arrayEnd < 0) return []

  try {
    const parsed = JSON.parse(source.slice(arrayStart, arrayEnd + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const getLocationCandidates = (item = {}) => [
  item.primaryLocation,
  ...(Array.isArray(item.additionalLocations) ? item.additionalLocations : []),
].filter(Boolean)

const isIndiaLocation = (location = {}) =>
  location?.country?.alpha3Code === 'IND'
  || /\bIndia\b/i.test(String(location?.descriptor ?? ''))

const extractIndiaLocation = (item = {}) => {
  const indiaLocation = getLocationCandidates(item).find(isIndiaLocation)
  return indiaLocation?.descriptor ? normalizeWhitespace(indiaLocation.descriptor) : null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^\s*India\s*-\s*Remote\s*$/i.test(normalized)) return 'Remote'
  if (/,\s*/.test(normalized)) return normalized.split(',')[0].trim() || null
  if (/^\s*India\s*-\s*(.+)$/i.test(normalized)) return normalizeWhitespace(RegExp.$1) || null
  return /remote/i.test(normalized) ? 'Remote' : normalized
}

const extractRequiredSkills = (descriptionHtml) => {
  const skills = []

  for (const match of String(descriptionHtml ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const skill = normalizeWhitespace(match[1])
    if (skill) skills.push(skill)
  }

  return skills
}

const extractExperienceRequired = (description) => {
  const normalized = normalizeWhitespace(description)
  const match = normalized.match(/\b\d+\s*(?:-\s*\d+|\+)?\s*years?\b/i)
  return match ? match[0].replace(/\s+/g, ' ') : null
}

const buildApplyUrl = (detailUrl) => {
  const normalized = String(detailUrl ?? '').trim().replace(/\/$/, '')
  if (!normalized) return null
  return normalized.endsWith('/apply') ? normalized : `${normalized}/apply`
}

const extractDepartment = (item = {}) =>
  firstMatch(item.categories?.map((category) => category?.descriptor).filter(Boolean).join('\n'), [
    /([\s\S]+)/,
  ])

const toJob = (item = {}) => {
  const sourceUrl = firstMatch(item.url, [
    /(https:\/\/acronis\.wd502\.myworkdayjobs\.com\/acronis_careers\/job\/[^\s"]+)/i,
  ])
  const location = extractIndiaLocation(item)
  if (!sourceUrl || !location) return null

  const jobDescription = normalizeWhitespace(item.jobDescription)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title: normalizeWhitespace(item.title),
    company: COMPANY,
    department: extractDepartment(item),
    location,
    city: extractCity(location),
    country: 'India',
    sourceUrl,
    applyUrl: buildApplyUrl(sourceUrl),
    jobId: normalizeWhitespace(item.originalId),
    requisitionId: normalizeWhitespace(item.originalId),
    employmentType: normalizeWhitespace(item.timeType?.descriptor) || null,
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(item.jobDescription),
    postingDate: normalizeWhitespace(item.startDate) || null,
    closingDate: null,
    jobDescription,
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers at Acronis\s*<\/title>/i.test(page)
    && /Careers at Acronis/i.test(normalized)
    && /Explore open jobs worldwide/i.test(normalized)
    && /href=["'][^"']*\/en\/careers\/jobs\/["']/i.test(page)
}

export const extractEmbeddedWorkdayItems = (html) => {
  const source = String(html ?? '')
  const marker = '"workday":{"items":['
  const candidates = []
  let searchIndex = 0

  while (searchIndex < source.length) {
    const markerIndex = source.indexOf(marker, searchIndex)
    if (markerIndex < 0) break

    const arrayStart = source.indexOf('[', markerIndex)
    const items = parseJsonArrayAt(source, arrayStart)
    if (items.length > 0) candidates.push(items)
    searchIndex = markerIndex + marker.length
  }

  if (candidates.length === 0) return []
  return candidates.sort((left, right) => right.length - left.length)[0]
}

const hasEmbeddedWorkdayItemsPayload = (html) =>
  /"workday"\s*:\s*\{\s*"items"\s*:\s*\[/i.test(String(html ?? ''))

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const items = extractEmbeddedWorkdayItems(page)
  const hasExplicitEmptyItemsState = hasEmbeddedWorkdayItemsPayload(page) && items.length === 0

  return /<title>\s*Explore Jobs\b[\s\S]*Careers at Acronis\s*<\/title>/i.test(page)
    && /HEAD_SITE_MAIN_PUBLIC_BASE_URL_WORKDAY/i.test(page)
    && /JobPosting/i.test(page)
    && /Explore Jobs/i.test(normalized)
    && (
      /acronis\.wd502\.myworkdayjobs\.com\/acronis_careers\/job\//i.test(page)
      || hasExplicitEmptyItemsState
    )
    && (items.length > 0 || hasExplicitEmptyItemsState)
}

export const extractIndiaJobsFromWorkdayItems = (items = []) =>
  items
    .filter((item) => extractIndiaLocation(item))
    .map((item) => toJob(item))
    .filter(Boolean)

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

export const createAcronisIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Acronis India verified careers landing no longer matches the trusted first-party surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    if (jobsPage.status !== 200 || !hasOfficialJobsPageSignal(jobsPage.html)) {
      throw new Error('Acronis India verified first-party jobs page no longer matches the trusted public Workday surface')
    }

    return extractIndiaJobsFromWorkdayItems(extractEmbeddedWorkdayItems(jobsPage.html)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAcronisIndiaScraper(options).run()

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

