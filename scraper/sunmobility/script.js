import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.sunmobility.com/career/'
export const LINKEDIN_JOBS_URL = 'https://www.linkedin.com/jobs/sun-mobility-jobs-worldwide?f_C=13365611&trk=top-card_top-card-primary-button-top-card-primary-cta&position=1&pageNum=0'

const SOURCE = 'sunmobility'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const parseLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const detailLocationFromJsonLd = (jobPosting) => {
  const address = jobPosting?.jobLocation?.address || {}
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    normalizeWhitespace(address.addressCountry),
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country: address.addressCountry === 'IN'
      ? 'India'
      : normalizeWhitespace(address.addressCountry),
  }
}

const parseJobPostingJsonLd = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed blobs until the public JobPosting payload is found.
    }
  }

  return null
}

export const pageIndicatesLinkedinJobs = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return (
    normalized.includes('linkedin.com/jobs/sun-mobility-jobs-worldwide')
    && normalized.includes('careers@sunmobility.com')
  )
}

// Parse fields within a single card. A full-page expression with overlapping
// wildcards can backtrack indefinitely when a new-date card lacks the old class.
export const extractSearchResults = (html) => {
  const page = String(html ?? '')
  const cards = [...page.matchAll(/<div\b[^>]*>/gi)]
    .filter((match) => /\bclass=["'][^"']*\bjob-search-card\b[^"']*["']/i.test(match[0]))
    .map((match) => ({
      index: match.index,
      jobId: match[0].match(/\bdata-entity-urn=["']urn:li:jobPosting:([0-9]+)["']/i)?.[1],
    }))
  const jobs = []

  for (let index = 0; index < cards.length; index += 1) {
    const { jobId } = cards[index]
    const card = page.slice(cards[index].index, cards[index + 1]?.index ?? page.length)
    const rawTitle = card.match(/<h3\b[^>]*class=["'][^"']*\bbase-search-card__title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1]
    const rawCompany = card.match(/<h4\b[^>]*class=["'][^"']*\bbase-search-card__subtitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1]
    const rawLocation = card.match(/<span\b[^>]*class=["'][^"']*\bjob-search-card__location\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
    const linkTag = card.match(/<a\b[^>]*class=["'][^"']*\bbase-card__full-link\b[^"']*["'][^>]*>/i)?.[0]
    const rawHref = linkTag?.match(/\bhref=["']([^"']+)["']/i)?.[1]
    const dateTag = card.match(/<time\b[^>]*class=["']job-search-card__listdate(?:--new)?["'][^>]*>/i)?.[0]
    const postingDate = normalizeWhitespace(dateTag?.match(/\bdatetime=["']([^"']+)["']/i)?.[1])
    const title = stripTags(rawTitle)
    const company = stripTags(rawCompany)
    const sourceUrl = normalizeWhitespace(rawHref)
    const locationData = parseLocation(stripTags(rawLocation))

    if (locationData.country !== 'India') continue
    if (!title || !jobId || !sourceUrl || !postingDate) {
      throw new Error('Sun Mobility LinkedIn India job card no longer exposes the expected public fields')
    }

    jobs.push({
      title,
      company,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs
}

export const extractJobDetail = (html) => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return {}

  const locationData = detailLocationFromJsonLd(jobPosting)

  return {
    company: normalizeWhitespace(jobPosting?.hiringOrganization?.name) || null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(normalizeWhitespace(jobPosting?.description)) || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createSunMobilityScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const careersHtml = await fetchText(CAREER_PAGE_URL)

    if (!pageIndicatesLinkedinJobs(careersHtml)) {
      throw new Error('Sun Mobility careers page no longer exposes the expected LinkedIn jobs handoff')
    }

    const searchHtml = await fetchText(LINKEDIN_JOBS_URL)
    const listings = extractSearchResults(searchHtml)
    const enrichedJobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml)

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
      })
    }

    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createSunMobilityScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Sun Mobility India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
