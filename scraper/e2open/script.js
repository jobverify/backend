import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.e2open.com/company/careers/'
export const JOBS_PAGE_URL = 'https://www.e2open.com/jobs/'
export const VERIFIED_CAREERS_PAGE_TITLE = 'Supply Chain Careers with e2open - Supply Chain Software'
export const VERIFIED_JOBS_PAGE_TITLE = 'Jobs - Supply Chain Software | Strategic Digital Supply Chain | e2open'

const SOURCE = 'e2open'
const COMPANY = 'e2open'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const CAREERS_HERO_PATTERN = /Unlock your potential at e2open/i
const OPEN_POSITIONS_PATTERN = /View our open positions/i
const SEARCH_JOBS_PATTERN = /Search e2open Jobs/i
const JOBS_HEADING_PATTERN = /Employment opportunities at e2open/i
const JOBS_FILTERS_PATTERN = /Filter by:\s*[\s\S]*All departments[\s\S]*All locations/i
const NO_PUBLIC_JOBS_PATTERN = /Sorry,\s*no jobs were found for that criteria\./i
const JOB_LINK_TEXT_PATTERN = /View our open positions|Search e2open Jobs/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
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

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, JOBS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

const isJobPostingType = (value) => toArray(value)
  .some((entry) => /jobposting/i.test(String(entry ?? '')))

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(
    typeof value === 'object'
      ? value?.name || value?.value || value?.addressCountry
      : value,
  )

  if (!normalized) return null
  if (/^(in|india)$/i.test(normalized)) return 'India'
  if (/^(us|usa|united states|united states of america)$/i.test(normalized)) return 'United States'
  return normalized
}

const isIndiaCountry = (value) => normalizeCountry(value) === 'India'

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(toArray(value)[0])
  if (!normalized) return null

  const titleCased = normalized
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  if (/^full time$/i.test(titleCased)) return 'Full-time'
  if (/^part time$/i.test(titleCased)) return 'Part-time'

  return titleCased
}

const normalizeSkills = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => normalizeWhitespace(
      typeof entry === 'object' ? entry?.name || entry?.value : entry,
    )).filter(Boolean))]
  }

  const normalized = normalizeWhitespace(value)
  return normalized ? [normalized] : []
}

const extractIdentifier = (posting) => {
  const candidate = normalizeWhitespace(
    posting?.identifier?.value
    || posting?.identifier?.name
    || posting?.requisitionId
    || posting?.jobId,
  )

  if (candidate) return candidate

  const sourceUrl = toAbsoluteUrl(posting?.url || posting?.applyUrl)
  if (!sourceUrl) return null

  try {
    const pathname = new URL(sourceUrl).pathname.replace(/\/+$/u, '')
    const slug = pathname.split('/').filter(Boolean).pop()
    return normalizeWhitespace(slug)
  } catch {
    return null
  }
}

const collectJobPostingNodes = (value, results = []) => {
  if (Array.isArray(value)) {
    for (const entry of value) collectJobPostingNodes(entry, results)
    return results
  }

  if (!value || typeof value !== 'object') {
    return results
  }

  if (isJobPostingType(value['@type'])) {
    results.push(value)
  }

  for (const entry of Object.values(value)) {
    collectJobPostingNodes(entry, results)
  }

  return results
}

const extractJsonLdBlocks = (html) => [...String(html ?? '').matchAll(
  /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
)].map((match) => match[1].trim()).filter(Boolean)

const parseJsonLd = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const extractAddress = (value) => {
  const address = value?.address || value
  return {
    city: normalizeWhitespace(address?.addressLocality),
    state: normalizeWhitespace(address?.addressRegion),
    country: normalizeCountry(address?.addressCountry),
  }
}

const pickIndiaAddress = (posting) => {
  const locations = toArray(posting?.jobLocation)
    .map((location) => extractAddress(location))
    .filter((location) => location.city || location.state || location.country)

  const indiaLocation = locations.find((location) => isIndiaCountry(location.country))
  if (indiaLocation) return indiaLocation

  return null
}

const pickApplicantCountry = (posting) => {
  const requirements = toArray(posting?.applicantLocationRequirements)

  for (const requirement of requirements) {
    const country = normalizeCountry(
      requirement?.address?.addressCountry
      || requirement?.addressCountry
      || requirement?.name
      || requirement,
    )
    if (country) return country
  }

  return null
}

const buildLocation = ({ city, state, country, remote = false }) => {
  if (remote && country === 'India') {
    return 'Remote, India'
  }

  return [city, state, country].filter(Boolean).join(', ') || null
}

const normalizeJobPosting = (posting) => {
  const sourceUrl = toAbsoluteUrl(posting?.url || posting?.applyUrl) || JOBS_PAGE_URL
  const identifier = extractIdentifier(posting)
  const indiaAddress = pickIndiaAddress(posting)
  const applicantCountry = pickApplicantCountry(posting)
  const isRemote = /telecommute/i.test(String(posting?.jobLocationType ?? ''))

  let city = indiaAddress?.city ?? null
  let state = indiaAddress?.state ?? null
  let country = indiaAddress?.country ?? null

  if (!country && isRemote && isIndiaCountry(applicantCountry)) {
    country = 'India'
  }

  if (country !== 'India') {
    return null
  }

  return {
    title: normalizeWhitespace(posting?.title),
    company: normalizeWhitespace(posting?.hiringOrganization?.name) || COMPANY,
    department: normalizeWhitespace(posting?.occupationalCategory),
    location: buildLocation({ city, state, country, remote: isRemote }),
    city,
    state,
    country,
    jobId: identifier,
    requisitionId: identifier,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeEmploymentType(posting?.employmentType),
    experienceRequired: normalizeWhitespace(posting?.experienceRequirements),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: normalizeSkills(posting?.skills),
    postingDate: normalizeWhitespace(posting?.datePosted),
    closingDate: normalizeWhitespace(posting?.validThrough),
    jobDescription: stripHtml(posting?.description),
  }
}

export const extractJobsPageLinks = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => ({
    href: toAbsoluteUrl(match[1]),
    text: stripHtml(match[2]),
  }))
  .filter((link) => link.href === JOBS_PAGE_URL && JOB_LINK_TEXT_PATTERN.test(link.text || ''))
  .map((link) => link.href)

export const hasVerifiedCareersSurface = (html) => {
  const page = String(html ?? '')

  return extractTitle(page) === VERIFIED_CAREERS_PAGE_TITLE
    && CAREERS_HERO_PATTERN.test(page)
    && OPEN_POSITIONS_PATTERN.test(page)
    && SEARCH_JOBS_PATTERN.test(page)
    && extractJobsPageLinks(page).length >= 2
}

export const hasVerifiedJobsSurface = (html) => {
  const page = String(html ?? '')

  return extractTitle(page) === VERIFIED_JOBS_PAGE_TITLE
    && JOBS_HEADING_PATTERN.test(page)
    && JOBS_FILTERS_PATTERN.test(page)
}

export const pageShowsNoPublicJobs = (html) => NO_PUBLIC_JOBS_PATTERN.test(String(html ?? ''))

export const extractEmbeddedJobPostings = (html) => extractJsonLdBlocks(html)
  .map(parseJsonLd)
  .filter(Boolean)
  .flatMap((block) => collectJobPostingNodes(block))
  .map(normalizeJobPosting)
  .filter((job) => job?.title && job?.location)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createE2OpenScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasVerifiedCareersSurface(careersHtml)) {
      throw new Error('e2open careers page no longer matches the verified official public surface')
    }

    const jobsHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasVerifiedJobsSurface(jobsHtml)) {
      throw new Error('e2open jobs page no longer matches the verified official public surface')
    }

    if (pageShowsNoPublicJobs(jobsHtml)) {
      return []
    }

    const jobs = extractEmbeddedJobPostings(jobsHtml)
    if (jobs.length === 0) {
      throw new Error('e2open jobs page no longer matches the supported public listings surface')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl || JOBS_PAGE_URL,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createE2OpenScraper().run()

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
