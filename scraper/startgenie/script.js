import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'startgenie'
export const COMPANY = 'StartGenie'
export const COMPANY_DOMAIN = 'startgenie.co.in'
export const HOMEPAGE_URL = 'https://startgenie.co.in/'
export const CAREERS_URL = 'https://startgenie.co.in/careers/'
export const JOB_SITEMAP_URL = 'https://startgenie.co.in/awsm_job_openings-sitemap.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
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
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/figure|\/video)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|ul|ol|section|article|main|h[1-6]|figure|video)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(decodeHtmlEntities(value), HOMEPAGE_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== COMPANY_DOMAIN) return null
    return url.toString()
  } catch {
    return null
  }
}

const uniqueStrings = (values = []) => {
  const seen = new Set()
  const results = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(normalized)
  }

  return results
}

const normalizeLocationToken = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^bengaluru$/i.test(normalized)) return 'Bangalore'
  return normalized
}

const isRemoteToken = (value) => /^remote$/i.test(String(value ?? ''))
const isHybridToken = (value) => /^hybrid$/i.test(String(value ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*StartGenie:\s*Digital Marketing Agency in India\s*<\/title>/i.test(page)
    && /StartGenie is a digital marketing agency offering social media marketing, website\s*&(?:amp;)?\s*app development, and paid ads to grow businesses online\./i.test(page)
    && /href=["']https:\/\/startgenie\.co\.in\/careers\/["'][^>]*>\s*Careers\s*</i.test(page)
    && text.includes('Transform Your Brand')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers\s*-\s*StartGenie\s*<\/title>/i.test(page)
    && /wp-job-openings\/assets\/css\/style\.min\.css/i.test(page)
    && text.includes('Be part of our mission')
    && text.includes("We're seeking passionate and talented individuals to help us achieve our goals.")
}

const extractSpecTerms = (html, specClass) => {
  const block = String(html ?? '').match(
    new RegExp(
      `<div class="awsm-job-specification-item awsm-job-specification-${specClass}">([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )?.[1]

  return uniqueStrings(
    Array.from(
      String(block ?? '').matchAll(/<span class="awsm-job-specification-term">([\s\S]*?)<\/span>/gi),
      (match) => match[1],
    ),
  ).map(normalizeLocationToken)
}

export const extractJobCards = (html) => {
  const page = String(html ?? '')
  const starts = [...page.matchAll(/<div class="awsm-job-listing-item([^"]*)" id="awsm-grid-item-(\d+)">/gi)]

  return starts.map((match, index) => {
    const start = match.index ?? 0
    const end = starts[index + 1]?.index ?? page.length
    const block = page.slice(start, end)
    const classes = normalizeWhitespace(match[1]) || ''
    const jobId = normalizeWhitespace(match[2])
    const sourceUrl = toAbsoluteUrl(block.match(/<a href="([^"]+)" class="awsm-job-item">/i)?.[1])
    const title = normalizeWhitespace(
      block.match(/<h2 class="awsm-job-post-title">([\s\S]*?)<\/h2>/i)?.[1],
    )
    const category = extractSpecTerms(block, 'job-category')[0] || null
    const locations = extractSpecTerms(block, 'job-location')

    return {
      jobId,
      title,
      sourceUrl,
      category,
      locations,
      isExpired: /\bawsm-job-expired-item\b/i.test(classes),
    }
  }).filter((card) => card.jobId && card.title && card.sourceUrl)
}

export const extractSitemapUrls = (xml) =>
  uniqueStrings(
    Array.from(
      String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi),
      (match) => match[1],
    ),
  )

const findJobPosting = (value) => {
  if (!value) return null

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findJobPosting(entry)
      if (found) return found
    }
    return null
  }

  if (typeof value !== 'object') return null
  if (normalizeWhitespace(value['@type']) === 'JobPosting') return value

  for (const entry of Object.values(value)) {
    const found = findJobPosting(entry)
    if (found) return found
  }

  return null
}

export const extractJobPostingJson = (html) => {
  for (const match of String(html ?? '').matchAll(
    /<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1])
      const jobPosting = findJobPosting(parsed)
      if (jobPosting) return jobPosting
    } catch {
      continue
    }
  }

  return null
}

const hasExpiredDetailSignal = (html) =>
  /Sorry!\s*This job has expired\./i.test(String(html ?? ''))

const hasPublicApplySurface = (html) =>
  /id=["']awsm-application-form["']/i.test(String(html ?? ''))

const extractDetailSpecs = (html) => ({
  category: extractSpecTerms(html, 'job-category')[0] || null,
  employmentType: extractSpecTerms(html, 'job-type')[0] || null,
  locations: extractSpecTerms(html, 'job-location').map(normalizeLocationToken),
})

const extractJsonLdLocations = (jobPosting = {}) => {
  const locations = Array.isArray(jobPosting.jobLocation)
    ? jobPosting.jobLocation
    : [jobPosting.jobLocation]

  return uniqueStrings(
    locations.map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      if (typeof entry.address === 'string') return entry.address
      return entry.address?.addressLocality || entry.address?.addressRegion || null
    }),
  ).map(normalizeLocationToken)
}

const buildLocationFields = (locationTerms = []) => {
  const normalizedLocations = uniqueStrings(locationTerms.map(normalizeLocationToken))
  const hasRemote = normalizedLocations.some(isRemoteToken)
  const hasHybrid = normalizedLocations.some(isHybridToken)
  const city = normalizedLocations.find((value) => !isRemoteToken(value) && !isHybridToken(value)) || null
  const remoteStatus = hasHybrid ? 'Hybrid' : hasRemote ? 'Remote' : null

  if (city && hasHybrid) {
    return {
      location: `${city}, Hybrid, India`,
      locations: normalizedLocations,
      city,
      country: 'India',
      remoteStatus,
    }
  }

  if (city && hasRemote) {
    return {
      location: `${city}, Remote, India`,
      locations: normalizedLocations,
      city,
      country: 'India',
      remoteStatus,
    }
  }

  if (city) {
    return {
      location: `${city}, India`,
      locations: normalizedLocations,
      city,
      country: 'India',
      remoteStatus,
    }
  }

  if (hasHybrid && hasRemote) {
    return {
      location: 'Hybrid / Remote, India',
      locations: normalizedLocations,
      city: 'Remote',
      country: 'India',
      remoteStatus,
    }
  }

  if (hasHybrid) {
    return {
      location: 'Hybrid, India',
      locations: normalizedLocations,
      city: 'Remote',
      country: 'India',
      remoteStatus,
    }
  }

  if (hasRemote) {
    return {
      location: 'Remote, India',
      locations: normalizedLocations,
      city: 'Remote',
      country: 'India',
      remoteStatus,
    }
  }

  return null
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(
    page.match(/<h1 class="entry-title awsm-jobs-single-title">([\s\S]*?)<\/h1>/i)?.[1],
  )
  const specs = extractDetailSpecs(page)
  const jobPosting = extractJobPostingJson(page)

  if (
    !title
    || !jobPosting
    || hasExpiredDetailSignal(page)
    || !hasPublicApplySurface(page)
    || !specs.employmentType
  ) {
    throw new Error('StartGenie detail page no longer matches the verified public job surface')
  }

  const locationFields = buildLocationFields([
    ...specs.locations,
    ...extractJsonLdLocations(jobPosting),
    ...listing.locations,
  ])
  const jobDescription = stripTags(jobPosting.description)

  if (!locationFields || !jobDescription) {
    throw new Error('StartGenie detail page no longer matches the verified public job surface')
  }

  return {
    jobId: normalizeWhitespace(listing.jobId),
    requisitionId: normalizeWhitespace(listing.jobId),
    title: normalizeWhitespace(jobPosting.title) || title,
    company: COMPANY,
    department: specs.category || normalizeWhitespace(listing.category),
    location: locationFields.location,
    locations: locationFields.locations,
    city: locationFields.city,
    country: locationFields.country,
    link: normalizeWhitespace(listing.sourceUrl),
    applyUrl: normalizeWhitespace(listing.sourceUrl),
    sourceUrl: normalizeWhitespace(listing.sourceUrl),
    employmentType: specs.employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(jobPosting.datePosted),
    closingDate: null,
    jobDescription,
    remoteStatus: locationFields.remoteStatus,
  }
}

export const createStartGenieScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('StartGenie homepage no longer matches the verified official first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('StartGenie careers page no longer matches the verified official public jobs surface')
    }

    const sitemapXml = await fetchText(JOB_SITEMAP_URL)
    const sitemapUrls = new Set(extractSitemapUrls(sitemapXml))
    if (sitemapUrls.size === 0) {
      throw new Error('StartGenie job sitemap no longer exposes trusted first-party job detail URLs')
    }

    const listingCards = extractJobCards(careersHtml)
    const activeCards = listingCards.filter(
      (card) => !card.isExpired && sitemapUrls.has(card.sourceUrl),
    )

    if (activeCards.length === 0) {
      throw new Error('StartGenie careers page no longer exposes trusted active job cards')
    }

    const scrapedAt = now()
    const jobs = []

    for (const card of activeCards) {
      const detailHtml = await fetchText(card.sourceUrl)
      const detail = extractJobDetail(detailHtml, card)

      jobs.push({
        ...detail,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createStartGenieScraper().run(options)

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
