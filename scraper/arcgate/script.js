import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ARCGATE_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_JOB_DETAIL_URL = PROVIDER_METADATA.verifiedSampleJobUrl
export const DEFAULT_LOCATION = 'Udaipur, Rajasthan, India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeInlineText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const absolutizeUrl = (value) => new URL(value, CAREERS_URL).toString()

const slugify = (value) => normalizeInlineText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractTextMatch = (html, regex) => {
  const match = regex.exec(String(html ?? ''))
  return match ? normalizeInlineText(match[1]) : null
}

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
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Current Job Openings')
    && normalized.includes('Research Analyst')
    && normalized.includes('Data Engineer')
    && normalized.includes('Senior Dynamics 365 Solution Architect')
    && normalized.includes('Built By Arcgate Technologies LLP')
}

export const extractOpeningLinks = (html = '') => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('ArcGate verified first-party careers page no longer matches the trusted surface')
  }

  const sectionMatch = /<section id="current_openings"[\s\S]*?<\/section>/i.exec(String(html ?? ''))
  if (!sectionMatch) {
    throw new Error('ArcGate current openings section no longer matches the verified layout')
  }

  const openings = []
  const openingsByUrl = new Map()

  for (const departmentMatch of sectionMatch[0].matchAll(
    /<p class="color-brand">([^<]+)<\/p>\s*<ul>([\s\S]*?)<\/ul>/gi,
  )) {
    const department = normalizeInlineText(departmentMatch[1])
    const linksHtml = departmentMatch[2]

    for (const linkMatch of linksHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)) {
      const detailUrl = absolutizeUrl(linkMatch[1])
      const title = normalizeInlineText(linkMatch[2])
      if (!title || !detailUrl) continue

      const opening = { department, title, detailUrl }
      openingsByUrl.set(detailUrl, opening)
    }
  }

  openings.push(...openingsByUrl.values())

  if (openings.length === 0) {
    throw new Error('ArcGate verified careers page no longer exposes current opening links')
  }

  return openings
}

export const extractJobDetail = (html = '', opening = {}) => {
  const page = String(html ?? '')
  const title = extractTextMatch(page, /<h1 class="fw-bold fs-1 mt-3">([^<]+)<\/h1>/i)
  const applyPath = extractTextMatch(page, /href="(\/join\?post_name=[^"]+)"/i)
  const canonicalUrl = extractTextMatch(page, /<link rel="canonical" href="([^"]+)"/i)
  const contentMatch = /<section class="proximaRegular sectionCareer">([\s\S]*?)<div class="career-bottom-strip">/i.exec(page)
  const jobDescription = normalizeWhitespace(contentMatch?.[1] ?? '')

  if (!title || !applyPath || !jobDescription) {
    throw new Error(`ArcGate job detail no longer matches the verified layout for ${opening.detailUrl}`)
  }

  const sourceUrl = canonicalUrl || opening.detailUrl
  const slug = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) || slugify(title)
  const jobId = `${SOURCE}-${slugify(slug)}`

  return {
    title,
    company: COMPANY,
    department: opening.department || null,
    location: DEFAULT_LOCATION,
    country: 'India',
    city: 'Udaipur',
    jobId,
    requisitionId: jobId,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    source: SOURCE,
    sourceUrl,
    applyUrl: absolutizeUrl(applyPath),
    link: absolutizeUrl(applyPath),
    scrapedAt: new Date().toISOString(),
  }
}

export const createArcGateScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const openings = extractOpeningLinks(careersHtml)
    const jobs = []

    for (const opening of openings) {
      const detailHtml = await fetchText(opening.detailUrl)
      jobs.push(extractJobDetail(detailHtml, opening))
    }

    return jobs
  },
})

export const run = async (options = {}) => createArcGateScraper().run(options)

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
