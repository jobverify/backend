import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TECHNIANS_SOFTECH_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const PAGE_SIZE = 100
const INDIA_LOCATION_HINTS = [
  'india',
  'gurgaon',
  'gurugram',
  'mumbai',
  'bengaluru',
  'bangalore',
  'pune',
  'hyderabad',
  'delhi',
  'noida',
  'chennai',
  'kolkata',
  'kochi',
  'ahmedabad',
  'remote',
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value = '') => {
  const normalized = decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const text = normalizeWhitespace(normalized)
  return text || null
}

const normalizeUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/z$|[+-]\d{2}:\d{2}$/i.test(normalized)) return normalized
  return `${normalized}Z`
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
})

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'UND_ERR_CONNECT_TIMEOUT'
    || /\bconnect timeout\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Current Job Openings in Gurgaon, Mumbai - Nians\s*<\/title>/i.test(page)
    && text.includes('Technians is now Nians')
    && text.includes('Current Job Openings')
}

export const buildJobsApiUrl = (pageNumber = 1) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('per_page', String(PAGE_SIZE))
  url.searchParams.set('page', String(pageNumber))
  url.searchParams.set('_embed', 'wp:term')
  return url.toString()
}

const getEmbeddedTerms = (posting = {}, taxonomyName) => {
  const groups = Array.isArray(posting?._embedded?.['wp:term'])
    ? posting._embedded['wp:term']
    : []
  const wantedTaxonomy = normalizeWhitespace(taxonomyName)?.toLowerCase()
  const seen = new Set()
  const values = []

  for (const group of groups) {
    if (!Array.isArray(group)) continue

    for (const term of group) {
      const taxonomy = normalizeWhitespace(term?.taxonomy)?.toLowerCase()
      const name = normalizeWhitespace(term?.name)
      if (!taxonomy || taxonomy !== wantedTaxonomy || !name || seen.has(name)) continue
      seen.add(name)
      values.push(name)
    }
  }

  return values
}

const isIndiaLocationTerm = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return false
  return INDIA_LOCATION_HINTS.some((hint) => normalized.includes(hint))
}

const extractLocationData = (posting = {}) => {
  const rawLocations = getEmbeddedTerms(posting, 'job-location').filter(isIndiaLocationTerm)
  if (rawLocations.length === 0) return null

  const hasAnyRemote = rawLocations.some((value) => /remote/i.test(value))
  const hasOnlyRemote = rawLocations.every((value) => /remote/i.test(value))
  const hasExplicitIndiaInEveryTerm = rawLocations.every((value) => /\bindia\b/i.test(value))

  if (!hasAnyRemote && !hasExplicitIndiaInEveryTerm) {
    const city = rawLocations.join(' / ')
    return {
      location: `${city}, India`,
      city,
      remoteStatus: 'On-site',
    }
  }

  const formattedLocations = rawLocations.map((value) => {
    if (/remote/i.test(value) || /\bindia\b/i.test(value)) return value
    return `${value}, India`
  })

  return {
    location: formattedLocations.join(' / '),
    city: hasAnyRemote ? null : rawLocations.join(' / '),
    remoteStatus: hasOnlyRemote ? 'Remote' : hasAnyRemote ? null : 'On-site',
  }
}

const mapJob = (posting = {}, scrapedAt) => {
  const title = normalizeWhitespace(posting.title?.rendered)
  const sourceUrl = normalizeUrl(posting.link)
  const jobId = normalizeWhitespace(posting.id)
  const locationData = extractLocationData(posting)

  if (!title || !sourceUrl || !jobId || !locationData?.location) {
    throw new Error('Technians Softech jobs API no longer exposes the verified public job fields')
  }

  return {
    title,
    company: COMPANY,
    department: getEmbeddedTerms(posting, 'job-type')[0] || null,
    location: locationData.location,
    city: locationData.city,
    country: 'India',
    link: sourceUrl,
    applyUrl: sourceUrl,
    sourceUrl,
    source: SOURCE,
    jobId,
    requisitionId: jobId,
    employmentType: null,
    postingDate: normalizePostingDate(posting.date_gmt ?? posting.date),
    closingDate: null,
    jobDescription: stripTags(posting.content?.rendered),
    remoteStatus: locationData.remoteStatus,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    scrapedAt,
  }
}

export const run = async ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  fetchBrowserText,
  now = () => new Date().toISOString(),
} = {}) => {
  try {
    let careersHtml

    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!fetchBrowserText || !hasConnectTimeoutFailure(error)) {
        throw error
      }

      careersHtml = await fetchBrowserText(CAREERS_URL)
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Technians Softech verified Nians jobs archive changed materially')
    }

    const scrapedAt = now()
    const jobs = []
    let pageNumber = 1

    while (true) {
      const payload = await fetchJson(buildJobsApiUrl(pageNumber))
      if (!Array.isArray(payload)) {
        throw new Error('Technians Softech jobs api no longer returns an array')
      }

      for (const posting of payload) {
        if (normalizeWhitespace(posting?.status).toLowerCase() !== 'publish') continue
        if (posting?.type && normalizeWhitespace(posting.type).toLowerCase() !== 'job') continue

        const locationData = extractLocationData(posting)
        if (!locationData) continue

        jobs.push(mapJob(posting, scrapedAt))
      }

      if (payload.length < PAGE_SIZE) break
      pageNumber += 1
    }

    return jobs
  } catch (error) {
    if (hasConnectTimeoutFailure(error)) {
      return []
    }

    throw error
  }
}

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
