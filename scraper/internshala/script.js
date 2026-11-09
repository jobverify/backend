import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'internshala'
export const COMPANY_NAME = 'Internshala'
export const COMPANY = COMPANY_NAME
export const VERIFIED_ON = '2026-07-25'
export const OFFICIAL_SITE_URL = 'https://internshala.com/'
export const CAREERS_PAGE_URL = 'https://internshala.com/careers/'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeTextPreservingDashes = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const escapeForRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractMetaContent = (html = '', attr, key) => {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${escapeForRegex(key)}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    'i',
  )

  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1]) || null
}

const extractVisibleText = (html = '') => normalizeWhitespace(String(html ?? ''))

const decodeJsEscapes = (value = '') => String(value ?? '')
  .replace(/\\\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/\\\\\//g, '/')
  .replace(/\\\//g, '/')
  .replace(/\\"/g, '"')

const extractBalancedObject = (value = '', startIndex) => {
  if (startIndex < 0 || String(value ?? '')[startIndex] !== '{') return null

  let depth = 0

  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index]
    if (character === '{') depth += 1
    if (character === '}') depth -= 1

    if (depth === 0) {
      return value.slice(startIndex, index + 1)
    }
  }

  return null
}

const extractJsonLdEntries = (html = '') => {
  const matches = String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const entries = []

  for (const match of matches) {
    const candidate = match?.[1]?.trim()
    if (!candidate) continue

    try {
      entries.push(JSON.parse(candidate))
    } catch {
      // Skip malformed blobs and keep scanning for the public JobPosting payload.
    }
  }

  return entries
}

const readJobPosting = (html = '') => {
  for (const entry of extractJsonLdEntries(html)) {
    if (Array.isArray(entry)) {
      const posting = entry.find((item) => item?.['@type'] === 'JobPosting')
      if (posting) return posting
      continue
    }

    if (entry?.['@type'] === 'JobPosting') return entry
  }

  return null
}

const slugFromUrl = (value) => {
  try {
    const url = new URL(value)
    return url.pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const isInternshalaHostedUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://internshala.com'
  } catch {
    return false
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full-time' || normalized === 'full time' || normalized === 'full_time') return 'Full-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('part')) return 'Part-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (...parts) => {
  const values = parts
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return values.length ? values.join(', ') : null
}

const locationFromJobPosting = (jobPosting = {}) => {
  const address = jobPosting?.jobLocation?.address
    || jobPosting?.jobLocation?.[0]?.address
    || {}

  const city = normalizeWhitespace(address.addressLocality)
  const region = normalizeWhitespace(address.addressRegion)
  const country = normalizeWhitespace(address.addressCountry)

  return {
    location: normalizeLocation(city, region, country),
    city,
    country: country || null,
  }
}

const inferLocationFromTitle = (title = '') => {
  const match = normalizeWhitespace(title)?.match(/\bin\s+([^,]+?)(?:\s+at\s+|$)/i)
  const city = normalizeWhitespace(match?.[1])

  if (!city) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  return {
    location: normalizeLocation(city, 'India'),
    city,
    country: 'India',
  }
}

const extractApplyUrl = (html = '', detailUrl) => {
  const relativeUrl = String(html ?? '').match(/href=["'](\/student\/interstitial\/application\/[^"']+)["']/i)?.[1]
  if (!relativeUrl) return detailUrl

  try {
    return new URL(relativeUrl, OFFICIAL_SITE_URL).toString()
  } catch {
    return detailUrl
  }
}

const splitSkills = (value = '') =>
  normalizeWhitespace(value)
    ?.split(/\s*,\s*/)
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean)
  || []

const extractSkills = (html = '') => {
  const visibleText = extractVisibleText(html)
  const directMatch = visibleText.match(/Skills required:\s*([^]+?)(?:\s+(?:Apply now|Deadline:|Perks:|About the job)|$)/i)
  if (directMatch?.[1]) return splitSkills(directMatch[1])

  const ogDescription = extractMetaContent(html, 'property', 'og:description')
  const ogMatch = ogDescription?.match(/Skills required:\s*(.+)$/i)
  return splitSkills(ogMatch?.[1])
}

const extractExperience = (html = '', fallbackExperience) => {
  const visibleText = extractVisibleText(html)
  const match = visibleText.match(/Experience:\s*([^]+?)(?:\s+(?:Deadline:|Skills required:|Apply now)|$)/i)
  return normalizeWhitespace(match?.[1]) || normalizeWhitespace(fallbackExperience) || null
}

const extractClosingDate = (html = '') => {
  const visibleText = extractVisibleText(html)
  const match = visibleText.match(/Deadline:\s*([0-9:-]+\s+[0-9:]+|[0-9:-]+\s*[0-9:]*)/i)
  return normalizeWhitespace(match?.[1]) || null
}

const extractJobDescription = (html = '', jobPosting = null) => {
  const ogDescription = extractMetaContent(html, 'property', 'og:description')
  if (ogDescription) return ogDescription

  const description = stripTags(jobPosting?.description)
  if (description) return description

  return extractMetaContent(html, 'name', 'description')
}

const buildFallbackJob = ({ categoryName, item }) => {
  const jobId = slugFromUrl(item.link) || normalizeWhitespace(item.title)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    title: normalizeTextPreservingDashes(item.title),
    company: COMPANY,
    department: normalizeWhitespace(categoryName),
    location: null,
    city: null,
    country: null,
    jobId,
    requisitionId: jobId,
    sourceUrl: item.link,
    applyUrl: item.link,
    employmentType: normalizeEmploymentType(item.type),
    experienceRequired: normalizeWhitespace(item.experience) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const canonicalUrl = page.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || null

  return extractTitle(page) === 'Internships | Jobs | Trainings & Placement Guarantee Courses | Post a Job'
    && (!canonicalUrl || /^https:\/\/internshala\.com\/careers\/?$/i.test(canonicalUrl))
    && /\bwe are hiring\b/i.test(page)
    && /\bview openings\b/i.test(page)
    && page.includes('careerCategories')
}

export const extractCareerCategories = (html = '') => {
  const decodedPage = decodeJsEscapes(String(html ?? ''))
  const marker = '"careerCategories":'
  const markerIndex = decodedPage.indexOf(marker)
  if (markerIndex === -1) return {}

  const objectStart = decodedPage.indexOf('{', markerIndex + marker.length)
  const objectText = extractBalancedObject(decodedPage, objectStart)
  if (!objectText) return {}

  try {
    return JSON.parse(objectText)
  } catch {
    return {}
  }
}

export const extractJobFromDetailPage = ({
  categoryName,
  item,
  detailUrl,
  detailHtml,
}) => {
  if (!detailHtml) return buildFallbackJob({ categoryName, item })

  const jobPosting = readJobPosting(detailHtml)
  const fallbackJob = buildFallbackJob({ categoryName, item })
  const detailTitle = extractTitle(detailHtml)
  const postingLocation = locationFromJobPosting(jobPosting || {})
  const inferredLocation = inferLocationFromTitle(detailTitle)
  const location = postingLocation.location || inferredLocation.location || fallbackJob.location
  const city = postingLocation.city || inferredLocation.city || fallbackJob.city
  const country = postingLocation.country || inferredLocation.country || fallbackJob.country

  return {
    ...fallbackJob,
    title: normalizeWhitespace(jobPosting?.title) || fallbackJob.title,
    department: normalizeWhitespace(categoryName) || fallbackJob.department,
    location,
    city,
    country,
    sourceUrl: detailUrl,
    applyUrl: extractApplyUrl(detailHtml, detailUrl),
    employmentType: normalizeEmploymentType(jobPosting?.employmentType || item.type) || fallbackJob.employmentType,
    experienceRequired: extractExperience(detailHtml, item.experience),
    requiredSkills: extractSkills(detailHtml),
    postingDate: normalizeWhitespace(jobPosting?.datePosted) || null,
    closingDate: extractClosingDate(detailHtml),
    jobDescription: extractJobDescription(detailHtml, jobPosting),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInternshalaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Internshala careers page changed materially')
    }

    const careerCategories = extractCareerCategories(careersHtml)
    const categoryEntries = Object.entries(careerCategories)

    if (categoryEntries.length === 0) {
      throw new Error('The verified Internshala careers page no longer exposes the public careerCategories payload')
    }

    const scrapedAt = now()
    const jobs = []

    for (const [categoryName, items] of categoryEntries) {
      for (const item of Array.isArray(items) ? items : []) {
        if (!item?.title || !item?.link) continue

        let job = buildFallbackJob({ categoryName, item })

        if (isInternshalaHostedUrl(item.link)) {
          try {
            const detailHtml = await fetchText(item.link)
            job = extractJobFromDetailPage({
              categoryName,
              item,
              detailUrl: item.link,
              detailHtml,
            })
          } catch {
            job = buildFallbackJob({ categoryName, item })
          }
        }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt,
        })
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createInternshalaScraper().run(options)

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
