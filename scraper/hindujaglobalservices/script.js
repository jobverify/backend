import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HINDUJA_GLOBAL_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HINDUJA_GLOBAL_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BPM_CATEGORY_PAGE_URL = PROVIDER_METADATA.bpmCategoryPageUrl
export const DIGITAL_CATEGORY_PAGE_URL = PROVIDER_METADATA.digitalCategoryPageUrl
export const BPM_JOBS_RSS_URL = PROVIDER_METADATA.bpmJobsRssUrl
export const DIGITAL_JOBS_RSS_URL = PROVIDER_METADATA.digitalJobsRssUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIAN_STATE_CODES = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CT: 'Chhattisgarh',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TG: 'Telangana',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UT: 'Uttarakhand',
  WB: 'West Bengal',
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
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

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTagValue = (tagName, block) => {
  const match = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)</${escapeRegExp(tagName)}>`, 'i')
    .exec(String(block ?? ''))
  return match ? match[1] : null
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Hinduja Global Services scraper')
  }

  return parsed.toISOString()
}

const normalizeHgsJobUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return normalized
  }
}

const extractRssItems = (xml) => [...String(xml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  .map((match) => match[1])
  .map((block) => ({
    title: normalizeWhitespace(extractTagValue('title', block)),
    sourceUrl: normalizeHgsJobUrl(extractTagValue('link', block)),
    postingDate: normalizeDate(extractTagValue('pubDate', block)),
    description: stripTags(extractTagValue('description', block)),
  }))
  .filter((item) => item.title && item.sourceUrl)

const extractJobIdFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) || null
  } catch {
    return null
  }
}

const extractLabeledValue = (text, labels, followingLabels) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const labelPattern = labels.map((label) => escapeRegExp(label)).join('|')
  const followingPattern = followingLabels.map((label) => escapeRegExp(label)).join('|')
  const match = new RegExp(
    `(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=\\s+(?:${followingPattern})\\s*:|$)`,
    'i',
  ).exec(normalized)

  return normalizeWhitespace(match?.[1] || '')
}

const extractExperience = (text) => extractLabeledValue(
  text,
  ['Experience', 'Exp'],
  ['Department', 'Location', 'Work Location', 'Position', 'Job Title', 'Designation'],
)

const extractDepartment = (text) => extractLabeledValue(
  text,
  ['Department'],
  ['Experience', 'Exp', 'Location', 'Work Location', 'Position', 'Job Title', 'Designation'],
)

const parseFeedTitle = (title) => {
  const normalized = normalizeWhitespace(title)
  const match = normalized?.match(/^(.*?)\s*\(([^)]+)\)\s*$/)

  const roleTitle = normalizeWhitespace(match?.[1] || normalized)
  const locationDescriptor = normalizeWhitespace(match?.[2] || '')
  const parts = locationDescriptor
    ?.split(/\s*,\s*/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean) || []

  const rawCity = parts[0] || null
  const rawStateCode = parts[1] || null
  const rawCountryCode = parts[2] || null
  const normalizedCountryCode = rawCountryCode?.toUpperCase() || null

  const city = rawCity
    ? (/^navi mumbai$/i.test(rawCity) ? 'Navi Mumbai' : normalizeCity(rawCity))
    : null
  const state = rawStateCode
    ? (INDIAN_STATE_CODES[rawStateCode.toUpperCase()] || rawStateCode.toUpperCase())
    : null

  return {
    title: roleTitle,
    city,
    state,
    location: city && state ? `${city}, ${state}, India` : (city ? `${city}, India` : 'India'),
    countryCode: normalizedCountryCode,
  }
}

const inferRemoteStatus = (description) => {
  const normalized = normalizeWhitespace(description) || ''
  if (/\bhybrid\b/i.test(normalized)) return 'Hybrid'
  if (/\bremote\b/i.test(normalized)) return 'Remote'
  return 'On-site'
}

const sortByPostingDateDesc = (jobs = []) => [...jobs].sort((left, right) =>
  String(right.postingDate || '').localeCompare(String(left.postingDate || '')))

export const hasOfficialCareersLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Careers at HGS India \| Customer Service &amp; Tech Jobs\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.joinhgs\.com\/in\/en["']/i.test(rawHtml)
    && normalized.includes('Careers at HGS')
    && rawHtml.includes(BPM_CATEGORY_PAGE_URL)
    && rawHtml.includes(DIGITAL_CATEGORY_PAGE_URL)
    && rawHtml.includes('current-openings?search_job={search_term_string}')
}

export const hasBpmCategoryPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Customer Service Jobs in India \| BPO Jobs \| JoinHGS India Careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('BPM Jobs India')
    && normalized.includes('Search Jobs')
    && rawHtml.includes(BPM_JOBS_RSS_URL)
}

export const hasDigitalCategoryPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*IT Sector Jobs in India \|Technology Jobs \|JoinHGS India Careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Digital Data and Analytics')
    && normalized.includes('Search Jobs')
    && rawHtml.includes(DIGITAL_JOBS_RSS_URL)
}

export const hasJobsRssSignal = (xml = '', rssUrl = '') => {
  const rawXml = String(xml ?? '')
  const expectedCatId = (() => {
    try {
      return new URL(rssUrl).searchParams.get('catid')
    } catch {
      return null
    }
  })()
  const itemLinks = [...rawXml.matchAll(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
  const trustedHeader = /<rss\b/i.test(rawXml)
    && /Hinduja Global Solutions Ltd/i.test(rawXml)
    && new RegExp(`category${escapeRegExp(expectedCatId)}\\.xml`, 'i').test(rawXml)
  const emptyCategory = /<item>\s*<title>No jobs currently available - Check out our other opportunities\.<\/title>[\s\S]*?<link>https:\/\/careers\.joinhgs\.com<\/link>[\s\S]*?<guid\b[^>]*>0<\/guid>\s*<\/item>/i.test(rawXml)
    && itemLinks.length === 1

  return trustedHeader && (emptyCategory || (
    /https:\/\/careers\.joinhgs\.com\/India\/job\//i.test(rawXml)
    && itemLinks.length > 0
    && itemLinks.every((link) => /utm_campaign=J2W_RSS/i.test(link))
  ))
}

export const extractIndiaJobsFromFeed = (
  xml,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const normalizedScrapedAt = normalizeScrapedAt(scrapedAt)

  return extractRssItems(xml)
    .map((item) => {
      const parsedTitle = parseFeedTitle(item.title)
      if (parsedTitle.countryCode && parsedTitle.countryCode !== 'IN') return null

      const sourceUrl = normalizeHgsJobUrl(item.sourceUrl)
      const jobId = extractJobIdFromUrl(sourceUrl)
      if (!parsedTitle.title || !sourceUrl || !jobId) return null

      return {
        title: parsedTitle.title,
        company: COMPANY_NAME,
        department: extractDepartment(item.description),
        location: parsedTitle.location,
        city: parsedTitle.city,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: extractExperience(item.description),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: item.postingDate,
        closingDate: null,
        jobDescription: item.description,
        remoteStatus: inferRemoteStatus(item.description),
        scrapedAt: normalizedScrapedAt,
      }
    })
    .filter(Boolean)
}

const dedupeJobs = (jobs = []) => {
  const seen = new Set()

  return jobs.filter((job) => {
    const key = job.sourceUrl || job.jobId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,text/xml;q=0.8,*/*;q=0.7',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHindujaGlobalServicesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: nowOverride = now,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersLandingSignal(careersHtml)) {
      throw new Error('Hinduja Global Services verified first-party careers landing no longer matches the trusted public surface')
    }

    const bpmCategoryHtml = await fetchText(BPM_CATEGORY_PAGE_URL)
    if (!hasBpmCategoryPageSignal(bpmCategoryHtml)) {
      throw new Error('Hinduja Global Services verified BPM category page no longer matches the trusted public surface')
    }

    const digitalCategoryHtml = await fetchText(DIGITAL_CATEGORY_PAGE_URL)
    if (!hasDigitalCategoryPageSignal(digitalCategoryHtml)) {
      throw new Error('Hinduja Global Services verified digital category page no longer matches the trusted public surface')
    }

    const bpmFeedXml = await fetchText(BPM_JOBS_RSS_URL)
    if (!hasJobsRssSignal(bpmFeedXml, BPM_JOBS_RSS_URL)) {
      throw new Error('Hinduja Global Services verified HGS jobs RSS feed no longer matches the trusted public surface')
    }

    const digitalFeedXml = await fetchText(DIGITAL_JOBS_RSS_URL)
    if (!hasJobsRssSignal(digitalFeedXml, DIGITAL_JOBS_RSS_URL)) {
      throw new Error('Hinduja Global Services verified HGS jobs RSS feed no longer matches the trusted public surface')
    }

    const scrapedAt = normalizeScrapedAt(nowOverride())
    const jobs = sortByPostingDateDesc(dedupeJobs([
      ...extractIndiaJobsFromFeed(bpmFeedXml, { scrapedAt }),
      ...extractIndiaJobsFromFeed(digitalFeedXml, { scrapedAt }),
    ])).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
    }))

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createHindujaGlobalServicesScraper(options).run(options)

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
