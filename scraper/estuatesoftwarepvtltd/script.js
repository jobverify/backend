import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'estuatesoftwarepvtltd'
export const COMPANY = 'Estuate Software Pvt Ltd'
export const HOMEPAGE_URL = 'https://www.estuate.com/'
export const CAREERS_URL = 'https://www.estuate.com/company/careers'
export const CAREERS_API_URL = 'https://www.estuate.com/wp-json/wp/v2/awsm_job_openings'
export const PAGE_SIZE = 100

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KNOWN_INDIA_LOCATION_SLUGS = new Set([
  'anywhere-in-india',
  'bangalore',
  'bengaluru',
  'chennai',
  'coimbatore',
  'delhi',
  'gurgaon',
  'gurugram',
  'hyderabad',
  'mumbai',
  'noida',
  'pune',
])

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const titleCase = (value) => normalizeWhitespace(value)
  ?.split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ') || null

const slugToLabel = (slug) => titleCase(String(slug ?? '').replace(/-/g, ' '))

const getClassSlug = (classList, prefix) => {
  const match = (Array.isArray(classList) ? classList : [])
    .find((className) => String(className).startsWith(prefix))

  return match ? String(match).slice(prefix.length) : null
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const isVerifiedListingRecord = (record) =>
  record
  && typeof record === 'object'
  && Array.isArray(record.class_list)
  && record.class_list.includes('type-awsm_job_openings')
  && record.title?.rendered
  && record.link

const assertVerifiedFeed = (records) => {
  if (!Array.isArray(records)) {
    throw new Error('Estuate feed no longer matches the verified WP Job Openings feed')
  }

  if (records.some((record) => !isVerifiedListingRecord(record))) {
    throw new Error('Estuate feed no longer matches the verified WP Job Openings feed')
  }

  return records
}

const toLocationData = (locationSlug) => {
  if (!locationSlug) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  if (locationSlug === 'anywhere-in-india') {
    return {
      location: 'Anywhere in India',
      city: null,
      country: 'India',
    }
  }

  const city = slugToLabel(locationSlug)
  return {
    location: city ? `${city}, India` : null,
    city,
    country: city ? 'India' : null,
  }
}

const isIndiaLocationSlug = (locationSlug) => {
  if (!locationSlug) return false
  return KNOWN_INDIA_LOCATION_SLUGS.has(locationSlug)
}

const toExperienceLabel = (experienceSlug) => {
  const normalized = String(experienceSlug ?? '').trim().toLowerCase()
  const yearsMatch = normalized.match(/^(\d+)-years?$/)
  if (yearsMatch) return `${yearsMatch[1]}+ Years`
  return slugToLabel(normalized)
}

const toEmploymentTypeLabel = (employmentTypeSlug) => slugToLabel(employmentTypeSlug)

const toRemoteStatus = (workModuleSlug, locationSlug) => {
  const normalized = String(workModuleSlug ?? '').toLowerCase()
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  if (locationSlug === 'anywhere-in-india') return 'Remote'
  return 'On-site'
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /Estuate Re\(AI\)magined Technology Services/i.test(page)
    && (/"name"\s*:\s*"Estuate,\s*Inc\."|Estuate,\s*Inc\./i.test(page))
    && /https:\/\/www\.estuate\.com\/company\/careers/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Careers\s*&amp;\s*Job Opportunities at Estuate/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.estuate\.com\/company\/careers"/i.test(page)
    && /Current Openings/i.test(page)
    && /class="awsm-job-listings awsm-lists"/i.test(page)
    && /value="jobfilter"/i.test(page)
}

export const buildSearchUrl = (page = 1, pageSize = PAGE_SIZE) => {
  const url = new URL(CAREERS_API_URL)
  url.searchParams.set('_fields', 'id,link,title,content,class_list')
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractSearchResults = (records) => assertVerifiedFeed(records)
  .map((record) => {
    const classList = Array.isArray(record?.class_list) ? record.class_list : []
    const locationSlug = getClassSlug(classList, 'job-location-')
    if (!isIndiaLocationSlug(locationSlug)) return null

    const employmentTypeSlug = getClassSlug(classList, 'job-type-')
    const experienceSlug = getClassSlug(classList, 'relevant-experience-')
    const workModuleSlug = getClassSlug(classList, 'work-module-')
    const locationData = toLocationData(locationSlug)
    const title = normalizeWhitespace(record?.title?.rendered)
    const jobId = record?.id == null ? null : String(record.id)
    const sourceUrl = normalizeWhitespace(record?.link)
    const requiredSkills = extractListItems(record?.content?.rendered)

    if (!title || !jobId || !sourceUrl || !locationData.location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: toEmploymentTypeLabel(employmentTypeSlug),
      experienceRequired: toExperienceLabel(experienceSlug),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: stripTags(record?.content?.rendered),
      remoteStatus: toRemoteStatus(workModuleSlug, locationSlug),
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 30000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 30000,
})

export const createEstuateSoftwarePvtLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = PAGE_SIZE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Estuate homepage no longer matches the verified official homepage surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Estuate careers page no longer matches the verified official careers surface')
    }

    const jobs = []

    for (let page = 1; ; page += 1) {
      const pageRecords = assertVerifiedFeed(await fetchJson(buildSearchUrl(page, pageSize)))
      const pageJobs = extractSearchResults(pageRecords)

      jobs.push(...pageJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })))

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs.slice(0, maxJobs)
      }

      if (pageRecords.length < pageSize) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createEstuateSoftwarePvtLtdScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Estuate Software Pvt Ltd jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
