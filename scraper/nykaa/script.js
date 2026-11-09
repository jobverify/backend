import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import NYKAA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = NYKAA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_BOARD_URL = PROVIDER_METADATA.publicBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_MAP = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripHtml = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^full[\s-]?time$/i.test(normalized)) return 'Full-time'
  if (/^part[\s-]?time$/i.test(normalized)) return 'Part-time'
  if (/^contract$/i.test(normalized)) return 'Contract'
  if (/^intern(ship)?$/i.test(normalized)) return 'Internship'
  return normalized
}

const parsePostedDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/)
  if (!match) return null

  const [, day, month, year] = match
  const monthValue = MONTH_MAP[month.toLowerCase()]
  if (!monthValue) return null

  return `${year}-${monthValue}-${day.padStart(2, '0')}`
}

const parseExperienceYears = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/Minimum\s+([0-9.]+)\s*(?:years?)?(?:\s+of)?\s+experience/i)
    || normalized.match(/([0-9.]+)\s*(?:years?)?\s*Exp\.?/i)
  if (!match) return null
  return `${match[1]} years`
}

const toAbsoluteUrl = (value, baseUrl = PUBLIC_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const buildListingUrl = ({ page = 1 } = {}) =>
  page > 1 ? `${PUBLIC_BOARD_URL}?page=${page}` : PUBLIC_BOARD_URL

export const buildJobUrl = (jobId) =>
  toAbsoluteUrl(normalizeWhitespace(jobId), `${PUBLIC_BOARD_URL}`)

const hasExplicitEmptyBoard = (html) => /<p\b[^>]*>\s*Currently there are no job postings available\.\s*<\/p>/i.test(String(html ?? ''))

export const hasOfficialBoardSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasCount = /Showing\s+\d+\s+of\s+[1-9]\d*\s+-\s+Jobs/i.test(normalized)
  const hasJobs = hasCount
    || /class=["']flex flex-col space-y-3 border-offset-background p-5/i.test(page)
    || /href=["']\/?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']/i.test(page)
  const empty = hasExplicitEmptyBoard(page)
  if (normalized.toLowerCase().includes('currently there are no job postings available.') && hasJobs) return false
  if (!/<title>\s*Careers \| Nykaa\s*<\/title>/i.test(page)) return false

  const legacyTenant = /careers\.nykaa\.com\.skima\.ai/i.test(page)
  const currentTenant = /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/careers\.nykaa\.com\/?["']/i.test(page)
    && /<h1\b[^>]*>\s*Nykaa\s*<\/h1>/i.test(page)
    && /https:\/\/storage\.googleapis\.com\/skima-prod\/companies\/logo\/28216_/i.test(page)
    && /https:\/\/skima-careers-frontend\.pages\.dev\/_astro\/InternalJobPostingLoginButton\./i.test(page)
    && decodeHtmlEntities(page).includes('"domain":[0,"careers.nykaa.com"]')
    && decodeHtmlEntities(page).includes('"companyName":[0,"Nykaa"]')

  return (legacyTenant || currentTenant) && (hasCount || empty)
}

const extractCardBlocks = (html) => [...String(html ?? '').matchAll(
  /<div class="flex flex-col space-y-3 border-offset-background p-5 md:flex-row md:items-center md:space-x-3 md:space-y-0">([\s\S]*?)<\/div>\s*<\/div>/gi,
)].map((match) => match[1])

export const extractBoardSummary = (html) => {
  const currentPage = Number.parseInt(
    String(html).match(/data-current-page="(\d+)"/i)?.[1] || '1',
    10,
  ) || 1
  const totalPages = Number.parseInt(
    String(html).match(/data-last-page="(\d+)"/i)?.[1] || '1',
    10,
  ) || 1
  const totalCount = Number.parseInt(
    String(html).match(/Showing\s+\d+\s+of\s+(\d+)\s+-\s+Jobs/i)?.[1] || '0',
    10,
  ) || 0
  const pageSize = extractCardBlocks(html).length

  return {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    hasNext: currentPage < totalPages,
  }
}

export const extractSearchResults = (html) => extractCardBlocks(html)
  .map((block) => {
    const href = normalizeWhitespace(
      block.match(/<a href="([^"]+)" class="text-lg font-semibold text-primary hover:underline hover:underline-offset-2">/i)?.[1],
    )
    const title = normalizeWhitespace(
      block.match(/<a href="[^"]+" class="text-lg font-semibold text-primary hover:underline hover:underline-offset-2">([\s\S]*?)<\/a>/i)?.[1],
    )
    const experience = parseExperienceYears(
      block.match(/<p class="text-sm">([\s\S]*?)<\/p>/i)?.[1],
    )
    const spans = [...block.matchAll(/<span class="break-all text-sm">\s*([\s\S]*?)\s*<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter(Boolean)

    const [locationValue, , employmentTypeValue] = spans
    const location = normalizeWhitespace(locationValue)
    const jobId = href?.replace(/^\//, '') || null
    const sourceUrl = jobId ? buildJobUrl(jobId) : null

    if (!title || !jobId || !sourceUrl) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city: location ? normalizeCity(location) : null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(employmentTypeValue),
      experienceRequired: experience,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

const extractDescriptionHtml = (html) => {
  const source = String(html ?? '')
  const match = source.match(
    /<div class="job-description-panel[^"]*">([\s\S]*?)<\/div>\s*(?:<div class="mt-4 flex w-full flex-col items-start">|<\/div>\s*<\/div>\s*<div class="col-span-12 mt-6)/i,
  )
  return match?.[1] ?? ''
}

const extractSkills = (html) => [...String(html ?? '').matchAll(
  /<li class="m-0\.5 rounded bg-offset-background px-3 py-1 text-xs font-normal text-foreground">([\s\S]*?)<\/li>/gi,
)].map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractSidebarValues = (html) => {
  const sidebarMatch = String(html ?? '').match(
    /<div class="space-y-6 rounded-md bg-offset-background p-4">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i,
  )
  if (!sidebarMatch) return []

  return [...sidebarMatch[1].matchAll(/<p[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    String(html).match(/<h1[^>]*class="text-2xl font-semibold text-primary"[^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title || null
  const postingDate = parsePostedDate(
    String(html).match(/<span>\s*Posted on\s*<\/span>\s*<span>\s*([\s\S]*?)\s*<\/span>/i)?.[1],
  ) || listing.postingDate || null
  const descriptionHtml = extractDescriptionHtml(html)
  const description = normalizeWhitespace(descriptionHtml)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sidebarValues = extractSidebarValues(html)
  const workModel = sidebarValues.find((value) => /^(in office|remote|hybrid)$/i.test(value)) || null
  const experience = sidebarValues.find((value) => /\bExp\.?$/i.test(value))
  const labelCandidates = sidebarValues.filter((value) => (
    !/^(in office|remote|hybrid)$/i.test(value)
    && !/\bExp\.?$/i.test(value)
    && value !== 'Nykaa'
  ))
  const companyOrBrand = labelCandidates.length > 1 ? labelCandidates[0] : null
  const locationValue = (
    labelCandidates.length > 1
      ? labelCandidates[1]
      : labelCandidates[0]
  ) || listing.location || null

  return {
    title,
    company: COMPANY,
    department: companyOrBrand,
    location: normalizeWhitespace(locationValue) || null,
    city: locationValue ? normalizeCity(locationValue.split(',')[0]) : (listing.city || null),
    country: 'India',
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: listing.employmentType || null,
    experienceRequired: parseExperienceYears(experience) || listing.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractSkills(html),
    postingDate,
    closingDate: null,
    jobDescription: description,
    workModel,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'nykaa-html',
  timeoutMs: 15000,
})

export const createNykaaScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = defaultNow } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    let reportedTotal = null
    let reachedLastPage = false

    for (let page = 1; page <= maxPages; page += 1) {
      const html = await fetchText(buildListingUrl({ page }))
      if (!hasOfficialBoardSignal(html)) {
        throw new Error('Nykaa verified official board no longer matches the trusted public surface')
      }

      if (page === 1 && hasExplicitEmptyBoard(html)) {
        return attachInventoryEvidence([], {
          status: 'verified-empty',
          surface: PUBLIC_BOARD_URL,
          firstParty: true,
          listingComplete: true,
          pagesFetched: 1,
          reportedTotal: 0,
          indiaFacetCount: 0,
          verifiedAt: now(),
          reason: 'official-nykaa-board-explicit-no-job-postings',
        })
      }

      const pageJobs = extractSearchResults(html)
      const summary = extractBoardSummary(html)
      if (summary.currentPage !== page || summary.totalCount <= 0
        || (reportedTotal != null && reportedTotal !== summary.totalCount) || pageJobs.length === 0) {
        throw new Error('Nykaa advertised public inventory could not be parsed')
      }
      reportedTotal = summary.totalCount

      for (const listing of pageJobs) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          ...detail,
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs.length === reportedTotal && !summary.hasNext
            ? jobs
            : jobs.map(job => ({ ...job, sourceListingComplete: false }))
        }
      }

      if (!summary.hasNext) {
        reachedLastPage = true
        break
      }
    }

    if (!reachedLastPage) {
      return jobs.map(job => ({ ...job, sourceListingComplete: false }))
    }
    if (reportedTotal !== seenJobIds.size) {
      throw new Error('Nykaa advertised public inventory does not match the complete paginated listing')
    }
    return jobs
  },
})

export const run = async (options = {}) => createNykaaScraper(options).run(options)

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
