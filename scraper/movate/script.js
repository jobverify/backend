import path from 'path'
import { fileURLToPath } from 'url'
import { MOVATE_CATALOG } from './catalog.js'
import {runCurrentMovate} from './currentNative.js'
export const PROVIDER_METADATA = MOVATE_CATALOG

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://www.movate.com/careers-at-movate/'
export const JOBS_PAGE_URL = 'https://www.movate.com/careers/latest-job-openings/'
export const PORTAL_URL = 'https://movatecareers.movate.com/MovateJobOpenings'

const COMPANY = 'Movate'
const SOURCE = 'movate'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const stripLocationCode = (value) => String(value ?? '')
  .replace(/\s*\([A-Z]{2}_[^)]+\)\s*$/i, '')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
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

const normalizeLocation = (value) => {
  if (Array.isArray(value)) {
    const locations = value
      .map((item) => normalizeLocation(item))
      .filter(Boolean)

    return locations.length ? locations.join(' | ') : null
  }

  const normalized = normalizeWhitespace(stripLocationCode(value))
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const stripTagsToLines = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractTitle = (html) => normalizeWhitespace(
  extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html),
)

const toAbsoluteUrl = (value, baseUrl = JOBS_PAGE_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const parseEmbeddedArray = (html) => {
  const raw = extractFirst(/var\s+arrayList\s*=\s*(\[[\s\S]*?\])\s*;/i, html)
  if (!raw) {
    throw new Error('Movate jobs page no longer exposes the embedded arrayList payload')
  }

  return JSON.parse(raw)
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractDescriptionHighlights = (html) => {
  const listItems = extractListItems(html)
  if (listItems.length) return listItems

  return stripTagsToLines(html)
    .filter((line) => /^[\u2022·]/.test(line) || /^o\s+/i.test(line))
    .map((line) => line.replace(/^[\u2022·]\s*/u, '').replace(/^o\s+/i, '').trim())
    .filter(Boolean)
}

const extractCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  const firstLocation = normalized.split('|')[0]?.trim() || null
  if (!firstLocation) return null

  const parts = firstLocation.split(',').map((part) => part.trim()).filter(Boolean)
  if (!parts.length) return null

  const city = parts.length >= 4 && /india/i.test(parts.at(-1) || '')
    ? parts[1]
    : parts[0]

  return /^bengaluru$/i.test(city) ? 'Bangalore' : city
}

const isIndiaListing = (record = {}) => {
  if (Number(record?.post_on_careers_page) !== 1) return false

  const normalizedCountry = normalizeWhitespace(record.location_country)?.toLowerCase()
  if (normalizedCountry === 'india') return true

  return /india/i.test(normalizeWhitespace(record.location) || '')
}

export const buildDetailUrl = (jobId) =>
  `https://www.movate.com/job-details/?job_id=${jobId}`

const extractOfficialPortalUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<iframe\b[^>]*src=["']([^"']+)["']/gi)) {
    if (toAbsoluteUrl(match[1], JOBS_PAGE_URL) === PORTAL_URL) return PORTAL_URL
  }
  return null
}

const extractPortalJobs = (html) => {
  const page = String(html ?? '')
  if (!/^Movate Job Openings$/i.test(extractTitle(page) || '')
    || !/class=["']mv-jobs-grid["']/.test(page)
    || !/function\s+initPagination\s*\(/.test(page)) {
    throw new Error('Movate verified careers portal listings surface changed')
  }
  const segments = page.split(/<div\b[^>]*class=["']job-card["'][^>]*>/i).slice(1)
  if (!segments.length) throw new Error('Movate verified portal no longer exposes job listings')
  const seen = new Set()
  return segments.flatMap(segment => {
    const fields = Object.fromEntries([...segment.matchAll(/<b>([^<]*)<\/b>([\s\S]*?)(?=<\/div>)/gi)].map(match => [normalizeWhitespace(match[1])?.toLowerCase(), stripTags(match[2])]))
    const title = stripTags(segment.match(/class=["']job-title["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const jobId = normalizeWhitespace(fields['rrf-'])
    const location = normalizeLocation(fields['location:'])
    const sourceUrl = toAbsoluteUrl(segment.match(/href=["']([^"']*MovateJobDetails\.aspx\?[^"']+)["']/i)?.[1], PORTAL_URL)
    let trustedUrl = false
    try { const url = new URL(sourceUrl); trustedUrl = url.origin === new URL(PORTAL_URL).origin && url.pathname === '/MovateJobDetails.aspx' && Boolean(url.search) } catch {}
    if (!title || !jobId || !location || !trustedUrl || seen.has(jobId)) {
      throw new Error('Movate verified portal job listings schema or identity changed')
    }
    seen.add(jobId)
    if (!/(?:^|,)\s*India\s*$/i.test(location)) return []
    return [{title,company:COMPANY,department:null,location,city:extractCity(location),country:'India',jobId,requisitionId:jobId,sourceUrl,applyUrl:sourceUrl,employmentType:fields['employment type:']||null,experienceRequired:fields['experience required(yrs):']||null,minimumQualification:fields['qualification:']||null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,jobDescription:null,remoteStatus:null}]
  })
}

const extractPortalDetail = (html, listing) => {
  const page = String(html ?? '')
  const field = id => stripTags(page.match(new RegExp('<span\\b[^>]*id=["\']'+id+'["\'][^>]*>([\\s\\S]*?)<\\/span>','i'))?.[1])
  const title = field('lblJobTitle')
  const jobId = field('lblRRFID')?.replace(/^RRF-/, '')
  const location = normalizeLocation(field('lblLocation'))
  const description = field('lblJobDescription')
  if (!/^MOVATE\s*-/i.test(extractTitle(page)||'') || title !== listing.title || jobId !== listing.jobId || !location || !/(?:^|,)\s*India\s*$/i.test(location) || !description) {
    throw new Error('Movate verified portal job detail identity or description changed for requisition '+listing.jobId)
  }
  const skills = [...page.matchAll(/<span\b[^>]*class=["'][^"']*\bskill-tag\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)].map(match => stripTags(match[1])).filter(value => value && !/^[\d, ]+$/.test(value))
  return {...listing,title,location,city:extractCity(location),experienceRequired:field('lblExperience')||listing.experienceRequired,employmentType:field('lblEmploymentType')||listing.employmentType,minimumQualification:field('lblEducation')||listing.minimumQualification,requiredSkills:[...new Set(skills)],jobDescription:description}
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const title = extractTitle(page)?.toLowerCase() || ''

  return title.includes('careers at movate')
    && /Latest Job Openings/i.test(page)
    && page.includes(JOBS_PAGE_URL)
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const title = extractTitle(page)?.toLowerCase() || ''

  return title.includes('latest job openings')
    && title.includes('movate')
    && (/var\s+arrayList\s*=\s*\[/i.test(page) || Boolean(extractOfficialPortalUrl(page)))
}

export const extractJobListData = (html) => parseEmbeddedArray(html)

export const extractIndiaJobs = (records) => (Array.isArray(records) ? records : [])
  .filter((record) => isIndiaListing(record))
  .map((record) => {
    const title = normalizeWhitespace(record.job_title)
    const location = normalizeLocation(record.location)
    const jobId = normalizeWhitespace(record.job_id)

    if (!title || !location || !jobId) return null

    const sourceUrl = buildDetailUrl(jobId)

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(record.department),
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: normalizeWhitespace(record.experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(record.posted_date),
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }
  })
  .filter(Boolean)

const extractLabeledFields = (html) => {
  const fields = new Map()
  const page = String(html ?? '')

  const collect = (label, value) => {
    const normalizedLabel = normalizeWhitespace(label)?.toLowerCase()
    const normalizedValue = normalizeLocation(value) || normalizeWhitespace(value)

    if (!normalizedLabel || !normalizedValue || fields.has(normalizedLabel)) return
    fields.set(normalizedLabel, normalizedValue)
  }

  for (const match of page.matchAll(/<h6[^>]*>([\s\S]*?)<\/h6>\s*<p[^>]*class="[^"]*text-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)) {
    collect(match[1], match[2])
  }

  for (const match of page.matchAll(/<p[^>]*class="[^"]*text-muted[^"]*"[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*class="[^"]*(?:fw-medium|text-muted)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)) {
    collect(match[1], match[2])
  }

  return Object.fromEntries(fields)
}

const isGenericHeading = (value) => /latest job openings/i.test(normalizeWhitespace(value) || '')

export const extractJobDetail = (html, listing = {}) => {
  const fields = extractLabeledFields(html)
  const applyUrl = toAbsoluteUrl(
    extractFirst(
      /https:\/\/movate\.darwinbox\.com\/ms\/candidate\/candidate\/login\?redirect=[^"'\\\s<]+/i,
      html,
      (match) => match[0],
    ),
    HOMEPAGE_URL,
  )

  const location = normalizeLocation(fields.location) || normalizeLocation(
    extractFirst(/<div[^>]+class="job-location"[^>]*>([\s\S]*?)<\/div>/i, html),
  ) || normalizeLocation(listing.location) || null

  const department = normalizeWhitespace(fields.department) || normalizeWhitespace(
    extractFirst(/<div[^>]+class="job-department"[^>]*>([\s\S]*?)<\/div>/i, html),
  ) || listing.department || null

  const descriptionHtml = extractFirst(
    /<div[^>]+class="job-detail-desc"[^>]*>([\s\S]*?)<\/div>/i,
    html,
  ) || extractFirst(
    /<div[^>]+class="job-description"[^>]*>([\s\S]*?)<\/div>/i,
    html,
  )

  const detailTitle = normalizeWhitespace(
    extractFirst(/<h5[^>]*>([\s\S]*?)<\/h5>/i, html),
  ) || normalizeWhitespace(fields['job title']) || null

  const fallbackTitle = normalizeWhitespace(
    extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html),
  )

  const title = !isGenericHeading(detailTitle)
    ? detailTitle
    : !isGenericHeading(fallbackTitle)
      ? fallbackTitle
      : listing.title || null

  return {
    ...listing,
    title,
    department,
    location,
    city: extractCity(location) || listing.city || null,
    applyUrl: applyUrl || listing.applyUrl || null,
    sourceUrl: listing.sourceUrl || null,
    experienceRequired: normalizeWhitespace(fields.experience) || listing.experienceRequired || null,
    requiredSkills: extractDescriptionHighlights(descriptionHtml),
    jobDescription: stripTags(descriptionHtml),
  }
}

const defaultFetchText = async (url,{signal}={}) => {
  const response = await fetch(url, {
    signal:AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])]),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createMovateScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options={}) {
    const {
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    }=options
    options.signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL,{signal:options.signal})
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Movate homepage no longer matches the verified official careers surface')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL,{signal:options.signal})
    if(/\bwp-block-movate-careers-job-results\b/.test(jobsPageHtml))return runCurrentMovate({...options,now,maxJobs:options.maxJobs??maxJobs})
    if (!hasOfficialJobsPageSignal(jobsPageHtml)) {
      throw new Error('Movate jobs page no longer matches the verified embedded listings surface')
    }

    const portalUrl = extractOfficialPortalUrl(jobsPageHtml)
    const listings = portalUrl
      ? extractPortalJobs(await fetchText(portalUrl))
      : extractIndiaJobs(extractJobListData(jobsPageHtml))
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedJobs) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = portalUrl ? extractPortalDetail(detailHtml, listing) : extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async options => createMovateScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Movate scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
