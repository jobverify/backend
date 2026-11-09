import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { BT_GROUP_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = BT_GROUP_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_ABOUT_URL = PROVIDER_METADATA.corporateAboutUrl
export const CAREERS_LANDING_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_SEARCH_URL = PROVIDER_METADATA.indiaSearchUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const JOBS_FEED_URL = PROVIDER_METADATA.jobsFeedUrl
export const VERIFIED_INDIA_JOB_URL = PROVIDER_METADATA.verifiedIndiaJobUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
}

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

export const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const unwrapCdata = (value) => String(value ?? '')
  .replace(/^<!\[CDATA\[/, '')
  .replace(/\]\]>$/, '')

const extractTagValue = (xml, tagName) => {
  const pattern = new RegExp(
    `<${escapeRegex(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`,
    'i',
  )
  return pattern.exec(String(xml ?? ''))?.[1] ?? null
}

export const extractCareersHandoffUrl = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/jobs\.bt\.com\/)["']/i)
  return match ? match[1] : null
}

export const hasOfficialAboutPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /https:\/\/jobs\.bt\.com\//i.test(rawHtml)
    && (
      /For a career less ordinary, join us/i.test(normalized)
      || />\s*Careers\s*</i.test(rawHtml)
    )
}

export const hasCareersLandingPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*BT Group Careers\s*<\/title>/i.test(rawHtml)
    && /BT Group Careers/i.test(normalized)
    && /Search roles/i.test(normalized)
}

export const hasIndiaSearchSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /India - BT Group Jobs/i.test(normalized)
    && /locationsearch/i.test(rawHtml)
    && /India/i.test(rawHtml)
}

export const hasJobsFeedSignal = (xml) => {
  const rawXml = String(xml ?? '')
  return /<rss\b/i.test(rawXml)
    && /Careers \| BT Group Plc/i.test(rawXml)
    && /<item>/i.test(rawXml)
    && /https:\/\/jobs\.bt\.com\//i.test(rawXml)
}

export const extractFeedItems = (xml) => [...String(xml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  .map((match) => match[1])

const extractRequiredSkills = (descriptionHtml) => [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(stripTags(match[1])))
  .filter(Boolean)

const extractLabeledValue = (descriptionText, label) => {
  const pattern = new RegExp(`(?:^|\\n)\\s*${escapeRegex(label)}\\s*:?\\s*(.+)$`, 'im')
  const match = pattern.exec(String(descriptionText ?? ''))
  return match ? normalizeWhitespace(match[1]) : null
}

export const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const cleaned = normalized
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .replace(/,/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return normalized

  const [, day, monthName, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return normalized

  return `${year}-${month}-${day.padStart(2, '0')}`
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  return /(?:^|,\s*)IN(?:\s*,|$)/i.test(normalized) || /\bIndia\b/i.test(normalized)
}

const parseIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)

  if (!normalized) {
    return {
      location: 'India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  const parts = normalized.split(/\s*,\s*/).filter(Boolean)
  const city = parts[0] && !/^IN$/i.test(parts[0]) ? parts[0] : null

  return {
    location: city ? `${city}, India` : 'India',
    city,
    state: null,
    country: 'India',
  }
}

const buildPublicTitle = (title, location) => {
  const normalizedTitle = normalizeWhitespace(title)
  const normalizedLocation = normalizeWhitespace(location)

  if (!normalizedTitle) return null
  if (!normalizedLocation) return normalizedTitle

  const suffix = ` (${normalizedLocation})`
  return normalizedTitle.endsWith(suffix)
    ? normalizedTitle.slice(0, -suffix.length)
    : normalizedTitle
}

const buildJobDescription = (descriptionHtml) => normalizeWhitespace(
  stripTags(descriptionHtml).replace(/\s*\n\s*/g, ' '),
)

const extractFeedEntry = (itemXml, scrapedAt) => {
  const rawLocation = extractTagValue(itemXml, 'g:location')
  if (!isIndiaLocation(rawLocation)) return null

  const title = buildPublicTitle(extractTagValue(itemXml, 'title'), rawLocation)
  const descriptionHtml = decodeHtmlEntities(unwrapCdata(extractTagValue(itemXml, 'description') ?? ''))
  const descriptionText = stripTags(descriptionHtml)
  const jobId = normalizeWhitespace(extractTagValue(itemXml, 'g:id'))
    || normalizeWhitespace(extractTagValue(itemXml, 'guid'))
  const sourceUrl = normalizeWhitespace(extractTagValue(itemXml, 'link'))
  const department = normalizeWhitespace(extractTagValue(itemXml, 'g:job_function'))
    || extractLabeledValue(descriptionText, 'Function')
  const parsedLocation = parseIndiaLocation(
    extractLabeledValue(descriptionText, 'Location') || rawLocation,
  )

  if (!title || !jobId || !sourceUrl) return null

  return {
    title,
    company: COMPANY_NAME,
    department,
    location: parsedLocation.location,
    city: parsedLocation.city,
    state: parsedLocation.state,
    country: parsedLocation.country,
    jobId,
    requisitionId: extractLabeledValue(descriptionText, 'Job Req ID') || jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: toIsoDate(extractLabeledValue(descriptionText, 'Posting Date')),
    closingDate: toIsoDate(extractTagValue(itemXml, 'g:expiration_date')),
    jobDescription: buildJobDescription(descriptionHtml),
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
  }
}

export const extractJobsFromFeed = (xml, scrapedAt = new Date().toISOString()) =>
  extractFeedItems(xml)
    .map((itemXml) => extractFeedEntry(itemXml, scrapedAt))
    .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createBtGroupIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
  } = {}) {
    const aboutHtml = await fetchText(OFFICIAL_ABOUT_URL)
    if (!hasOfficialAboutPageSignal(aboutHtml)) {
      throw new Error('BT Group India verified official BT about page no longer matches the known careers handoff')
    }

    const careersHandoffUrl = extractCareersHandoffUrl(aboutHtml)
    if (careersHandoffUrl !== CAREERS_LANDING_PAGE_URL) {
      throw new Error('BT Group India verified BT corporate careers handoff no longer points to jobs.bt.com')
    }

    const careersLandingHtml = await fetchText(CAREERS_LANDING_PAGE_URL)
    if (!hasCareersLandingPageSignal(careersLandingHtml)) {
      throw new Error('BT Group India verified BT careers landing page no longer matches the known public surface')
    }

    const indiaSearchHtml = await fetchText(INDIA_SEARCH_URL)
    if (!hasIndiaSearchSignal(indiaSearchHtml)) {
      throw new Error('BT Group India verified BT India search page no longer matches the known public surface')
    }

    const jobsFeedXml = await fetchText(JOBS_FEED_URL)
    if (!hasJobsFeedSignal(jobsFeedXml)) {
      throw new Error('BT Group India verified BT jobs feed no longer matches the known public surface')
    }

    const jobs = extractJobsFromFeed(jobsFeedXml, now())
    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createBtGroupIndiaScraper().run(options)

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
