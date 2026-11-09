import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CEDCOSS_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const SITE_ORIGIN = 'https://cedcoss.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const decodeJsonHtml = (value) => String(value ?? '')
  .replace(/\\u003c/gi, '<')
  .replace(/\\u003e/gi, '>')
  .replace(/\\u0026/gi, '&')
  .replace(/\\"/g, '"')
  .replace(/\\\//g, '/')
  .replace(/\\n/g, '\n')

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, `${SITE_ORIGIN}/`).toString()
  } catch {
    return null
  }
}

const extractArrayValues = (value) => {
  const parsed = String(value ?? '')
    .split(',')
    .map((item) => normalizeWhitespace(item.replace(/^"|"$/g, '')))
    .filter(Boolean)

  return parsed
}

const extractSectionLists = (value) => {
  const sections = []
  for (const match of String(value ?? '').matchAll(/"title":"([^"]+)","content":"([\s\S]*?)"/g)) {
    sections.push({
      title: normalizeWhitespace(match[1]),
      content: decodeJsonHtml(match[2]),
    })
  }
  return sections
}

const extractJobPayload = (html = '') => {
  const payloadMatch = String(html ?? '').match(/\{\\"job\\":\{([\s\S]*?)\}\}\]/)
  if (!payloadMatch) {
    throw new Error('CEDCOSS role detail no longer exposes the trusted first-party job payload')
  }
  return payloadMatch[1].replace(/\\"/g, '"')
}

const extractField = (payload, field) => payload.match(new RegExp(`"${field}":"([\\s\\S]*?)(?<!\\\\)"`))?.[1] ?? null

const extractSnapshotValue = (payload, label) => payload.match(
  new RegExp(`"label":"${escapeRegex(label)}","value":"([\\s\\S]*?)(?<!\\\\)"`),
)?.[1] ?? null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*CEDCOSS Technologies\s*<\/title>/i.test(page)
    && text.includes('Available positions')
    && text.includes('Open roles')
    && text.includes('/careers/sales-executive')
}

export const extractListings = (html = '') => {
  const listings = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a class="group flex items-center justify-between[^"]*"[^>]*href="(\/careers\/[^"]+)">[\s\S]*?<div class="text-sm font-dm-sans font-medium"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="text-xs font-dm-sans mt-0\.5"[^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = stripTags(match[2])
    const meta = stripTags(match[3])
    if (!sourceUrl || !title || seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    const [employmentType, location] = meta.split('?').map((part) => normalizeWhitespace(part))
    listings.push({
      title,
      sourceUrl,
      employmentType: employmentType || null,
      location: location || null,
    })
  }

  if (listings.length === 0) {
    throw new Error('CEDCOSS careers page no longer exposes trusted first-party role links')
  }

  return listings
}

export const hasOfficialDetailSignal = (html = '', sourceUrl) => {
  const page = String(html ?? '')

  return new RegExp(`<link rel="canonical" href="${escapeRegex(sourceUrl)}"`, 'i')
    .test(page)
    && /\{\\"job\\":\{/i.test(page)
}

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialDetailSignal(html, listing.sourceUrl)) {
    throw new Error('CEDCOSS role detail no longer matches the trusted first-party surface')
  }

  const payload = extractJobPayload(html)
  const tags = extractArrayValues(payload.match(/"tags":\[(.*?)\],"techStack"/)?.[1] ?? '')
  const sections = extractSectionLists(payload.match(/"sections":\[(.*?)\],"traits"/)?.[1] ?? '')
  const descriptionParts = [
    normalizeWhitespace(extractField(payload, 'subtitle')),
    normalizeWhitespace(extractField(payload, 'body')),
    ...sections.map((section) => `${section.title}: ${stripTags(section.content)}`),
  ].filter(Boolean)

  const title = normalizeWhitespace(extractField(payload, 'title')) || listing.title
  const location = normalizeWhitespace(extractField(payload, 'location')) || listing.location
  const employmentType = normalizeWhitespace(extractField(payload, 'type')) || listing.employmentType
  const department = normalizeWhitespace(extractField(payload, 'team'))
  const slug = normalizeWhitespace(extractField(payload, 'slug')) || slugify(title)
  const experienceRequired = normalizeWhitespace(extractSnapshotValue(payload, 'Experience'))
  const compensation = normalizeWhitespace(extractSnapshotValue(payload, 'Compensation'))

  return {
    title,
    department,
    location,
    city: /remote/i.test(location ?? '') ? null : location,
    state: null,
    country: 'India',
    jobId: `${SOURCE}-${slug}`,
    requisitionId: `${SOURCE}-${slug}`,
    sourceUrl: listing.sourceUrl,
    applyUrl: listing.sourceUrl,
    employmentType,
    workplaceType: /remote/i.test(location ?? '') ? 'remote' : null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: tags,
    compensation,
    postingDate: normalizeWhitespace(extractField(payload, 'postedAt')),
    closingDate: null,
    jobDescription: descriptionParts.join('\n\n'),
  }
}

export const createCedcossTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Cedcoss Technologies verified careers page no longer matches the trusted first-party surface')
    }

    const listings = extractListings(careersHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      jobs.push({
        ...extractJobDetail(detailHtml, listing),
        company: COMPANY,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'cedcoss.com',
        atsPlatform: 'official-company-careers',
        link: listing.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs.sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
  },
})

export const run = async (options = {}) => createCedcossTechnologiesScraper().run(options)

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
