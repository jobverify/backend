import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'

import { LINKEDIN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = LINKEDIN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LINKEDIN_JOBS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ROLE_URLS = PROVIDER_METADATA.verifiedRoleUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const normalizeQualification = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized[0].toUpperCase() + normalized.slice(1)
}

const parseSearchLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (parts.length === 0) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  if (parts.length === 1) {
    return {
      location: normalized,
      city: normalized,
      country: normalized === 'India' || CANONICAL_CITIES[normalized.toLowerCase().replace(/ metropolitan (region|area)$/, '')] && !/^(remote|none)$/i.test(normalized) ? 'India' : null,
    }
  }

  return {
    location: normalized,
    city: parts[0] || null,
    country: parts.at(-1) === 'India' ? 'India' : null,
  }
}

const detailLocationFromJsonLd = (jobPosting) => {
  const address = jobPosting?.jobLocation?.address || {}
  const locality = normalizeWhitespace(address.addressLocality)
  const region = normalizeWhitespace(address.addressRegion)
  const country = address.addressCountry === 'IN'
    ? 'India'
    : normalizeWhitespace(address.addressCountry)
  const parts = [locality, region, country].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: locality,
    country,
  }
}

const extractLocationFromTitleTag = (html = '') => {
  const rawLocation = normalizeWhitespace(
    String(html ?? '').match(/<title>\s*LinkedIn hiring[\s\S]*? in ([^|]+?) \| LinkedIn\s*<\/title>/i)?.[1],
  )

  if (!rawLocation) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = rawLocation.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)

  return {
    location: rawLocation,
    city: parts[0] || rawLocation,
    country: parts.at(-1) === 'India' ? 'India' : null,
  }
}

const selectRicherLocation = (primary, fallback) => {
  const primarySegments = primary?.location?.split(',').length ?? 0
  const fallbackSegments = fallback?.location?.split(',').length ?? 0
  return fallbackSegments > primarySegments ? fallback : primary
}

const parseJobPostingJsonLd = (html = '') => {
  const scripts = [...String(html ?? '').matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed or unrelated JSON-LD blocks until the public JobPosting payload is found.
    }
  }

  return null
}

const formatExperienceRequirement = (value) => {
  const months = Number.parseInt(value, 10)
  if (!Number.isFinite(months) || months <= 0) return null
  if (months < 12) return `${months}+ months`

  const years = months / 12
  const formatted = Number.isInteger(years)
    ? String(years)
    : years.toFixed(1).replace(/\.0$/, '')

  return `${formatted}+ years`
}

const extractSuggestedSkills = (rawDescription = '') => {
  const decoded = decodeHtml(String(rawDescription ?? ''))
  const section = decoded.match(/Suggested Skills[\s\S]*?(<ul[\s\S]*?<\/ul>)/i)?.[1]

  return [...String(section ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

const extractRemoteStatus = (jobDescription) => {
  const normalized = normalizeWhitespace(jobDescription)?.toLowerCase() || ''
  if (!normalized) return null
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (/\bremote\b/.test(normalized)) return 'Remote'
  if (/\bon-site\b|\bon site\b/.test(normalized)) return 'On-site'
  return null
}

const extractCriteriaValue = (html = '', label) => {
  const pattern = new RegExp(
    `<h3[^>]*>\\s*${escapeRegex(label)}\\s*<\\/h3>[\\s\\S]*?<span[^>]*description__job-criteria-text[^"]*"[^>]*>\\s*([\\s\\S]*?)\\s*<\\/span>`,
    'i',
  )

  return stripTags(String(html ?? '').match(pattern)?.[1])
}

export const hasVerifiedJobsPageSignal = (html = '') => {
  const page = String(html ?? ''), text = stripTags(page) || ''
  const legacyCanonical = /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.linkedin\.com\/jobs\/search["']/i.test(page)
  let currentScope = false
  const currentCanonical = /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/in\.linkedin\.com\/jobs\/jobs-in-india["']/i.test(page)
  try {
    const tag = [...page.matchAll(/<meta\b[^>]*>/gi)].find(m => /property=["']lnkd:url["']/.test(m[0]))?.[0]
    const url = new URL(decodeHtml(tag?.match(/content=["']([^"']+)["']/)?.[1] || ''))
    const selected = [...page.matchAll(/<input\b[^>]*>/gi)].some(m => /name=["']f_C["']/.test(m[0]) && /\bchecked\b/.test(m[0]) && /value=["']1337["']/.test(m[0]))
    currentScope = currentCanonical && url.origin === 'https://www.linkedin.com' && /^\/jobs\/search\/$/.test(url.pathname)
      && url.searchParams.get('f_C') === '1337' && url.searchParams.get('geoId') === '102713980' && selected
  } catch { /* A current alias without verified scope is not trusted. */ }
  return /<meta[^>]+name=["']linkedin:pageTag["'][^>]+content=["'][^"]*jserp/i.test(page)
    && (legacyCanonical || currentScope) && /jobs in India/i.test(text) && /LinkedIn/i.test(text)
}

export const extractSearchResults = (html = '') => {
  const page = String(html), jobs = []
  const cards = [...page.matchAll(/<div\b[^>]*>/gi)]
    .filter(m => /\bclass=["'][^"']*\bjob-search-card\b[^"']*["']/i.test(m[0]))
  for (let index = 0; index < cards.length; index++) {
    const opening = cards[index], card = page.slice(opening.index, cards[index + 1]?.index ?? page.length)
    const jobId = opening[0].match(/data-entity-urn=["']urn:li:jobPosting:(\d+)["']/)?.[1]
    const field = (tag, cls) => card.match(new RegExp('<' + tag + '\\b[^>]*class=["\\\'][^"\\\']*\\b' + cls + '\\b[^"\\\']*["\\\'][^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'))?.[1]
    const title = stripTags(field('h3', 'base-search-card__title'))
    const company = stripTags(field('h4', 'base-search-card__subtitle'))
    if (company !== COMPANY) continue
    const link = card.match(/<a\b[^>]*class=["'][^"']*\bbase-card__full-link\b[^"']*["'][^>]*>/)?.[0]
    const sourceUrl = normalizeWhitespace(link?.match(/href=["']([^"']+)["']/)?.[1])
    const dateTag = card.match(/<time\b[^>]*class=["']job-search-card__listdate(?:--new)?["'][^>]*>/)?.[0]
    const postingDate = normalizeWhitespace(dateTag?.match(/datetime=["']([^"']+)["']/)?.[1])
    const locationData = parseSearchLocation(stripTags(field('span', 'job-search-card__location')))
    let trustedUrl = false
    try { const parsed = new URL(sourceUrl); trustedUrl = parsed.protocol === 'https:' && /^(?:www|in)\.linkedin\.com$/.test(parsed.hostname)
      && parsed.pathname.startsWith('/jobs/view/') && parsed.pathname.endsWith('-' + jobId) } catch {}
    if (!jobId || !title || !postingDate || !locationData.location || !trustedUrl) throw new Error('LinkedIn current public job card fields or identity changed')
    if (jobs.some(job => job.jobId === jobId)) throw new Error('LinkedIn current public job inventory contains duplicate identities')
    jobs.push({ title, company, department: null, ...locationData, jobId, requisitionId: jobId,
      sourceUrl, applyUrl: sourceUrl, employmentType: null, experienceRequired: null, minimumQualification: null,
      preferredQualification: null, requiredSkills: [], postingDate, closingDate: null, jobDescription: null, remoteStatus: null })
  }
  return jobs
}

export const extractJobDetail = (html = '', listing = {}) => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) {
    throw new Error(`LinkedIn detail page no longer matches the verified public JobPosting shell: ${listing.sourceUrl || 'unknown'}`)
  }

  const title = normalizeWhitespace(jobPosting.title)
  const expectedTitle = normalizeWhitespace(listing.title)
  const company = normalizeWhitespace(jobPosting?.hiringOrganization?.name)
  const decodedDescription = decodeHtml(jobPosting.description)
  const jobDescription = stripTags(decodedDescription)
  const primaryLocation = detailLocationFromJsonLd(jobPosting)
  if (primaryLocation.country && primaryLocation.country !== 'India') throw new Error('LinkedIn public detail country conflicts with the India search scope')
  const locationData = selectRicherLocation(
    primaryLocation,
    extractLocationFromTitleTag(html),
  )
  const employmentType = normalizeEmploymentType(jobPosting.employmentType)
    || extractCriteriaValue(html, 'Employment type')
  const experienceRequired = formatExperienceRequirement(
    jobPosting?.experienceRequirements?.monthsOfExperience,
  )
  const minimumQualification = normalizeQualification(
    jobPosting?.educationRequirements?.credentialCategory,
  )
  const requiredSkills = extractSuggestedSkills(jobPosting.description)
  const remoteStatus = extractRemoteStatus(jobDescription)
  const postingDate = normalizeWhitespace(jobPosting.datePosted)?.slice(0, 10) || null

  if (
    !title
    || !expectedTitle
    || title !== expectedTitle
    || company !== COMPANY
    || !jobDescription
    || !locationData.location
  ) {
    throw new Error(`LinkedIn detail page no longer matches the verified public JobPosting shell: ${listing.sourceUrl || 'unknown'}`)
  }

  return {
    title,
    company,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType,
    experienceRequired,
    minimumQualification,
    postingDate,
    jobDescription,
    requiredSkills,
    remoteStatus,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createLinkedInScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    const read = async url => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const searchHtml = await read(LINKEDIN_JOBS_URL)
    if (!hasVerifiedJobsPageSignal(searchHtml)) {
      throw new Error('LinkedIn jobs search page no longer matches the verified public company-filtered shell')
    }

    const listings = extractSearchResults(searchHtml)
    const advertisedText = stripTags(searchHtml.match(/class=["']results-context-header__job-count["'][^>]*>([^<]*)/)?.[1])
    const advertisedCount = /^\d[\d,]*$/.test(advertisedText || "") ? Number(advertisedText.replaceAll(",", "")) : null
    if (!listings.length && advertisedCount > 0) throw new Error("LinkedIn advertised job inventory could not be parsed")
    if (listings.length === 0) {
      return []
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const scrapedAt = now()
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await read(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      if (detail.country !== 'India') throw new Error('LinkedIn detail India country is unverified')

      jobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
        source: SOURCE,
        link: listing.applyUrl || listing.sourceUrl,
        scrapedAt,
      })
    }

    return jobs.map(job => ({ ...job, ...((selectedListings.length < listings.length || (advertisedCount !== null && advertisedCount !== listings.length)) ? { sourceListingComplete: false } : {}) }))
  },
})

export const run = async (options = {}) => createLinkedInScraper().run(options)

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
