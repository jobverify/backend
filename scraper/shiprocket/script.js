import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import SHIPROCKET_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SHIPROCKET_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const JOB_PAGE_PREFIX = PROVIDER_METADATA.jobPagePrefix
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#8216;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/\u2013|\u2014/g, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(li|p|div|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const titleFromUrl = (sourceUrl) => {
  const slug = String(sourceUrl ?? '').replace(/\/$/, '').split('/').filter(Boolean).pop()
  if (!slug) return null

  return slug
    .split('-')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

const isShiprocketJobUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://careers.shiprocket.in' && url.pathname.startsWith('/jobs/')
  } catch {
    return false
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized.replace(/\bGurgaon\b/i, 'Gurgaon')
}

const parseCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  return normalizeWhitespace(normalized.split(',')[0]) || null
}

const MONTH_INDEX_BY_NAME = new Map([
  ['january', '01'],
  ['february', '02'],
  ['march', '03'],
  ['april', '04'],
  ['may', '05'],
  ['june', '06'],
  ['july', '07'],
  ['august', '08'],
  ['september', '09'],
  ['october', '10'],
  ['november', '11'],
  ['december', '12'],
])

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return null

  const month = MONTH_INDEX_BY_NAME.get(match[1].toLowerCase())
  const day = match[2].padStart(2, '0')
  const year = match[3]

  if (!month) return null
  return `${year}-${month}-${day}`
}

const extractListMetaValues = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(/<(?:span|small)\b[^>]*>([\s\S]*?)<\/(?:span|small)>/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)

const cleanDepartment = (value) => normalizeWhitespace(String(value ?? '').replace(/^Department\s+/i, ''))

const cleanEmployeeType = (value) => normalizeWhitespace(String(value ?? '').replace(/^Employee Type\s+/i, ''))

const cleanExperienceValue = (value) =>
  normalizeWhitespace(String(value ?? '').replace(/^Experience range\s+/i, ''))

const extractFieldText = (html, pattern) =>
  normalizeWhitespace(String(html ?? '').match(pattern)?.[1])

const extractSectionText = (html, sectionTitles = []) => {
  for (const sectionTitle of sectionTitles) {
    const match = String(html ?? '').match(
      new RegExp(`<h2[^>]*>\\s*${sectionTitle}\\s*<\\/h2>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'),
    )
    const text = normalizeWhitespace(match?.[1])
    if (text) return text
  }

  return null
}

const extractSkillList = (html, sectionTitle) => {
  const match = String(html ?? '').match(
    new RegExp(`<h2[^>]*>\\s*${sectionTitle}\\s*<\\/h2>\\s*<ul>([\\s\\S]*?)<\\/ul>`, 'i'),
  )
  if (!match) return []

  return Array.from(
    String(match[1]).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
    (item) => {
      const text = stripTagsToText(item[1])
      if (!text) return null

      const trimmed = text
        .replace(/^Strong proficiency in\s+/i, '')
        .replace(/^Hands-on experience with\s+/i, '')
        .replace(/^Exceptional\s+/i, '')
        .replace(/^Strong experience with data visualization tools \(e\.g\.,\s*/i, '')
        .replace(/\)$/i, '')
        .replace(/\s+skills$/i, '')
      return normalizeWhitespace(trimmed)
    },
  ).flatMap((text) => {
    if (!text) return []
    if (/Tableau,\s*Power BI,\s*Looker/i.test(text)) {
      return ['Tableau', 'Power BI', 'Looker']
    }
    if (/^SQL/i.test(text)) return ['SQL']
    return [text]
  }).filter(Boolean)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()

  return extractTitle(page) === 'Shiprocket Careers - Apply for a Job at Shiprocket'
    && text.includes('career that takes you miles!')
    && text.includes('join the family')
    && text.includes("we're hiring!")
    && text.includes('job application form')
    && extractVisibleJobListings(page).length > 0
    && /https:\/\/careers\.shiprocket\.in\/jobs\//i.test(page)
}

export const extractVisibleJobListings = (html = '') => {
  const listings = []
  const seenSlugs = new Set()
  const patterns = [
    /<article\b[^>]*class=["'][^"']*\bjob-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
    /<div\b[^>]*class=["'][^"']*\bjob\b[^"']*["'][^>]*>([\s\S]*?)<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*View Job\s*<\/a>\s*<\/div>/gi,
  ]

  for (const pattern of patterns) {
    for (const match of String(html ?? '').matchAll(pattern)) {
      const cardHtml = match[1]
      const title = normalizeWhitespace(cardHtml.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1])
      const metaValues = extractListMetaValues(cardHtml)
      const sourceUrl = normalizeWhitespace(
        match[2]
          || cardHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*View Job\s*<\/a>/i)?.[1],
      )
      const slug = slugify(title)

      if (!title || !slug || !sourceUrl || seenSlugs.has(slug) || !isShiprocketJobUrl(sourceUrl)) continue

      seenSlugs.add(slug)
      const location = metaValues[metaValues.length - 1] || null
      const experienceRequired = metaValues.length > 1 ? metaValues[0] : null
      listings.push({
        slug,
        title,
        sourceUrl,
        applyUrl: sourceUrl,
        location,
        experienceRequired,
      })
    }
  }

  return listings
}

const hasApplyFormSignal = (html = '') =>
  /Apply for this job/i.test(String(html ?? ''))
  && /Job Application Form/i.test(String(html ?? ''))
  && /Resume\*/i.test(String(html ?? ''))

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const expectedTitle = listing.title || titleFromUrl(listing.sourceUrl)
  const pageTitle = extractTitle(page)

  if (
    !pageTitle
    || !expectedTitle
    || !pageTitle.toLowerCase().includes(String(expectedTitle).toLowerCase())
    || !hasApplyFormSignal(page)
  ) {
    throw new Error('The verified Shiprocket job detail page changed materially')
  }

  const title = normalizeWhitespace(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || listing.title
  const rawLocation = extractFieldText(page, /<h1[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/i) || listing.location
  const location = normalizeLocation(rawLocation)
  const department = cleanDepartment(extractFieldText(page, /<p>(Department[\s\S]*?)<\/p>/i))
  const employmentType = cleanEmployeeType(extractFieldText(page, /<p>(Employee Type[\s\S]*?)<\/p>/i))
  const experienceRequired = cleanExperienceValue(extractFieldText(page, /<p>(Experience range[\s\S]*?)<\/p>/i))
    || listing.experienceRequired
  const postingDate = parsePostingDate(
    extractFieldText(page, /<p>Job posted on\s*([\s\S]*?)<\/p>/i),
  )
  const jobDescription = extractSectionText(page, ['About the Role', 'ABOUT THE ROLE', 'Role Overview:?'])
  const requiredSkills = Array.from(new Set([
    ...extractSkillList(page, 'Required Skills & Qualifications'),
    ...extractSkillList(page, 'Qualifications'),
    ...extractSkillList(page, 'Requirements'),
  ]))

  return {
    slug: listing.slug || slugify(title),
    title,
    sourceUrl: listing.sourceUrl,
    applyUrl: listing.applyUrl || listing.sourceUrl,
    location,
    city: parseCity(location),
    country: 'India',
    department,
    employmentType,
    experienceRequired,
    postingDate,
    jobDescription,
    requiredSkills,
  }
}

export const createShiprocketScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Shiprocket careers page changed materially')
    }

    const listings = extractVisibleJobListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('The verified Shiprocket careers page did not expose any visible public job listings')
    }

    const limitedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of limitedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        title: detail.title,
        company: COMPANY_NAME,
        department: detail.department,
        location: detail.location,
        city: detail.city,
        country: detail.country,
        jobId: detail.slug,
        requisitionId: null,
        sourceUrl: detail.sourceUrl,
        applyUrl: detail.applyUrl,
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate,
        closingDate: null,
        jobDescription: detail.jobDescription,
        source: SOURCE,
        link: detail.applyUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createShiprocketScraper(options).run(options)

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
