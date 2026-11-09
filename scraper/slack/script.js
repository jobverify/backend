import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SLACK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = SLACK_CATALOG.source
export const COMPANY = SLACK_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SLACK_CATALOG.officialBrandName
export const VERIFIED_ON = SLACK_CATALOG.verifiedOn
export const PROVIDER_METADATA = SLACK_CATALOG
export const CAREERS_PAGE_URL = SLACK_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_PAGE_URL = SLACK_CATALOG.officialCareersPageUrl
export const PUBLIC_JOB_BOARD_HOSTNAME = SLACK_CATALOG.officialJobBoardDomain

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
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
) || ''

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page).toLowerCase()

  return /<title>\s*Careers\s*\|\s*Slack\s*<\/title>/i.test(page)
    && normalized.includes('careers at slack')
    && normalized.includes('work with us')
    && normalized.includes('filter job listings')
    && page.includes(PUBLIC_JOB_BOARD_HOSTNAME)
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const indiaDashMatch = normalized.match(/^India\s*-\s*(.+)$/i)
  if (indiaDashMatch) {
    const city = normalizeWhitespace(indiaDashMatch[1])
    return {
      location: city ? `${city}, India` : 'India',
      city,
      country: 'India',
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const rawCountry = parts.at(-1) || null
  const country = /^IN$|^India$/i.test(rawCountry ?? '') ? 'India' : rawCountry

  return {
    location: normalized,
    city,
    country,
  }
}

const extractLocationOptionMap = (html = '') => {
  const page = String(html ?? '')
  const selectLocationsBlock = page.match(
    /<select[^>]*(?:jobs-filter--mobile--location|mobile-location-selected|data-default-value=["']all-locations["'])[^>]*>([\s\S]*?)<\/select>/i,
  )?.[1]

  if (!selectLocationsBlock) return {}

  return Object.fromEntries(
    [...selectLocationsBlock.matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)]
      .map((match) => [
        normalizeWhitespace(match[1])?.toLowerCase() || null,
        normalizeWhitespace(match[2]),
      ])
      .filter(([value, label]) => value && label && value !== 'all-locations'),
  )
}

export const extractLocationOptions = (html = '') => {
  const page = String(html ?? '')
  const optionMap = extractLocationOptionMap(page)

  if (Object.keys(optionMap).length > 0) {
    return Object.values(optionMap)
  }

  const locationsBlock = page.match(
    /all locations[\s\S]*?<ul[^>]*data-filter-name=["']locations["'][^>]*>([\s\S]*?)<\/ul>/i,
  )?.[1]

  if (!locationsBlock) return []

  return [...locationsBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

export const extractPublicJobUrls = (html = '') => {
  const matches = String(html ?? '').matchAll(
    /href=["'](https:\/\/salesforce\.wd12\.myworkdayjobs\.com\/[^"']+)["']/gi,
  )
  const deduped = new Set()

  for (const match of matches) {
    deduped.add(match[1])
  }

  return [...deduped]
}

export const hasIndiaLocationOption = (locations = []) =>
  locations.some((location) => /\bIndia\b/i.test(location))

const extractTagList = (value = '') => [...new Set(
  String(value ?? '')
    .split(',')
    .map((tag) => normalizeWhitespace(tag)?.toLowerCase())
    .filter(Boolean),
)]

const isIndiaLocationTag = (value = '') => /^india-[a-z0-9-]+$/i.test(String(value ?? ''))

const locationTagToLabel = (value = '') => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized || !isIndiaLocationTag(normalized)) return null

  const city = normalized
    .replace(/^india-/i, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  return city ? `India - ${city}` : null
}

const extractWorkdayJobUrl = (html = '') => normalizeWhitespace(
  String(html ?? '').match(
    /href=["'](https:\/\/salesforce\.wd12\.myworkdayjobs\.com\/[^"']+)["']/i,
  )?.[1],
)

const extractRequisitionIdFromUrl = (url) => {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) || ''
    return normalizeWhitespace(segment.match(/_([^/_]+)$/)?.[1] || null)
  } catch {
    return null
  }
}

export const extractIndiaRoleSummaries = (html = '') => {
  const page = String(html ?? '')
  const locationMap = extractLocationOptionMap(page)
  const roles = []
  const seen = new Set()

  for (const blockMatch of page.matchAll(
    /<div class="job-listing"[^>]*data-filter-tags="([^"]*)"[^>]*>([\s\S]*?)<\/table>/gi,
  )) {
    const blockTags = extractTagList(blockMatch[1])
    const blockHtml = blockMatch[2]
    const department = normalizeWhitespace(
      blockHtml.match(
        /<span[^>]*class=["'][^"']*job-listing__category-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      )?.[1],
    )

    for (const rowMatch of blockHtml.matchAll(
      /<tr[^>]*class=["'][^"']*for-mobile-only[^"']*["'][^>]*data-filter-tags="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi,
    )) {
      const rowTags = extractTagList(rowMatch[1])
      const rowHtml = rowMatch[2]
      const title = normalizeWhitespace(
        rowHtml.match(
          /<p[^>]*class=["'][^"']*job-listing__table-title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
        )?.[1],
      )
      const locationLabel = normalizeWhitespace(
        rowHtml.match(
          /<p[^>]*class=["'][^"']*job-listing__table-location[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
        )?.[1],
      )
      const url = extractWorkdayJobUrl(rowHtml)
      const combinedTags = [...new Set([...blockTags, ...rowTags])]
      const locationSlugs = combinedTags.filter(isIndiaLocationTag)
      const locations = locationSlugs
        .map((tag) => locationMap[tag] || locationTagToLabel(tag))
        .filter(Boolean)
      const jobId = normalizeWhitespace(
        rowHtml.match(/data-job-id=["']([^"']+)["']/i)?.[1],
      ) || extractRequisitionIdFromUrl(url)

      if (!title || !url || locationSlugs.length === 0 || seen.has(url)) continue

      seen.add(url)
      roles.push({
        title,
        department,
        locationLabel,
        locations,
        locationSlugs,
        url,
        jobId,
      })
    }
  }

  return roles
}

const parseJobPostingJsonLd = (html = '') => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      const candidates = [
        ...(Array.isArray(parsed) ? parsed : [parsed]),
        ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : []),
      ]

      for (const candidate of candidates) {
        if (candidate?.['@type'] === 'JobPosting') return candidate
      }
    } catch {
      // Skip malformed JSON-LD blocks until the public JobPosting payload is found.
    }
  }

  return null
}

const extractJobPostingLocation = (jobPosting = {}) => {
  const address = jobPosting?.jobLocation?.address || {}
  const locality = normalizeWhitespace(address.addressLocality)
    || normalizeWhitespace(jobPosting?.applicantLocationRequirements?.name)
  const parsedLocality = parseLocation(locality)
  if (parsedLocality.country === 'India') {
    return parsedLocality
  }

  const rawCountry = normalizeWhitespace(address.addressCountry)
    || normalizeWhitespace(jobPosting?.applicantLocationRequirements?.name)
  const country = /^IN$|^India$/i.test(rawCountry ?? '') ? 'India' : rawCountry
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    country,
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country,
  }
}

const buildLocationsArray = (role = {}) => [...new Set(
  (role.locations || [])
    .map((label) => parseLocation(label).city)
    .filter(Boolean),
)]

export const extractJobFromDetail = (role, html = '') => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return null

  const title = normalizeWhitespace(jobPosting?.title) || normalizeWhitespace(role?.title)
  const description = stripTags(jobPosting?.description)
  const locationData = extractJobPostingLocation(jobPosting)
  const requisitionId = normalizeWhitespace(jobPosting?.identifier?.value)
    || normalizeWhitespace(role?.jobId)
    || extractRequisitionIdFromUrl(role?.url)
  const employmentType = normalizeEmploymentType(jobPosting?.employmentType)
  const postingDate = normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null

  if (!title || !description || !requisitionId || locationData.country !== 'India') {
    return null
  }

  if (!/\bslack\b/i.test(`${title} ${description}`)) {
    return null
  }

  const job = {
    title,
    company: COMPANY,
    department: role?.department || null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    jobId: requisitionId,
    requisitionId,
    sourceUrl: role?.url || null,
    applyUrl: role?.url || null,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: description,
  }

  const locations = buildLocationsArray(role)
  if (locations.length > 0) {
    job.locations = locations
  }

  return job
}

export const createSlackScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
    signal,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL, { signal })

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified official Slack careers page changed materially')
    }

    const locationOptions = extractLocationOptions(careersHtml)
    if (locationOptions.length === 0) {
      throw new Error('Verified Slack location filter changed materially')
    }

    if (extractPublicJobUrls(careersHtml).length === 0) {
      throw new Error('Verified Slack careers handoff changed materially')
    }

    // The public board can legitimately have no India openings; only parse detail
    // pages when the verified location filter advertises an India location.
    if (!hasIndiaLocationOption(locationOptions)) return []

    const indiaRoles = extractIndiaRoleSummaries(careersHtml)
    if (indiaRoles.length === 0) {
      throw new Error('Verified Slack India role listing changed materially')
    }

    const jobs = []

    for (const role of indiaRoles) {
      const detailHtml = await fetchText(role.url, { signal })
      const job = extractJobFromDetail(role, detailHtml)
      if (job) jobs.push(job)
    }

    if (!jobs.length) {
      throw new Error('Verified Slack India role detail page changed materially')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSlackScraper(options).run(options)

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
