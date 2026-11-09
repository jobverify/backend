import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'aranca'
export const COMPANY = 'Aranca'
export const VERIFIED_ON = '2026-07-30'
export const CAREERS_URL = 'https://www.aranca.com/careers.php'
export const JOBS_BOARD_URL = 'https://www2.aranca.com/careers/'
export const DETAIL_URL_PATTERN = 'https://www2.aranca.com/careers/jobdetails/job/{numeric_id}'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-public-paginated-jobs-board'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Thursday, July 30, 2026 that https://www.aranca.com/careers.php was the live first-party Aranca careers page, that its public calls to action Explore Open Positions and Current Openings both handed candidates to the public jobs board at https://www2.aranca.com/careers/, and that the paginated board publicly exposed 17 current openings including 16 India-located roles across Mumbai and Gurgaon plus a separate California sales role. This scraper validates the verified first-party handoff, walks the public pagination links, and returns the current India jobs from the visible Aranca detail pages such as Senior Analyst - Private Credit and Senior Consultant/Assistant Manager - Financial Modeling.'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const INDIA_LOCATION_PATTERN =
  /\b(mumbai|gurgaon|gurugram|bangalore|bengaluru|pune|hyderabad|noida|delhi|chennai|kolkata|india)\b/i

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

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value = '') =>
  normalizeWhitespace(
    decodeEntities(String(value))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const firstMatch = (source, patterns) => {
  for (const pattern of patterns) {
    const match = String(source ?? '').match(pattern)
    const value = normalizeWhitespace(match?.[1])
    if (value) return value
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = JOBS_BOARD_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const normalizeComparableText = (value) =>
  normalizeWhitespace(value)
    ?.replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase() || ''

const titlesMatch = (left, right) => {
  const leftKey = normalizeComparableText(left)
  const rightKey = normalizeComparableText(right)
  return Boolean(leftKey && rightKey && leftKey === rightKey)
}

const extractNumericIdFromUrl = (value) => {
  try {
    return new URL(String(value ?? '')).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.split(/[\/,]/)[0]?.trim() || null
}

const appendIndia = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'
  if (/,?\s*India$/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractDescriptionBlock = (html = '') =>
  String(html).match(
    /<div[^>]*class="[^"]*\bentry-content\b[^"]*\bclear\b[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*\babout-companyblock\b[^"]*"[^>]*>/i,
  )?.[1] || ''

export const extractOfficialJobsBoardUrl = (html = '') =>
  toAbsoluteUrl(
    String(html).match(/<a[^>]+href="([^"]*www2\.aranca\.com\/careers\/?[^"]*)"/i)?.[1],
    CAREERS_URL,
  )

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Join Our Team\s*\|\s*Exciting Career Opportunities Await\s*<\/title>/i.test(page)
    && /Join Our Global Community of Problem Solvers!/i.test(text)
    && /\bExplore Open Positions\b/i.test(text)
    && /\bCurrent Openings\b/i.test(text)
    && normalizeComparableUrl(extractOfficialJobsBoardUrl(page))
      === normalizeComparableUrl(JOBS_BOARD_URL)
}

export const extractPaginationUrls = (html = '') => {
  const urls = [...String(html ?? '').matchAll(/<a[^>]+href="([^"]*\/careers\/page\/\d+[^"]*)"/gi)]
    .map((match) => toAbsoluteUrl(match[1], JOBS_BOARD_URL))
    .filter(Boolean)

  return [...new Set(urls)].sort((left, right) => {
    const leftPage = Number.parseInt(left.match(/\/page\/(\d+)/i)?.[1] || '0', 10)
    const rightPage = Number.parseInt(right.match(/\/page\/(\d+)/i)?.[1] || '0', 10)
    return leftPage - rightPage
  })
}

export const hasJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title[^>]*>\s*Current Openings\s*\|\s*Aranca Careers\s*<\/title>/i.test(page)
    && extractBoardListings(page).length > 0
}

export const extractBoardListings = (html = '') => {
  const listings = []
  const articlePattern = /<article\b[\s\S]*?<\/article>/gi

  for (const match of String(html ?? '').matchAll(articlePattern)) {
    const articleHtml = match[0]
    const detailUrl = toAbsoluteUrl(
      articleHtml.match(
        /<h2[^>]*class="[^"]*\bentry-title\b[^"]*"[^>]*>[\s\S]*?<a href="([^"]+)"/i,
      )?.[1],
      JOBS_BOARD_URL,
    )
    const title = firstMatch(articleHtml, [
      /<h2[^>]*class="[^"]*\bentry-title\b[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
    ])
    const excerpt = firstMatch(articleHtml, [
      /<div[^>]*class="[^"]*\bast-excerpt-container\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ])
    const location = firstMatch(articleHtml, [
      /fa-map-marker[\s\S]*?<\/i>\s*([^<]+?)\s*<\/li>/i,
    ])
    const department = firstMatch(articleHtml, [
      /<span[^>]*class="[^"]*\bjobdeptspan\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /fa-sitemap[\s\S]*?<\/i>\s*([^<]+?)\s*<\/a>/i,
    ])
    const jobId = firstMatch(articleHtml, [
      /<span[^>]*class="[^"]*\blistjid\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<p[^>]*class="[^"]*\bjobid\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    ])
    const openingsText = firstMatch(articleHtml, [
      /fa-users[\s\S]*?<\/i>\s*([^<]+?)\s*<\/li>/i,
    ])

    if (!detailUrl || !title || !location || !jobId) continue

    listings.push({
      title,
      location,
      department,
      jobId,
      detailUrl,
      excerpt,
      openingsText,
      numericId: extractNumericIdFromUrl(detailUrl),
    })
  }

  return listings
}

export const isIndiaLocation = (value = '') => {
  const location = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!location) return false
  if (/\b(california|united states|usa|united kingdom|uk)\b/i.test(location)) return false
  return INDIA_LOCATION_PATTERN.test(location)
}

export const extractJobDetail = (html = '') => {
  const sourceUrl = firstMatch(html, [
    /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i,
    /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i,
  ])
  const title = firstMatch(html, [
    /<h1[^>]*class="[^"]*\bposttitlejob\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)\s*\|\s*Aranca Careers<\/title>/i,
  ])
  const department = firstMatch(html, [
    /<p[^>]*class="[^"]*\bjobdept_for_email\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    /fa-sitemap[\s\S]*?<\/i>\s*([^<]+?)\s*<\/a>/i,
  ])
  const location = firstMatch(html, [
    /fa-map-marker[\s\S]*?<\/i>\s*([^<]+?)\s*<\/li>/i,
  ])
  const jobId = firstMatch(html, [
    /<p[^>]*class="[^"]*\bjobid\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    /<li>\s*<span>\s*Job#\s*<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
  ])
  const rawExperience = firstMatch(html, [
    /fa-briefcase[\s\S]*?<\/i>\s*([^<]+?)\s*<\/li>/i,
  ])
  const jobDescription = stripTags(extractDescriptionBlock(html))

  return {
    title,
    department,
    location,
    city: extractCity(location),
    country: isIndiaLocation(location) ? 'India' : null,
    jobId,
    requisitionId: jobId,
    sourceUrl: sourceUrl ? normalizeComparableUrl(sourceUrl) : null,
    applyUrl: sourceUrl ? normalizeComparableUrl(sourceUrl) : null,
    employmentType: null,
    experienceRequired: normalizeExperience(rawExperience),
    jobDescription,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const buildNormalizedJob = ({
  listing,
  detail,
  scrapedAt,
}) => {
  const detailSourceUrl = detail.sourceUrl || listing.detailUrl

  if (!detailSourceUrl) return null
  if (!titlesMatch(detail.title, listing.title)) return null
  if (detail.jobId && listing.jobId && !titlesMatch(detail.jobId, listing.jobId)) return null

  const location = detail.location || listing.location
  if (!isIndiaLocation(location)) return null

  return {
    title: detail.title,
    company: COMPANY,
    department: detail.department || listing.department || null,
    location: appendIndia(location),
    city: detail.city || extractCity(location),
    country: 'India',
    jobId: detail.jobId || listing.jobId,
    requisitionId: detail.requisitionId || detail.jobId || listing.jobId,
    sourceUrl: detailSourceUrl,
    applyUrl: detail.applyUrl || detailSourceUrl,
    employmentType: detail.employmentType || null,
    experienceRequired: detail.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: detail.jobDescription || listing.excerpt || null,
    remoteStatus: null,
    source: SOURCE,
    link: detail.applyUrl || detailSourceUrl,
    scrapedAt,
  }
}

export const createArancaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Aranca verified official careers page changed materially')
    }

    const jobsBoardUrl = extractOfficialJobsBoardUrl(careersHtml)
    if (normalizeComparableUrl(jobsBoardUrl) !== normalizeComparableUrl(JOBS_BOARD_URL)) {
      throw new Error('Aranca verified official careers page changed materially')
    }

    const firstBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasJobsBoardSignal(firstBoardHtml)) {
      throw new Error('Aranca verified public jobs board changed materially')
    }

    const boardPages = [firstBoardHtml]
    for (const pageUrl of extractPaginationUrls(firstBoardHtml)) {
      const pageHtml = await fetchText(pageUrl)
      if (!hasJobsBoardSignal(pageHtml)) {
        throw new Error('Aranca verified public jobs board changed materially')
      }
      boardPages.push(pageHtml)
    }

    const listings = boardPages
      .flatMap((pageHtml) => extractBoardListings(pageHtml))
      .filter((listing, index, collection) =>
        collection.findIndex((candidate) => candidate.detailUrl === listing.detailUrl) === index)

    const indiaListings = listings.filter((listing) => isIndiaLocation(listing.location))
    if (indiaListings.length === 0) {
      throw new Error('Aranca public jobs board returned no India listings')
    }

    const scrapedAt = now()
    const jobs = []

    for (const listing of indiaListings) {
      const detailHtml = await fetchText(listing.detailUrl)
      const detail = extractJobDetail(detailHtml)
      const job = buildNormalizedJob({
        listing,
        detail,
        scrapedAt,
      })

      if (job) jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('Aranca public jobs board returned no valid India jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createArancaScraper(options).run(options)

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
