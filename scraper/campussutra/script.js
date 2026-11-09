import {createCurrentLinkedInProfileScraper} from "../academoredutech/currentPublic.js"
export const LINKEDIN_COMPANY_PAGE_URL = 'https://in.linkedin.com/company/campus-sutra'
export const LINKEDIN_INDIA_JOBS_URL = 'https://www.linkedin.com/jobs/search/?f_C=3032227&geoId=102713980'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const parseLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  const parts = normalized?.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) || []

  return {
    location: normalized,
    city: parts[0] || null,
    country: parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null,
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized?.includes('contract')) return 'Contract'
  if (normalized?.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const extractJobPosting = (html) => {
  const matches = String(html ?? '').matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi)

  for (const [, rawJson] of matches) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Ignore unrelated or malformed structured data in public job pages.
    }
  }

  return null
}

export const pageIndicatesCampusSutraCompany = (html) => {
  const normalized = String(html ?? '').toLowerCase()
  return normalized.includes('campus sutra | linkedin')
    && normalized.includes('urn:li:organization:3032227')
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractLinkedInResultCards = (html) => String(html ?? '')
  .split(/<li\b[^>]*>/i)
  .slice(1)
  .map((section) => section.split(/<\/li>/i)[0] || '')
  .filter((section) => (
    /\bjob-search-card\b/i.test(section)
    && /data-entity-urn="urn:li:jobPosting:/i.test(section)
  ))

export const extractSearchResults = (html) => extractLinkedInResultCards(html)
  .map((cardHtml) => {
    const jobId = normalizeWhitespace(extractFirst(
      /data-entity-urn="urn:li:jobPosting:([0-9]+)"/i,
      cardHtml,
    ))
    const href = extractFirst(
      /<a\b(?=[^>]*\bbase-card__full-link\b)[^>]*\bhref="([^"]+)"/i,
      cardHtml,
    )
    const rawTitle = extractFirst(
      /<h3\b(?=[^>]*\bbase-search-card__title\b)[^>]*>\s*([\s\S]*?)\s*<\/h3>/i,
      cardHtml,
    )
    const rawCompany = normalizeWhitespace(extractFirst(
      /<h4\b(?=[^>]*\bbase-search-card__subtitle\b)[^>]*>\s*([\s\S]*?)\s*<\/h4>/i,
      cardHtml,
    ))
    const rawLocation = extractFirst(
      /<span\b(?=[^>]*\bjob-search-card__location\b)[^>]*>\s*([\s\S]*?)\s*<\/span>/i,
      cardHtml,
    )
    const postingDate = extractFirst(
      /<time\b(?=[^>]*\bjob-search-card__listdate(?:--new)?\b)[^>]*\bdatetime="([^"]+)"/i,
      cardHtml,
    )
    const location = parseLocation(rawLocation)
    const sourceUrl = normalizeWhitespace(href)
    const title = normalizeWhitespace(rawTitle)

    if (!jobId || !sourceUrl || !title || location.country !== 'India') return null

    return {
      title,
      company: normalizeWhitespace(rawCompany) || 'Campus Sutra',
      department: null,
      ...location,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(postingDate),
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html) => {
  const job = extractJobPosting(html)
  if (!job) return {}

  return {
    employmentType: normalizeEmploymentType(job.employmentType),
    jobDescription: normalizeWhitespace(job.description),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createCampusSutraScraper = defaults => createCurrentLinkedInProfileScraper("campussutra", defaults)

export const run = async (options = {}) => createCampusSutraScraper().run(options)
