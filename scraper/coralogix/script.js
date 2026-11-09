import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import CORALOGIX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(remote,\s*india|india|gurugram|gurgaon|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|delhi|noida)\b/i

export const PROVIDER_METADATA = CORALOGIX_CATALOG
export const SOURCE = CORALOGIX_CATALOG.source
export const COMPANY = CORALOGIX_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = CORALOGIX_CATALOG.officialBrandName
export const CAREERS_URL = CORALOGIX_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
  signal,
})

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const isIndiaLabelOrUrl = (label = '', url = '') =>
  INDIA_LOCATION_PATTERN.test(String(label ?? '')) || INDIA_LOCATION_PATTERN.test(String(url ?? ''))

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^remote,\s*india$/i.test(normalized)) return 'Remote, India'
  if (/^gurugram$/i.test(normalized)) return 'Gurugram, India'
  if (/^gurgaon$/i.test(normalized)) return 'Gurgaon, India'
  return normalized
}

const locationToCity = (location) => {
  if (!location) return null
  if (/^remote\b/i.test(location)) return 'Remote'
  return normalizeWhitespace(location.split(',')[0] || location)
}

const inferRemoteStatus = (location) => {
  if (/remote/i.test(location)) return 'Remote'
  if (/hybrid/i.test(location)) return 'Hybrid'
  return 'On-site'
}

const extractHeading = (html = '') =>
  stripTags(String(html ?? '').match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] || '')

const extractMetaLine = (html = '') => {
  const page = String(html ?? '')
  const location = normalizeLocation(
    stripTags(page.match(/<span[^>]*class=["'][^"']*comeet-position-location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ''),
  )
  const employmentType = normalizeWhitespace(
    stripTags(page.match(/<span[^>]*class=["'][^"']*comeet-position-employmenttype[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ''),
  )
  const seniority = normalizeWhitespace(
    stripTags(page.match(/<span[^>]*class=["'][^"']*comeet-position-experiencelevel[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ''),
  )

  if (location && employmentType && seniority) {
    return { location, employmentType, seniority }
  }

  const text = stripTags(page) || ''
  const match = text.match(
    /\b(Remote,\s*India|Gurugram|Gurgaon|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Chennai|Delhi|Noida)\s*[·•]\s*(Full-time|Part-time|Contract|Temporary|Internship)\s*[·•]\s*([A-Za-z/-]+)/i,
  )

  if (!match) return null

  return {
    location: normalizeLocation(match[1]),
    employmentType: normalizeWhitespace(match[2]),
    seniority: normalizeWhitespace(match[3]),
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page)?.toLowerCase() || ''

  return /<title>\s*careers\s*-\s*coralogix\s*\(we(?:&#039;|&rsquo;|&#8217;|&#x27;|')re hiring!\)\s*<\/title>/i.test(page)
    && normalized.includes('join the team who is building the future of observability')
    && normalized.includes('open positions')
    && /href=["'][^"']*\/careers\/co\/[^"']+["']/i.test(page)
}

export const extractIndiaJobUrls = (html = '') => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']*\/careers\/co\/[^"']+\/all\/?)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const url = toAbsoluteUrl(match[1])
    const label = stripTags(match[2]) || ''
    if (!url || !isIndiaLabelOrUrl(label, url) || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

const extractJobIdFromUrl = (url) => {
  try {
    return new URL(url).pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9.]+/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
  } catch {
    return null
  }
}

const extractDetailFragments = (html = '') => {
  const truncated = String(html ?? '').split(/Apply for this position/i)[0]
  return [...truncated.matchAll(/<(p|h2|h3|h4|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripTags(match[2]))
    .filter(Boolean)
}

const buildJobDescription = (html = '', heading = null, metaLine = null) => {
  const fragments = extractDetailFragments(html).filter((value) =>
    value !== heading
    && value !== metaLine
    && !/^about the position$/i.test(value)
    && !/^requirements$/i.test(value)
  )

  return normalizeWhitespace(fragments.join(' '))
}

export const extractJobFromDetail = (url, html = '') => {
  const title = extractHeading(html)
  const meta = extractMetaLine(html)
  const jobId = extractJobIdFromUrl(url)

  if (!title || !meta?.location || !jobId || !INDIA_LOCATION_PATTERN.test(meta.location)) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: meta.location,
    city: locationToCity(meta.location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: url,
    applyUrl: url,
    employmentType: meta.employmentType,
    experienceRequired: meta.seniority,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(
      html,
      title,
      `${meta.location} · ${meta.employmentType} · ${meta.seniority}`,
    ),
    remoteStatus: inferRemoteStatus(meta.location),
  }
}

export const createCoralogixScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    const listingHtml = await fetchText(CAREERS_URL, { signal })
    if (!hasOfficialCareersSignal(listingHtml)) {
      throw new Error('Verified Coralogix careers page changed materially')
    }

    const indiaJobUrls = extractIndiaJobUrls(listingHtml)
    if (indiaJobUrls.length === 0) {
      throw new Error('Verified Coralogix careers page no longer exposes trusted public India role links')
    }

    const jobs = []

    for (const url of indiaJobUrls) {
      const detailHtml = await fetchText(url, { signal })
      const job = extractJobFromDetail(url, detailHtml)
      if (job) jobs.push(job)
    }

    if (!jobs.length) {
      throw new Error('Verified Coralogix India role detail pages changed materially')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createCoralogixScraper().run(options)

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
