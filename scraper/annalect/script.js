import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const LINKEDIN_COMPANY_PAGE_URL = 'https://in.linkedin.com/company/omnicomglobalsolutions'
export const LINKEDIN_JOBS_API_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=105373375&geoId=102713980'

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

const parseCriteria = (html) => {
  const pairs = [...String(html ?? '').matchAll(
    /<li class="description__job-criteria-item">[\s\S]*?<h3 class="description__job-criteria-subheader">\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<span class="description__job-criteria-text description__job-criteria-text--criteria">\s*([\s\S]*?)\s*<\/span>[\s\S]*?<\/li>/gi,
  )]

  const map = {}
  for (const [, label, value] of pairs) {
    map[stripTags(label)] = stripTags(value)
  }
  return map
}

const buildDetailApiUrl = (jobId) => `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`

export const buildSearchUrl = ({ start = 0 } = {}) =>
  `${LINKEDIN_JOBS_API_URL}&start=${Math.max(0, Number(start) || 0)}`

export const pageIndicatesOgsCompany = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return (
    normalized.includes('omnicomglobalsolutions')
    && normalized.includes('linkedin')
  )
}

export const extractSearchResults = (html) => {
  const source = String(html ?? '')
  const cardStarts = [...source.matchAll(/<div\b[^>]*\bdata-entity-urn="urn:li:jobPosting:([0-9]+)"[^>]*>/gi)]

  return cardStarts.map((match, index) => {
    const card = source.slice(match.index, cardStarts[index + 1]?.index ?? source.length)
    const openingTag = match[0]
    if (!/\bbase-card\b/.test(openingTag) || !/\bjob-search-card\b/.test(openingTag)) return null

    const anchorTag = card.match(/<a\b[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*>/i)?.[0]
    const rawHref = anchorTag?.match(/\bhref="([^"]+)"/i)?.[1]
    const rawTitle = card.match(/<h3\b[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1]
    const subtitle = card.match(/<h4\b[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i)?.[1]
    const rawCompany = subtitle?.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    const rawLocation = card.match(/<span\b[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
    const timeTag = card.match(/<time\b[^>]*class="[^"]*job-search-card__listdate(?:--new)?[^"]*"[^>]*>/i)?.[0]
    const postingDate = timeTag?.match(/\bdatetime="([^"]+)"/i)?.[1]
    const sourceUrl = normalizeWhitespace(rawHref)?.replace(/&amp;/g, '&')
    const title = stripTags(rawTitle)
    const company = stripTags(rawCompany)
    const locationData = parseLocation(stripTags(rawLocation))

    if (!title || !postingDate || !sourceUrl || locationData.country !== 'India') return null

    return {
      title,
      company,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId: match[1],
      requisitionId: match[1],
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
}

export const extractJobDetail = (html) => {
  const title = stripTags(
    normalizeWhitespace(
      String(html ?? '').match(/<h2 class="top-card-layout__title[^"]*">([\s\S]*?)<\/h2>/i)?.[1],
    ),
  )
  const company = stripTags(
    normalizeWhitespace(
      String(html ?? '').match(/<a class="topcard__org-name-link[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/i)?.[1],
    ),
  )
  const location = stripTags(
    normalizeWhitespace(
      String(html ?? '').match(/<span class="topcard__flavor topcard__flavor--bullet">\s*([\s\S]*?)\s*<\/span>/i)?.[1],
    ),
  )
  const locationData = parseLocation(location)
  const descriptionHtml = String(html ?? '').match(
    /<div class="show-more-less-html__markup[\s\S]*?">([\s\S]*?)<\/div>\s*<button class="show-more-less-html__button/mi,
  )?.[1]
  const criteria = parseCriteria(html)

  return {
    title: title || null,
    company: company || null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    department: criteria['Job function'] || null,
    employmentType: criteria['Employment type'] || null,
    experienceRequired: criteria['Seniority level'] || null,
    preferredQualification: criteria.Industries || null,
    jobDescription: stripTags(descriptionHtml) || null,
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

export const createAnnalectScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : 5,
  pageSize = Number.isInteger(config.pageSize) ? config.pageSize : 10,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL)

    if (!pageIndicatesOgsCompany(companyHtml)) {
      throw new Error('Annalect LinkedIn company page no longer matches the expected Omnicom Global Solutions public page')
    }

    const listings = []
    const seenIds = new Set()

    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize
      const searchHtml = await fetchText(buildSearchUrl({ start }))
      const pageListings = extractSearchResults(searchHtml)
      let newCount = 0

      for (const listing of pageListings) {
        if (seenIds.has(listing.jobId)) continue
        seenIds.add(listing.jobId)
        listings.push(listing)
        newCount += 1
      }

      if (pageListings.length === 0 || newCount === 0) {
        break
      }

      if (maxJobs && listings.length >= maxJobs) {
        break
      }
    }

    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      const detailHtml = await fetchText(buildDetailApiUrl(listing.jobId))
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
      source: 'annalect',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAnnalectScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Annalect scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'annalect')
    console.log('DB result:', result)
    process.exit(0)
  }
}
