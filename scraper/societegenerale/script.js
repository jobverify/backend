import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { collectSocieteGenerale } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.societegenerale.com'
export const CAREER_PAGE_URL = `${BASE_URL}/en/Technical/all-job-offers`

const COMPANY_NAME = 'Societe Generale'
const SOURCE = 'societegenerale'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_DETAIL_CONCURRENCY = 12

const CONTRACT_PATTERNS = [
  'Apprenticeship',
  'Fixed term contract',
  'Permanent contract',
  'Trainee',
  'Contractor / Temp',
  'Summer Job',
  'Internship',
  'International Volunteer Program',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&gt;/gi, '>')
  .replace(/&lt;/gi, '<')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const contractPattern = CONTRACT_PATTERNS.map((value) => escapeRegExp(value)).join('|')

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const slashMatch = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractLocationCity = (location) => /^India$/i.test(normalizeWhitespace(location) || '')
  ? null : normalizeWhitespace(location)?.split(',')[0] || null

const resolvePositiveInteger = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const throwIfAborted = (signal) => {
  if (!signal?.aborted) return
  throw signal.reason || new DOMException('The operation was aborted', 'AbortError')
}

const mapWithConcurrency = async (items, limit, iteratee) => {
  const concurrency = Math.max(1, Number.isInteger(limit) ? limit : 1)
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
}

const normalizeEmploymentType = (contractType) => {
  const normalized = normalizeWhitespace(contractType)?.toLowerCase() || ''
  if (!normalized) return null
  if (normalized === 'permanent contract') return 'Full-time'
  if (normalized === 'fixed term contract' || normalized === 'contractor / temp') return 'Contract'
  if (
    normalized === 'apprenticeship'
    || normalized === 'trainee'
    || normalized === 'summer job'
    || normalized === 'internship'
    || normalized === 'international volunteer program'
  ) return 'Internship'
  return normalizeWhitespace(contractType)
}

const extractProfileParagraphs = (html) => {
  const section = extractFirst(
    /<h[1-6][^>]*>\s*Profile required\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6]\b|$)/i,
    html,
  )

  return [...String(section ?? '').matchAll(/<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

const extractSectionText = (html, heading) => {
  const pattern = new RegExp(
    `<h[1-6][^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[1-6]>([\\s\\S]*?)(?=<h[1-6]\\b|$)`,
    'i',
  )
  const section = extractFirst(pattern, html)
  if (!section) return null

  const parts = [...String(section).matchAll(/<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return parts.join(' ') || null
}

const parseListingMeta = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(
    new RegExp(`^((?:.*?,\\s*)?India)\\s+(${contractPattern})\\s+(.+)$`, 'i'),
  )

  if (!match) return null

  return {
    location: normalizeWhitespace(match[1]),
    contractType: normalizeWhitespace(match[2]),
    department: normalizeWhitespace(match[3]),
  }
}

export const extractSearchResults = (html) => {
  const anchorPattern = /<a[^>]+href=["']([^"']*\/job-offers\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  const jobs = []
  const matches = [...String(html ?? '').matchAll(anchorPattern)]

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const sourceUrl = toAbsoluteUrl(match[1])
    const jobId = normalizeWhitespace(
      extractFirst(/-([A-Z0-9]{5,})-en(?:[/?#]|$)/, sourceUrl || ''),
    )
    const title = stripTags(match[2])
    const start = match.index + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index : start + 500
    const metaText = stripTags(String(html).slice(start, end))
    const meta = parseListingMeta(metaText)

    if (!sourceUrl || !jobId || !title || !meta?.location) continue

    jobs.push({
      title,
      company: COMPANY_NAME,
      department: meta.department,
      location: meta.location,
      city: extractLocationCity(meta.location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(meta.contractType),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a[^>]+href=["']([^"']*socgen\.taleo\.net[^"']*)["'][^>]*>\s*Apply/i, html),
  ) || listing.applyUrl || listing.sourceUrl || null
  const location = normalizeWhitespace(
    extractFirst(new RegExp(`((?:[A-Za-z .'-]+),\\s*India)\\s+(?:${contractPattern})`, 'i'), stripTags(html)),
  ) || listing.location || null
  const profileParagraphs = extractProfileParagraphs(html)
  const responsibilities = extractSectionText(html, 'Responsibilities')
  const profileRequired = extractSectionText(html, 'Profile required')
  const whyJoinUs = extractSectionText(html, 'Why join us')
  const businessInsight = extractSectionText(html, 'Business insight')
  const diversity = extractSectionText(html, 'Diversity and Inclusion')
  const jobId = normalizeWhitespace(
    extractFirst(/Reference\s+([A-Z0-9]+)/i, stripTags(html)),
  ) || normalizeWhitespace(extractFirst(/[?&]job=([A-Z0-9]+)/i, applyUrl || '')) || listing.jobId || null

  return {
    title: stripTags(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)) || listing.title || null,
    company: COMPANY_NAME,
    department: stripTags(extractFirst(/<div[^>]*class=["'][^"']*department[^"']*["'][^>]*>([\s\S]*?)<\/div>/i, html))
      || listing.department
      || null,
    location,
    city: extractLocationCity(location) || listing.city || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    employmentType: normalizeEmploymentType(
      extractFirst(new RegExp(`\\b(${contractPattern})\\b`, 'i'), stripTags(html)),
    ) || listing.employmentType || null,
    experienceRequired: null,
    minimumQualification: profileParagraphs[0] || null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: toIsoDate(extractFirst(/Publication date\s+(\d{4}\/\d{2}\/\d{2})/i, stripTags(html))) || listing.postingDate || null,
    closingDate: null,
    jobDescription: [
      responsibilities,
      profileRequired,
      whyJoinUs,
      businessInsight,
      diversity,
    ].filter(Boolean).join(' ') || null,
    remoteStatus: normalizeWhitespace(extractFirst(/\b(Hybrid|Remote|On-site)\b/i, stripTags(html))) || listing.remoteStatus || null,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  signal,
  timeoutMs: 15000,
  includeResponseMetadata: true,
  attempts: 1,
  redirect: 'error',
})

export const createSocieteGeneraleScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  detailConcurrency = resolvePositiveInteger(config.detailConcurrency, DEFAULT_DETAIL_CONCURRENCY),
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const limit = Number.isInteger(options.maxJobs) ? options.maxJobs : maxJobs
    return collectSocieteGenerale({ fetchText, signal:options.signal, maxJobs:limit,
      maxRequests:options.maxRequests, detailConcurrency,
      legacyListings:extractSearchResults, legacyDetail:extractJobDetail })
  },
})

export const run = async (options = {}) => createSocieteGeneraleScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Societe Generale scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
