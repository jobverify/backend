import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { FAB_HOTELS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = FAB_HOTELS_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl
export const VERIFIED_ROLE_URLS = PROVIDER_METADATA.verifiedRoleUrls
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const DETAIL_URL_PATTERN = /^https:\/\/www\.fabhotels\.com\/careers\/(?!department-)[A-Z0-9-]+$/i

const STATE_BY_CITY = {
  ahmadabad: 'Gujarat',
  ahmedabad: 'Gujarat',
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
  chandigarh: 'Chandigarh',
  chennai: 'Tamil Nadu',
  delhi: 'Delhi',
  'delhi/ncr': 'Delhi',
  gurgaon: 'Haryana',
  gurugram: 'Haryana',
  hyderabad: 'Telangana',
  kerala: 'Kerala',
  kolkata: 'West Bengal',
  mumbai: 'Maharashtra',
  patna: 'Bihar',
  pune: 'Maharashtra',
}

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;|\u2013/gi, '-')
    .replace(/&#8212;|&mdash;|\u2014/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(String(value), baseUrl).toString()
  } catch {
    return null
  }
}

const stripHeadingSuffix = (value) =>
  normalizeWhitespace(value)?.replace(/:\s*$/, '') || null

const extractFieldValue = (html, label) => {
  const escaped = String(label ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}\\s*:\\s*([^<\\n]+)`, 'i')
  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1])
}

const extractRoleId = (sourceUrl) => {
  try {
    const url = new URL(String(sourceUrl ?? ''))
    const segments = url.pathname.split('/').filter(Boolean)
    return segments.at(-1) || null
  } catch {
    return null
  }
}

const extractLocationParts = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const baseLocation = /india$/i.test(normalized) ? normalized : `${normalized}, India`
  const firstToken = normalized.split(',').map((part) => part.trim()).filter(Boolean)[0] || null
  const city = firstToken ? normalizeCity(firstToken) : null
  const state = firstToken ? STATE_BY_CITY[firstToken.toLowerCase()] || null : null

  return {
    location: baseLocation,
    city,
    state,
    country: 'India',
  }
}

const extractSectionItems = (html) => {
  const sections = []
  const pattern = /<h[34][^>]*>\s*(.*?)\s*<\/h[34]>\s*<ul>([\s\S]*?)<\/ul>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const heading = stripHeadingSuffix(match[1])
    const items = [...match[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)

    if (!heading || items.length === 0) continue

    sections.push({
      heading,
      items,
    })
  }

  return sections
}

const buildJobDescription = (sections, applySentence) => {
  const parts = sections.map((section) => `${section.heading}: ${section.items.join(' ')}`)
  if (applySentence) parts.push(applySentence)
  return normalizeWhitespace(parts.join(' '))
}

const normalizeTitle = (value) => normalizeWhitespace(value)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*FabHotels:\s*India(?:'|&#x27;|&#39;|&apos;)s Best Budget Hotels\s*\|\s*Online Hotel Booking\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Book top-rated budget hotels in India.')
    && normalized.includes('FabHotels across')
    && normalized.includes('Travelstack Tech Limited')
}

export const extractRoleUrls = (html) => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href="([^"]+)"/gi)) {
    const sourceUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (!sourceUrl || !DETAIL_URL_PATTERN.test(sourceUrl) || seen.has(sourceUrl)) {
      continue
    }

    seen.add(sourceUrl)
    urls.push(sourceUrl)
  }

  return urls
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''
  const roleUrls = extractRoleUrls(rawHtml)

  return /<title>\s*Careers @ FabHotels - FabHotels\.com\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Technology')
    && normalized.includes('Sales')
    && normalized.includes('Revenue And Pricing')
    && normalized.includes('Design')
    && roleUrls.length === VERIFIED_ROLE_URLS.length
    && VERIFIED_ROLE_URLS.every((url, index) => roleUrls[index] === url)
}

export const hasOfficialRoleDetailSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Career Details @ FabHotels\.com - FabHotels\.com\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Apply to this Job')
    && normalized.includes('Department:')
    && normalized.includes('Location:')
    && normalized.includes('Relevant Experience:')
    && /jobs@fabhotels\.com/i.test(normalized)
}

export const extractJobDetail = (detailHtml, sourceUrl) => {
  if (!hasOfficialRoleDetailSignal(detailHtml)) {
    throw new Error('FabHotels verified role detail surface changed materially')
  }

  const title = normalizeTitle(
    String(detailHtml ?? '').match(/<h3[^>]*>\s*(.*?)\s*<\/h3>/i)?.[1],
  )
  const department = extractFieldValue(detailHtml, 'Department')
  const experienceRequired = extractFieldValue(detailHtml, 'Relevant Experience')
  const jobId = extractRoleId(sourceUrl)
  const applicationEmail = /jobs@fabhotels\.com/i.test(String(detailHtml ?? ''))
    ? APPLICATION_EMAIL
    : null
  const applySentence = normalizeWhitespace(
    String(detailHtml ?? '').match(/(If you have similar experience[\s\S]*?jobs@fabhotels\.com)/i)?.[1],
  )
  const locationBits = extractLocationParts(extractFieldValue(detailHtml, 'Location'))
  const sections = extractSectionItems(detailHtml)

  if (
    !title
    || !department
    || !locationBits.location
    || !experienceRequired
    || !jobId
    || !applicationEmail
    || sections.length === 0
  ) {
    throw new Error('FabHotels verified role detail surface changed materially')
  }

  return {
    title,
    company: COMPANY_NAME,
    department,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: APPLICATION_URL,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: sections.flatMap((section) => section.items),
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(sections, applySentence),
  }
}

export const createFabHotelsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    maxJobs: overrideMaxJobs,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('FabHotels verified official homepage changed materially')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('FabHotels verified careers listing surface changed materially')
    }

    const roleUrls = extractRoleUrls(careersHtml)
    const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
    const selectedRoleUrls = limit ? roleUrls.slice(0, limit) : roleUrls
    const scrapedAt = now()

    const jobs = []
    for (const roleUrl of selectedRoleUrls) {
      const detailHtml = await fetchText(roleUrl)
      const detail = extractJobDetail(detailHtml, roleUrl)
      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createFabHotelsScraper(options).run(options)

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
