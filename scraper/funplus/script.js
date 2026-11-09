import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { FUNPLUS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = FUNPLUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const JOBS_SITEMAP_URL = PROVIDER_METADATA.jobsSitemapUrl
export const SAMPLE_DETAIL_URL = PROVIDER_METADATA.sampleDetailUrl
export const SAMPLE_APPLY_URL = PROVIDER_METADATA.sampleApplyUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|a|section|main|span)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = JOBS_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(String(value), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()

  if (!normalized) return null
  if (normalized === 'intern') return 'Internship'
  if (normalized === 'indefinite') return 'Full-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/full[\s-]*time|permanent|indefinite/.test(normalized)) return 'Full-time'
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return { location: null, city: null, country: null }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  return {
    location: normalized,
    city: parts[0] || null,
    country: parts.at(-1) || null,
  }
}

const extractJobId = (url) => {
  const normalized = normalizeWhitespace(url)
  if (!normalized) return null

  try {
    const pathname = new URL(normalized).pathname
    const slug = pathname.split('/').filter(Boolean).at(-1) || ''
    const match = slug.match(/-(\d+)$/)
    return match?.[1] || null
  } catch {
    return null
  }
}

const buildCanonicalSitemapUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    // Factorial redirects this employer to factorial.com while its sitemap retains factorialhr.com.
    if (url.hostname === 'funplus.factorial.com') url.hostname = 'funplus.factorialhr.com'
    url.pathname = url.pathname.replace(/^\/embed\//i, '/')
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page) || ''

  return /<title>\s*Hello!\s*Welcome to FunPlus!\s*-\s*FunPlus\s*<\/title>/i.test(page)
    && /href=["']https:\/\/funplus\.com\/careers\/["']/i.test(page)
    && /FunPlus/i.test(text)
}

export const extractJobsBoardUrl = (html = '') => {
  const match = String(html ?? '').match(
    /src=["'](https:\/\/funplus\.factorial(?:hr)?\.com\/embed\/jobs)["']/i,
  )

  return match?.[1] || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page) || ''

  return /<title>\s*Careers - FunPlus\s*<\/title>/i.test(page)
    && /FUN ROLES/i.test(text)
    && extractJobsBoardUrl(page) === JOBS_BOARD_URL
}

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page) || ''

  return /<title>\s*FunPlus - Job offers, offices and team\s*<\/title>/i.test(page)
    && /Open Positions/i.test(text)
    && /job-offer-item/i.test(page)
    && /funplus\.factorial(?:hr)?\.com\/embed\/job_posting\//i.test(page)
}

export const hasVerifiedJobsSitemapSignal = (xml = '') => {
  const page = String(xml ?? '')
  return /https:\/\/funplus\.factorial(?:hr)?\.com<\/loc>/i.test(page)
    && /https:\/\/funplus\.factorial(?:hr)?\.com\/job_posting\//i.test(page)
  }

export const extractSitemapEntries = (xml = '') => {
  const entries = {}

  for (const match of String(xml ?? '').matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/gi)) {
    const url = normalizeWhitespace(match[1])
    const lastmod = normalizeWhitespace(match[2])

    if (!url || !lastmod) continue
    if (!/\/job_posting\//i.test(url)) continue

    entries[url] = lastmod
  }

  return entries
}

export const extractJobCards = (html = '') => {
  const groups = String(html ?? '').split(/<div data-target=['"]job-filters\.officeGroup['"]>/i).slice(1)
  const cards = []

  for (const group of groups) {
    const boardLocation = stripTagsToText(group.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]) || null
    const itemMatches = group.matchAll(/<li\b[^>]*class=['"][^'"]*job-offer-item[^'"]*['"][\s\S]*?<\/li>/gi)

    for (const match of itemMatches) {
      const block = match[0]
      const title = stripTagsToText(
        block.match(/factorial__headingFontFamily["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
      )
      const sourceUrl = toAbsoluteUrl(
        block.match(/data-job-postings-url=['"]([^'"]+)['"]/i)?.[1],
        JOBS_BOARD_URL,
      )
      const contractType = normalizeEmploymentType(
        block.match(/data-contract-type=['"]([^'"]*)['"]/i)?.[1],
      )
      const secondaryFields = [...block.matchAll(/text-gray-350 text-left["']>([\s\S]*?)<\/div>/gi)]
        .map((fieldMatch) => stripTagsToText(fieldMatch[1]))

      if (!title || !sourceUrl || !boardLocation) {
        throw new Error('FunPlus verified public Factorial jobs board no longer matches the known listing contract')
      }

      cards.push({
        title,
        department: secondaryFields[0] || null,
        workplaceType: secondaryFields[1] || null,
        employmentType: contractType,
        boardLocation,
        sourceUrl,
      })
    }
  }

  return cards
}

export const extractDetailMetadata = (html = '', detailUrl = '') => {
  const page = String(html ?? '')
  const title = stripTagsToText(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
    || normalizeWhitespace(page.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1])
  const applyUrl = toAbsoluteUrl(
    page.match(/href=['"]([^'"]*\/embed\/apply\/[^'"]+)['"]/i)?.[1],
    detailUrl || JOBS_BOARD_URL,
  )
  const locationMatch = page.match(/>\s*(?:Hybrid|Remote|On[\s-]*site|Onsite)\s*\(([^<]+)\)\s*</i)
  const locationText = normalizeWhitespace(locationMatch?.[1])
  const location = parseLocation(locationText)
  const descriptionBlock = page.match(/<section[^>]*>([\s\S]*?)<\/section>/i)?.[1]
  const jobDescription = stripTagsToText(descriptionBlock)

  return {
    title,
    location: location.location,
    city: location.city,
    country: location.country,
    applyUrl,
    jobDescription,
  }
}

const buildJob = (card, detail, postingDate, scrapedAt) => {
  const jobId = extractJobId(card.sourceUrl)
  if (!jobId || !detail.title || !detail.applyUrl || !detail.location) {
    throw new Error('FunPlus verified public job detail page no longer matches the known apply surface')
  }

  return {
    jobId,
    requisitionId: jobId,
    title: detail.title,
    company: COMPANY,
    department: card.department,
    location: detail.location,
    city: detail.city,
    country: detail.country,
    sourceUrl: card.sourceUrl,
    applyUrl: detail.applyUrl,
    employmentType: card.employmentType,
    workplaceType: card.workplaceType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: detail.jobDescription,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: detail.applyUrl,
    scrapedAt,
  }
}

export const createFunPlusScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('FunPlus verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !hasOfficialCareersSignal(careersPage.html)
      || !sameUrl(extractJobsBoardUrl(careersPage.html), JOBS_BOARD_URL)
    ) {
      throw new Error('FunPlus verified careers page no longer matches the known first-party iframe handoff')
    }

    const jobsBoard = await fetchPage(JOBS_BOARD_URL)
    if (jobsBoard.status !== 200 || !hasOfficialJobsBoardSignal(jobsBoard.html)) {
      throw new Error('FunPlus verified public Factorial jobs board no longer matches the known surface')
    }

    const sitemap = await fetchPage(JOBS_SITEMAP_URL)
    if (sitemap.status !== 200 || !hasVerifiedJobsSitemapSignal(sitemap.html)) {
      throw new Error('FunPlus verified jobs sitemap no longer matches the known public surface')
    }

    const sitemapEntries = extractSitemapEntries(sitemap.html)
    if (Object.keys(sitemapEntries).length === 0) {
      throw new Error('FunPlus verified jobs sitemap no longer exposes the known public job route contract')
    }

    const scrapedAt = now()
    const jobs = []
    const cards = extractJobCards(jobsBoard.html)
    const limitedCards = maxJobs ? cards.slice(0, maxJobs) : cards

    if (limitedCards.length === 0) {
      throw new Error('FunPlus verified public Factorial jobs board no longer exposes public job cards')
    }

    for (const card of limitedCards) {
      const detailPage = await fetchPage(card.sourceUrl)
      const detail = extractDetailMetadata(detailPage.html, card.sourceUrl)

      if (
        detailPage.status !== 200
        || !detail.title
        || normalizeWhitespace(detail.title) !== normalizeWhitespace(card.title)
        || !detail.applyUrl
        || !detail.location
      ) {
        throw new Error('FunPlus verified public job detail page no longer matches the known apply surface')
      }

      jobs.push(
        buildJob(
          card,
          detail,
          extractSitemapEntries(sitemap.html)[buildCanonicalSitemapUrl(card.sourceUrl)] || null,
          scrapedAt,
        ),
      )
    }

    return jobs
  },
})

export const run = async (options = {}) => createFunPlusScraper(options).run(options)

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
