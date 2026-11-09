import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.lennox.com/careers/'
export const SEARCH_PAGE_URL = 'https://globalcareers-lennox.icims.com/jobs/search?ss=1&in_iframe=1'

const COMPANY_NAME = 'Lennox'
const SOURCE = 'lennox'
export const ICIMS_USER_AGENT = 'Mozilla/5.0'
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': ICIMS_USER_AGENT,
}
const DETAIL_SECTION_STOP_LABELS = [
  'Overview',
  'Responsibilities',
  'Qualifications',
  'Options',
  'Apply for this job online',
  'Email this job to a friend',
  'Share',
  'Refer',
]
const COUNTRY_CODE_MAP = {
  US: 'United States',
  USA: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#39;|&#x27;|&apos;/gi, '\'')
  .replace(/&#34;|&quot;/gi, '"')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|dt|dd|h[1-6]|li|main|p|section|span|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const unique = (values) => [...new Set(values.filter(Boolean))]

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const htmlToLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/?(?:article|div|dl|dt|dd|h[1-6]|li|main|ol|p|section|span|ul)[^>]*>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const getField = (html, label) => {
  const escapedLabel = escapeRegex(label)
  const match = String(html ?? '').match(new RegExp(
    `<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
    'i',
  ))

  return stripTags(match?.[1])
}

const toAbsoluteUrl = (value, base = SEARCH_PAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, base).toString()
  } catch {
    return normalized
  }
}

const extractJobPathInfo = (value = '') => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return {
    host: null,
    jobId: null,
    slug: null,
  }

  try {
    const parsed = new URL(absoluteUrl)
    const match = parsed.pathname.match(/\/jobs\/(\d+)\/([^/?#]+)\/(?:job|login)/i)
    if (!match) {
      return {
        host: null,
        jobId: null,
        slug: null,
      }
    }

    return {
      host: parsed.host,
      jobId: normalizeWhitespace(match[1]),
      slug: normalizeWhitespace(match[2]),
    }
  } catch {
    return {
      host: null,
      jobId: null,
      slug: null,
    }
  }
}

const buildFrameUrl = ({ host, jobId, slug, suffix }) => {
  const normalizedHost = normalizeWhitespace(host)
  const normalizedJobId = normalizeWhitespace(jobId)
  const normalizedSlug = normalizeWhitespace(slug)
  const normalizedSuffix = normalizeWhitespace(suffix)

  return normalizedHost && normalizedJobId && normalizedSlug && normalizedSuffix
    ? `https://${normalizedHost}/jobs/${normalizedJobId}/${normalizedSlug}/${normalizedSuffix}?in_iframe=1`
    : null
}

export const buildSearchUrl = () => SEARCH_PAGE_URL

export const buildDetailUrl = ({ host, jobId, slug }) => buildFrameUrl({
  host,
  jobId,
  slug,
  suffix: 'job',
})

export const buildApplyUrl = ({ host, jobId, slug }) => buildFrameUrl({
  host,
  jobId,
  slug,
  suffix: 'login',
})

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return COUNTRY_CODE_MAP[normalized.toUpperCase()] || normalized
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      city: null,
      country: null,
      location: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (!parts.length) {
    return {
      city: null,
      country: null,
      location: normalized,
    }
  }

  const country = normalizeCountry(parts.at(-1))
  const city = parts[0] || null
  const adjustedParts = country ? [...parts.slice(0, -1), country] : parts

  return {
    city,
    country,
    location: adjustedParts.join(', '),
  }
}

const getRows = (html) => {
  const rows = []
  const rowPattern = /<div[^>]*class=["'][^"']*iCIMS_JobsTableRow[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*iCIMS_JobsTableRow|<\/main>|<\/body>|$)/gi
  let match

  while ((match = rowPattern.exec(String(html ?? ''))) !== null) {
    rows.push(match[1])
  }

  return rows
}

const extractLineAfterLabel = (lines, label) => {
  const index = lines.findIndex((line) => new RegExp(`^${escapeRegex(label)}$`, 'i').test(line))
  return index >= 0 ? normalizeWhitespace(lines[index + 1]) : null
}

const extractSectionLines = (lines, label, stopLabels = []) => {
  const startIndex = lines.findIndex((line) => new RegExp(`^${escapeRegex(label)}$`, 'i').test(line))
  if (startIndex === -1) return []

  const collected = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (stopLabels.some((stopLabel) => new RegExp(`^${escapeRegex(stopLabel)}$`, 'i').test(line))) {
      break
    }
    collected.push(line)
  }

  return collected
}

const extractDescriptionFields = (lines) => {
  const sanitizeSectionLines = (sectionLines) => sectionLines.filter((line) => !/^(apply|share|refer|email this job)/i.test(line))

  const overviewLines = sanitizeSectionLines(
    extractSectionLines(lines, 'Overview', DETAIL_SECTION_STOP_LABELS),
  )
  const responsibilityLines = sanitizeSectionLines(
    extractSectionLines(lines, 'Responsibilities', DETAIL_SECTION_STOP_LABELS),
  )
  const qualificationLines = sanitizeSectionLines(
    extractSectionLines(lines, 'Qualifications', DETAIL_SECTION_STOP_LABELS),
  )

  return {
    jobDescription: normalizeWhitespace([
      overviewLines.join(' '),
      responsibilityLines.join(' '),
      qualificationLines.join(' '),
    ].filter(Boolean).join(' ')),
    requiredSkills: unique(qualificationLines),
  }
}

const extractApplyUrl = (html = '', listing = {}) => {
  const applyMatch = String(html ?? '').match(
    /<a[^>]+href=["']([^"']+)["'][^>]*(?:class=["'][^"']*iCIMS_ApplyOnlineButton[^"']*["']|title=["']Apply for this job online["'])/i,
  ) || String(html ?? '').match(
    /<a[^>]+(?:class=["'][^"']*iCIMS_ApplyOnlineButton[^"']*["']|title=["']Apply for this job online["'])[^>]+href=["']([^"']+)["']/i,
  )

  const applyPathInfo = extractJobPathInfo(applyMatch?.[1])
  const listingPathInfo = extractJobPathInfo(listing.sourceUrl)

  return buildApplyUrl({
    host: applyPathInfo.host || listingPathInfo.host,
    jobId: applyPathInfo.jobId || listingPathInfo.jobId,
    slug: applyPathInfo.slug || listingPathInfo.slug,
  }) || listing.applyUrl || listing.sourceUrl || null
}

export const hasOfficialJobsPageSignal = (html = '') => {
  const source = String(html ?? '')
  return /\bLennox\b/i.test(source)
    && (/\biCIMS_JobsTableRow\b/i.test(source) || /globalcareers-lennox\.icims\.com\/jobs\/search/i.test(source))
}

export const extractJobListings = (html = '') => getRows(html)
  .map((row) => {
    const linkMatch = row.match(/<a[^>]+href=["']([^"']*\/jobs\/\d+\/[^"'?#\s<>]+\/job[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i)
    const title = stripTags(linkMatch?.[2])
    const pathInfo = extractJobPathInfo(linkMatch?.[1])
    const locationInfo = parseLocation(getField(row, 'Job Locations') || getField(row, 'Location'))
    const jobId = getField(row, 'Job ID') || pathInfo.jobId

    if (!title || !jobId || !pathInfo.host || !pathInfo.slug || !locationInfo.location) {
      return null
    }

    return {
      title,
      company: COMPANY_NAME,
      department: getField(row, 'Category') || getField(row, 'Department'),
      location: locationInfo.location,
      city: locationInfo.city,
      country: locationInfo.country,
      jobId,
      requisitionId: getField(row, 'Requisition ID') || jobId,
      sourceUrl: buildDetailUrl(pathInfo),
      applyUrl: buildApplyUrl(pathInfo),
      employmentType: getField(row, 'Position Type') || getField(row, 'Position Type (Portal Searching)'),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDate(getField(row, 'Posted Date')),
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html = '', listing = {}) => {
  const lines = htmlToLines(html)
  const pathInfo = extractJobPathInfo(listing.sourceUrl)
  const locationInfo = parseLocation(
    getField(html, 'Job Locations')
      || extractLineAfterLabel(lines, 'Job Locations')
      || listing.location,
  )
  const { jobDescription, requiredSkills } = extractDescriptionFields(lines)

  return {
    title: stripTags(
      String(html ?? '').match(/<h1[^>]*class=["'][^"']*iCIMS_Header[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
    ) || listing.title || lines[0] || null,
    company: listing.company || COMPANY_NAME,
    department: getField(html, 'Category') || listing.department || null,
    location: locationInfo.location || listing.location || null,
    city: locationInfo.city || listing.city || null,
    country: locationInfo.country || listing.country || null,
    jobId: listing.jobId || pathInfo.jobId || null,
    requisitionId: getField(html, 'Requisition ID') || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || buildDetailUrl(pathInfo),
    applyUrl: extractApplyUrl(html, listing),
    employmentType: getField(html, 'Position Type') || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: listing.postingDate || null,
    closingDate: null,
    jobDescription: jobDescription || listing.jobDescription || null,
  }
}

const getNextPageUrl = (html = '', currentUrl = SEARCH_PAGE_URL) => {
  const nextMatch = String(html ?? '').match(
    /<a[^>]+(?:rel=["']next["']|aria-label=["']Next["'])[^>]+href=["']([^"']+)["']/i,
  ) || String(html ?? '').match(
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*Next\s*<\/a>/i,
  )

  return toAbsoluteUrl(nextMatch?.[1], currentUrl)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createLennoxScraper = ({
  fetchText = defaultFetchText,
  maxPages = Number.POSITIVE_INFINITY,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    maxPages: overrideMaxPages = maxPages,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const jobs = []
    const seenJobIds = new Set()
    let nextPageUrl = buildSearchUrl()
    let pageCount = 0

    while (nextPageUrl && pageCount < overrideMaxPages) {
      pageCount += 1

      const listingHtml = await fetchTextImpl(nextPageUrl)
      if (pageCount === 1 && !hasOfficialJobsPageSignal(listingHtml)) {
        throw new Error('Lennox careers page no longer matches the verified official public jobs surface')
      }

      for (const listing of extractJobListings(listingHtml)) {
        if (!listing.jobId || seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let job = listing
        try {
          const detailHtml = await fetchTextImpl(listing.sourceUrl)
          job = extractJobDetail(detailHtml, listing)
        } catch {
          job = listing
        }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })
      }

      const candidateNextPageUrl = getNextPageUrl(listingHtml, nextPageUrl)
      if (!candidateNextPageUrl || candidateNextPageUrl === nextPageUrl) {
        break
      }
      nextPageUrl = candidateNextPageUrl
    }

    return jobs
  },
})

export const run = async (options = {}) => createLennoxScraper().run(options)

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
