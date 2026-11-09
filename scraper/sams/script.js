import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import SAMS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const STATE_ONLY_LOCATION_PATTERN =
  /\b(andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|orissa|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal)\b/i

export const SOURCE = SAMS_CATALOG.source
export const COMPANY = SAMS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SAMS_CATALOG.officialBrandName
export const VERIFIED_ON = SAMS_CATALOG.verifiedOn
export const PROVIDER_METADATA = SAMS_CATALOG
export const HOMEPAGE_URL = SAMS_CATALOG.officialHomepageUrl
export const CAREERS_PAGE_URL = SAMS_CATALOG.companyCareerPage
export const FILTER_SCRIPT_URL = SAMS_CATALOG.jobsListScriptUrl
export const JOBS_FRAGMENT_URL = SAMS_CATALOG.jobsFragmentUrl

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(`${normalized} UTC`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const normalizeLocationLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bnepal\b/i.test(normalized) || /\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /\b(remote|hybrid)\b/i.test(normalized)) return null

  const firstSegment = normalizeWhitespace(normalized.split(',')[0])
  if (!firstSegment) return null
  if (STATE_ONLY_LOCATION_PATTERN.test(firstSegment)) return null
  return normalizeCity(firstSegment)
}

const looksLikeIndiaListing = ({ title, location } = {}) => {
  const haystack = [normalizeWhitespace(title), normalizeWhitespace(location)]
    .filter(Boolean)
    .join(' ')

  if (!haystack) return false
  if (/\bindia\b/i.test(haystack)) return true
  if (/\bnepal\b/i.test(haystack)) return false
  return true
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractFirstMatch = (pattern, html) =>
  normalizeWhitespace(String(html ?? '').match(pattern)?.[1])

const extractDescriptionSection = (html) => {
  const section = String(html ?? '').match(/<div[^>]+class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  if (!section) return null

  const lines = decodeHtmlEntities(section)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  const descriptionLines = []
  for (const line of lines) {
    if (/^\d+\.\s*(location|reference|application process|contact information)\s*:/i.test(line)) break
    descriptionLines.push(line)
  }

  return normalizeWhitespace(descriptionLines.join(' ')) || null
}

const extractDetailedContentLocation = (html) => {
  const text = stripTags(html)
  const matches = [...String(text ?? '').matchAll(
    /(?:^|\s)\d+\.\s*LOCATION:\s*(.+?)(?=\s+\d+\.\s*(?:REFERENCE|APPLICATION PROCESS|CONTACT INFORMATION)\s*:|$)/gi,
  )]

  return normalizeWhitespace(matches.at(-1)?.[1]) || null
}

export const hasOfficialJobsShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*SAMS List: Premium Social Sector Jobs\s*<\/title>/i.test(page)
    && /Search SAMS Jobs/i.test(page)
    && /Premium Social Sector Jobs Awarded to SAMS/i.test(page)
    && /id=["']JobsList["']/i.test(page)
    && /\/Scripts\/filter\.js/i.test(page)
}

export const hasJobsListScriptSignal = (js = '') => {
  const script = String(js ?? '')

  return /url:\s*["']\/Jobs\/JobsList["']/i.test(script)
    && /pageNumber\s*=\s*1/i.test(script)
    && /append\("PageNumber",\s*pageNumber\)/i.test(script)
}

export const extractJobCards = (fragmentHtml = '') => {
  const cards = [...String(fragmentHtml ?? '').matchAll(
    /<div class="col">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi,
  )]

  if (cards.length === 0) {
    throw new Error('Verified SAMS jobs fragment no longer exposes the expected job cards')
  }

  return cards
    .map((match) => {
      const [, href, cardHtml] = match
      const sourceUrl = toAbsoluteUrl(href)
      const title = extractFirstMatch(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i, cardHtml)
      const listItems = extractListItems(cardHtml)
      const hiringOrganization = listItems[0] || null
      const employmentType = normalizeEmploymentType(listItems[1])
      const department = listItems[2] || null
      const rawLocation = listItems[3] || null
      const location = normalizeLocationLabel(rawLocation)
      const jobId = normalizeWhitespace(sourceUrl?.split('/').filter(Boolean).at(-1))

      if (!title || !sourceUrl || !jobId || !location) return null
      if (!looksLikeIndiaListing({ title, location })) return null

      return {
        title,
        company: COMPANY,
        department,
        location,
        city: deriveCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: /\bremote\b/i.test(location)
          ? 'Remote'
          : /\bhybrid\b/i.test(location)
            ? 'Hybrid'
            : null,
        hiringOrganization,
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const detailApplyUrl = extractFirstMatch(
    /<a[^>]+class=["'][^"']*btn btn-primary[^"']*["'][^>]+href=["']([^"']+)["']/i,
    html,
  )
  const detailLocation = extractFirstMatch(/<p class="fw-bold">Location:<\/p>\s*<p>([\s\S]*?)<\/p>/i, html)
  const detailedContentLocation = extractDetailedContentLocation(html)
  const detailedLocationLabel = detailedContentLocation || detailLocation || listing.location
  const location = normalizeLocationLabel(detailedLocationLabel)
  const employmentType = normalizeEmploymentType(
    extractFirstMatch(/<p class="fw-bold">Working:<\/p>\s*<p>([\s\S]*?)<\/p>/i, html) || listing.employmentType,
  )
  const requisitionId = extractFirstMatch(/REFERENCE:\s*([A-Z0-9-]+)/i, html) || listing.requisitionId
  const closingDate = toIsoDate(extractFirstMatch(/Application ends:\s*<span>([\s\S]*?)<\/span>/i, html))

  return {
    ...listing,
    location: location || listing.location || null,
    city: deriveCity(location || listing.location),
    country: 'India',
    requisitionId,
    applyUrl: detailApplyUrl || listing.applyUrl || listing.sourceUrl || null,
    employmentType,
    closingDate,
    jobDescription: extractDescriptionSection(html) || listing.jobDescription || null,
    remoteStatus: /\bremote\b/i.test(location || '')
      ? 'Remote'
      : /\bhybrid\b/i.test(location || '')
        ? 'Hybrid'
        : listing.remoteStatus || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultPostForm = (url, body = {}) => fetchTextWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Referer: CAREERS_PAGE_URL,
    Origin: HOMEPAGE_URL.replace(/\/$/, ''),
  },
  body: new URLSearchParams(body),
  label: SOURCE,
  timeoutMs: 20000,
})

export const createSamsScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    postForm = defaultPostForm,
    now = defaultNow,
  } = {}) {
    const shellHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialJobsShellSignal(shellHtml)) {
      throw new Error('Verified SAMS jobs shell changed materially')
    }

    const scriptHtml = await fetchText(FILTER_SCRIPT_URL)
    if (!hasJobsListScriptSignal(scriptHtml)) {
      throw new Error('Verified SAMS filter script changed materially')
    }

    const fragmentHtml = await postForm(JOBS_FRAGMENT_URL, {})
    let listings
    try {
      listings = extractJobCards(fragmentHtml)
    } catch {
      throw new Error('Verified SAMS jobs fragment changed materially')
    }

    const scrapedAt = now()
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSamsScraper(options).run(options)

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
