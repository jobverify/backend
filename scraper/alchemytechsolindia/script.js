import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { runDeclaredAlchemy } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://alchemytechsol.com/career/'
export const LEGACY_CAREERS_URL = 'https://www.alchemytechsol.com/eng/careernew.html'
export const JOB_LISTINGS_AJAX_URL = 'https://alchemytechsol.com/jm-ajax/get_listings/'

const SOURCE = 'alchemytechsolindia'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const stripHtmlComments = (html = '') => String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

export const pageIndicatesOfficialCareersSurface = (html) => {
  const page = String(html ?? '')
  return (
    /<title>\s*Career\s*-\s*Alchemy Techsol\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/alchemytechsol\.com\/career\/["']/i.test(page)
    && /Join Our Team/i.test(page)
    && /Build Your Future with Alchemy Techsol/i.test(page)
    && /Current Openings/i.test(page)
    && /class=["'][^"']*\bjob_listings\b[^"']*["']/i.test(page)
    && /job_manager_ajax_filters/i.test(page)
    && /jm-ajax/i.test(page)
    && /%%endpoint%%/i.test(page)
    && /wp-job-manager/i.test(page)
  )
}

export const extractCurrentOpenings = (html) => {
  if (!pageIndicatesOfficialCareersSurface(html)) {
    throw new Error('Alchemy Techsol careers page no longer matches the verified official careers surface')
  }

  const currentOpeningsSection = String(html ?? '').split(/<h1[^>]*>\s*Current Openings\s*<\/h1>/i)[1] || ''

  return [...currentOpeningsSection.matchAll(
    /<h2[^>]*>\s*([^<]+?)\s*<\/h2>[\s\S]*?<p>\s*([^<]+?)\s*<\/p>[\s\S]*?<p>\s*Location:\s*([^<]+?)\s*<\/p>[\s\S]*?(?:View Position|<span>\s*View Position\s*<\/span>)/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      description: normalizeWhitespace(match[2]),
      location: normalizeWhitespace(match[3]),
    }))
    .filter((job) => job.title && job.location)
}

const isIndiaOpening = (opening) => /india|bengaluru|bangalore|pune|hyderabad|gurgaon|gurugram|mumbai|chennai|noida|delhi/i
  .test(`${opening?.location || ''}`)

export const extractLegacyCategoryUrls = (html = '') => {
  const page = stripHtmlComments(html)
  const urls = [...page.matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?open positions?/gi)]
    .map((match) => toAbsoluteUrl(match[1], LEGACY_CAREERS_URL))
    .filter(Boolean)
    .filter((url) => /\/eng\/career\/[^/]+\/[^/]+\.html$/i.test(url))
    .filter((url) => !/details\.html$/i.test(url))

  return [...new Set(urls)]
}

export const extractLegacyCategoryOpenings = (html = '', categoryUrl = LEGACY_CAREERS_URL) => {
  const page = stripHtmlComments(html)

  return [...page.matchAll(
    /<h5[^>]*>([\s\S]*?)<\/h5>[\s\S]*?<i\b[^>]*fa-map-marker-alt[^>]*>\s*<\/i>\s*([^<]+)[\s\S]*?<i\b[^>]*far\s+fa-clock[^>]*>\s*<\/i>\s*([^<]+)[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now/gi,
  )]
    .map((match) => ({
      title: stripTags(match[1]),
      location: normalizeWhitespace(match[2]),
      employmentType: normalizeWhitespace(match[3]),
      applyUrl: toAbsoluteUrl(match[4], categoryUrl),
      categoryUrl,
    }))
    .filter((job) => job.title && job.location && job.applyUrl)
}

const isOfficialJobUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''), CAREERS_URL)
    return /^(?:www\.)?alchemytechsol\.com$/i.test(url.hostname)
      && /^\/job\/[^/]+\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

export const extractAjaxOpenings = (payload = {}) => {
  const html = String(payload?.html ?? '')
  const listingBlocks = [...html.matchAll(
    /<li\b[^>]*class=["'][^"']*\bjob_listing\b[^"']*["'][^>]*>([\s\S]*?)(?=<li\b[^>]*class=["'][^"']*\bjob_listing\b|$)/gi,
  )]

  return listingBlocks
    .map((match) => {
      const block = match[1]
      const sourceUrl = toAbsoluteUrl(
        block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1],
        CAREERS_URL,
      )

      return {
        title: stripTags(block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]),
        location: stripTags(
          block.match(/<div\b[^>]*class=["'][^"']*\blocation\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
        ),
        employmentType: stripTags(
          block.match(/<li\b[^>]*class=["'][^"']*\bjob-type\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/i)?.[1],
        ),
        sourceUrl,
        applyUrl: sourceUrl,
      }
    })
    .filter((opening) => opening.title && opening.location && isOfficialJobUrl(opening.sourceUrl))
}

export const hasExpectedAjaxListingsSignal = (payload = {}) => {
  const openings = extractAjaxOpenings(payload)
  if (payload?.found_jobs === false) {
    return Number(payload?.max_num_pages) === 0
      && /no_job_listings_found/i.test(String(payload?.html ?? ''))
      && openings.length === 0
  }

  return payload?.found_jobs === true
    && Number.isInteger(Number(payload?.max_num_pages))
    && Number(payload.max_num_pages) >= 1
    && !/no_job_listings_found/i.test(String(payload?.html ?? ''))
    && openings.length > 0
}

const normalizeLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/\bIndia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const normalizeOpening = (opening, { now }) => {
  const title = normalizeWhitespace(opening.title)
  const rawLocation = normalizeWhitespace(opening.location)
  const location = normalizeLocation(rawLocation)
  const city = normalizeCity(rawLocation?.split(',')[0]?.trim())
  const jobSlug = slugify(`${title}-${rawLocation}`)
  if (!title || !rawLocation || !location || !city || !jobSlug) return null

  const sourceUrl = opening.sourceUrl || opening.categoryUrl || CAREERS_URL
  const applyUrl = opening.applyUrl || sourceUrl

  return {
    title,
    company: 'Alchemy Techsol India Pvt Ltd',
    department: null,
    location,
    city,
    country: 'India',
    jobId: `${SOURCE}-${jobSlug}`,
    requisitionId: `${SOURCE}-${jobSlug}`,
    sourceUrl,
    applyUrl,
    employmentType: normalizeWhitespace(opening.employmentType),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(opening.description),
    remoteStatus: /remote/i.test(rawLocation) ? 'Remote' : 'On-site',
    source: SOURCE,
    link: applyUrl,
    scrapedAt: now(),
  }
}
const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  label: SOURCE,
  timeoutMs: 30000,
})

const buildListingsRequest = (page) => ({
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: CAREERS_URL,
  },
  body: new URLSearchParams({
    search_keywords: '',
    search_location: '',
    per_page: '100',
    orderby: 'featured',
    order: 'DESC',
    page: String(page),
    show_pagination: 'false',
    post_id: '54',
  }).toString(),
})

export const createAlchemyTechsolIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    return runDeclaredAlchemy({ now, ...options })
  },
})

export const run = async (options = {}) => createAlchemyTechsolIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Alchemy Techsol India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
