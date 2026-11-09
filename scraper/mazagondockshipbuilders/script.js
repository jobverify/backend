import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAZAGON_DOCK_SHIPBUILDERS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MAZAGON_DOCK_SHIPBUILDERS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXECUTIVE_CAREER_PAGE_URL = PROVIDER_METADATA.executiveCareerPageUrl
export const NON_EXECUTIVE_CAREER_PAGE_URL = PROVIDER_METADATA.nonExecutiveCareerPageUrl
export const APPRENTICE_CAREER_PAGE_URL = PROVIDER_METADATA.apprenticeCareerPageUrl
export const ONLINE_RECRUITMENT_PORTAL_URL = PROVIDER_METADATA.onlineRecruitmentPortalUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION = 'Mumbai, Maharashtra, India'
const INDIA_CITY = 'Mumbai'
const INDIA_STATE = 'Maharashtra'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<br\b[^>]*>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const extractHref = (html = '') => String(html ?? '').match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] ?? null

const parseSlashDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const parseDashDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const extractTableRows = (html = '') => {
  const tableMatch = String(html ?? '').match(/<table\b[^>]*id=["']tbl-career["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)
  if (!tableMatch) return []

  return [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]))
}

const normalizeRefForId = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') ?? 'unknown'

const toDateKey = (isoDate) => String(isoDate ?? '').slice(0, 10)

const normalizeReferenceDate = (referenceDate) => {
  if (referenceDate instanceof Date) return toDateKey(referenceDate.toISOString())
  if (typeof referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(referenceDate)) {
    return referenceDate.slice(0, 10)
  }
  return toDateKey(new Date().toISOString())
}

const isActiveClosingDate = (closingDate, referenceDate) =>
  Boolean(closingDate) && toDateKey(closingDate) >= normalizeReferenceDate(referenceDate)

const isNoticeOnlyText = (value) => {
  const text = normalizeWhitespace(value)?.toLowerCase() ?? ''
  return text.includes('list of selected')
    || text.includes('eligibility list')
    || text.includes('selection for the post')
    || text.includes('declaration of')
    || text.includes('information brochure')
    || text.includes('waiting list')
}

const createJobId = (referenceNo, postingDateIso) =>
  `mazagondockshipbuilders-${normalizeRefForId(referenceNo)}-${toDateKey(postingDateIso)}`

const buildExecutiveJob = ({ referenceNo, title, details, sourceUrl, postingDate, closingDate }) => ({
  title,
  company: 'Mazagon Dock Shipbuilders Limited',
  department: 'Executive Recruitment',
  location: INDIA_LOCATION,
  city: INDIA_CITY,
  state: INDIA_STATE,
  country: 'India',
  jobId: createJobId(referenceNo, postingDate),
  requisitionId: referenceNo,
  sourceUrl,
  applyUrl: ONLINE_RECRUITMENT_PORTAL_URL,
  employmentType: /contract/i.test(details) ? 'Contract' : null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate,
  closingDate,
  jobDescription: `Official Mazagon Dock Shipbuilders executive recruitment notice. ${details}`,
})

const buildApprenticeJob = ({ referenceNo, title, details, sourceUrl, postingDate, closingDate }) => ({
  title,
  company: 'Mazagon Dock Shipbuilders Limited',
  department: 'Apprentice Recruitment',
  location: INDIA_LOCATION,
  city: INDIA_CITY,
  state: INDIA_STATE,
  country: 'India',
  jobId: createJobId(referenceNo, postingDate),
  requisitionId: referenceNo,
  sourceUrl,
  applyUrl: ONLINE_RECRUITMENT_PORTAL_URL,
  employmentType: 'Apprenticeship',
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate,
  closingDate,
  jobDescription: `Official Mazagon Dock Shipbuilders apprenticeship recruitment notice. ${details}`,
})

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialExecutiveCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Career\s*-\s*Executives/i.test(rawHtml)
    && normalized.includes('Career - Executives')
    && /id=["']tbl-career["']/i.test(rawHtml)
    && normalized.includes('Date Of Posting')
    && normalized.includes('Advertisement Reference No')
    && normalized.includes('Closing Date')
  }

export const hasOfficialNonExecutiveCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Career\s*-\s*Non-Executives/i.test(rawHtml)
    && normalized.includes('Career - Non-Executives')
    && /id=["']tbl-career["']/i.test(rawHtml)
  }

export const hasOfficialApprenticeCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Career\s*-\s*Apprentice/i.test(rawHtml)
    && normalized.includes('Career - Apprentice')
    && /id=["']tbl-career["']/i.test(rawHtml)
    && normalized.includes('DATE OF POSTING')
    && normalized.includes('ADVERTISEMENT REFERENCE NO')
  }

export const extractExecutiveOpenings = (html = '', { referenceDate = VERIFIED_ON } = {}) =>
  extractTableRows(html)
    .filter((cells) => cells.length >= 7)
    .map((cells) => {
      const postingDate = parseSlashDate(stripTags(cells[1]))
      const referenceNo = stripTags(cells[2])
      const title = stripTags(cells[3])
      const details = stripTags(cells[4])
      const closingDate = parseSlashDate(stripTags(cells[5]))
      const sourceUrl = toAbsoluteUrl(extractHref(cells[6]), EXECUTIVE_CAREER_PAGE_URL)

      if (!postingDate || !referenceNo || !title || !details || !sourceUrl) return null
      if (isNoticeOnlyText(details)) return null
      if (!isActiveClosingDate(closingDate, referenceDate)) return null

      return buildExecutiveJob({
        referenceNo,
        title,
        details,
        sourceUrl,
        postingDate,
        closingDate,
      })
    })
    .filter(Boolean)

const extractApprenticeReferenceNo = (text) =>
  normalizeWhitespace(text)?.match(/Advt\.\s*No\.\s*-\s*([A-Z0-9/.-]+)/i)?.[1] ?? null

const extractApprenticeClosingDate = (text) => {
  const match = normalizeWhitespace(text)?.match(/last date of application(?:\s+to)?\s+(\d{2}[-/]\d{2}[-/]\d{4})/i)
  if (!match) return null
  return match[1].includes('/') ? parseSlashDate(match[1]) : parseDashDate(match[1])
}

const extractApprenticeTitle = (text) => {
  const normalized = normalizeWhitespace(text) ?? ''
  const match = normalized.match(/Advt\.\s*No\.\s*-\s*[A-Z0-9/.-]+\s*-\s*(Selection of .*?)(?:\s*-\s*corrigendum|\s*-\s*Information Brochure|$)/i)
  return match?.[1] ?? null
}

export const extractApprenticeOpenings = (html = '', { referenceDate = VERIFIED_ON } = {}) =>
  extractTableRows(html)
    .filter((cells) => cells.length >= 5)
    .map((cells) => {
      const postingDate = parseSlashDate(stripTags(cells[1]))
      const details = stripTags(cells[2])
      const referenceNo = extractApprenticeReferenceNo(details)
      const title = extractApprenticeTitle(details)
      const closingDate = parseSlashDate(stripTags(cells[3])) || extractApprenticeClosingDate(details)
      const sourceUrl = toAbsoluteUrl(extractHref(cells[4]), APPRENTICE_CAREER_PAGE_URL)

      if (!postingDate || !referenceNo || !title || !details || !sourceUrl) return null
      if (isNoticeOnlyText(details)) return null
      if (!isActiveClosingDate(closingDate, referenceDate)) return null

      return buildApprenticeJob({
        referenceNo,
        title,
        details,
        sourceUrl,
        postingDate,
        closingDate,
      })
    })
    .filter(Boolean)

export const createMazagonDockShipbuildersScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const executiveHtml = await fetchText(EXECUTIVE_CAREER_PAGE_URL)
    if (!hasOfficialExecutiveCareersSignal(executiveHtml)) {
      throw new Error('Mazagon Dock Shipbuilders executive careers page no longer matches the verified public surface')
    }

    const nonExecutiveHtml = await fetchText(NON_EXECUTIVE_CAREER_PAGE_URL)
    if (!hasOfficialNonExecutiveCareersSignal(nonExecutiveHtml)) {
      throw new Error('Mazagon Dock Shipbuilders non-executive careers page no longer matches the verified public surface')
    }

    const apprenticeHtml = await fetchText(APPRENTICE_CAREER_PAGE_URL)
    if (!hasOfficialApprenticeCareersSignal(apprenticeHtml)) {
      throw new Error('Mazagon Dock Shipbuilders apprentice careers page no longer matches the verified public surface')
    }

    const referenceDate = toDateKey(now())
    const jobs = [
      ...extractExecutiveOpenings(executiveHtml, { referenceDate }),
      ...extractApprenticeOpenings(apprenticeHtml, { referenceDate }),
    ]

    const scrapedAt = now()
    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createMazagonDockShipbuildersScraper().run(options)

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
