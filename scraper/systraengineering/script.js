import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'systraengineering'
export const COMPANY = 'Systra Engineering'
export const HOMEPAGE_URL = 'https://www.systra.com/en/'
export const CAREERS_URL = 'https://www.systra.com/en/join-us/'
export const JOBS_LISTING_ENDPOINT = 'https://www.systra.com/wp-json/systra-jobs/v1/jobs-listing'
export const INDIA_COUNTRY_FILTER = 'india_en'
const DEFAULT_DETAIL_CONCURRENCY = 10

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTML_ENTITY_REPLACEMENTS = [
  [/&#8211;|&#x2013;|&ndash;/gi, '-'],
  [/&#8212;|&#x2014;|&mdash;/gi, '-'],
  [/&#39;|&#x27;|&apos;|&rsquo;|&lsquo;/gi, "'"],
  [/&#34;|&quot;/gi, '"'],
  [/&amp;/gi, '&'],
  [/&nbsp;|&#160;/gi, ' '],
]

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    decoded = decoded.replace(pattern, replacement)
  }

  return decoded
}

const normalizeWhitespace = (value) =>
  decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|h[1-6]|li|ol|p|section|span|strong|ul)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value, base = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, base).toString()
  } catch {
    return null
  }
}

const extractMatch = (pattern, value) => normalizeWhitespace(String(value ?? '').match(pattern)?.[1] || null)

const extractFieldValue = (html, label) => {
  const pattern = new RegExp(
    `<span>\\s*${escapeRegExp(label)}\\s*:?\\s*<\\/span>\\s*<span>([\\s\\S]*?)<\\/span>`,
    'i',
  )
  return stripTags(String(html ?? '').match(pattern)?.[1] || null)
}

const parseLocation = (value, fallbackCountry = null) => {
  const normalized = normalizeWhitespace(value)
  const country = normalizeWhitespace(fallbackCountry)

  if (!normalized) {
    return {
      location: country,
      city: null,
      country,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const hasCountry = country && parts.some((part) => part.toLowerCase() === country.toLowerCase())
  const finalParts = hasCountry || !country ? parts : [...parts, country]
  const city = finalParts[0] && !/^n\/?a$/i.test(finalParts[0]) ? finalParts[0] : null

  return {
    location: finalParts.join(', ') || null,
    city,
    country: country || finalParts.at(-1) || null,
  }
}

const extractSectionHtml = (html, label) => {
  const pattern = new RegExp(
    `<h2>\\s*${escapeRegExp(label)}\\s*<\\/h2>([\\s\\S]*?)(?=<h2>|$)`,
    'i',
  )

  return String(html ?? '').match(pattern)?.[1] || ''
}

const extractListItems = (html) =>
  [...String(html ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractJobIdFromUrl = (value) => {
  try {
    const pathname = new URL(value).pathname
    return normalizeWhitespace(pathname.match(/-(\d+)\/?$/)?.[1] || null)
  } catch {
    return null
  }
}

export const extractCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    const text = stripTags(match[2])

    if (href && /^join us!?$/i.test(text || '')) {
      return href
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('confidence moves the world')
    && extractCareersUrl(html) === CAREERS_URL
}

export const extractCareersConfig = (html) => {
  const page = String(html ?? '')
  const jobsListingEndpoint = extractMatch(/"jobs_listing_endpoint":"([^"]+)"/i, page)?.replace(/\\\//g, '/')
  const jobsListingNonce = extractMatch(/"jobs_listing_nonce":"([^"]+)"/i, page)
  const lang = extractMatch(/"lang":"([^"]+)"/i, page)

  if (!jobsListingEndpoint || !jobsListingNonce || !lang) {
    return null
  }

  return {
    jobsListingEndpoint,
    jobsListingNonce,
    lang,
  }
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)
  const config = extractCareersConfig(html)

  return normalized.includes('already applied? access')
    && /id=["']jobs-filter["']/i.test(String(html ?? ''))
    && /name=["']country["']/i.test(String(html ?? ''))
    && /value=["']india_en["'][^>]*>\s*India/i.test(String(html ?? ''))
    && /careers-systra\.icims\.com\/jobs\/login\?loginOnly=1/i.test(String(html ?? ''))
    && config?.jobsListingEndpoint === JOBS_LISTING_ENDPOINT
    && config?.lang === 'en'
}

export const hasListingsPayload = (payload) =>
  typeof payload?.jobs === 'string'
  && Number.isInteger(payload?.stats?.cp)
  && Number.isInteger(payload?.stats?.mp)

export const buildJobsRequestBody = ({
  page = 1,
  country = INDIA_COUNTRY_FILTER,
  lang = 'en',
} = {}) => {
  const params = new URLSearchParams()
  params.append('page', String(page))
  params.append('country', country)
  params.append('lang', lang)
  return params
}

export const extractJobCards = (html = '') =>
  [...String(html ?? '').matchAll(/<a href="([^"]+)" class="job">([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const sourceUrl = toAbsoluteUrl(match[1], CAREERS_URL)
      const cardHtml = match[2]
      const locationInfo = parseLocation(
        extractMatch(/<span class="location">\s*([\s\S]*?)\s*<\/span>/i, cardHtml),
        'India',
      )
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!sourceUrl || !jobId) {
        return null
      }

      return {
        title: extractMatch(/<div class="content">\s*<p>([\s\S]*?)<\/p>/i, cardHtml),
        company: COMPANY,
        department: extractMatch(/<span class="field">\s*([\s\S]*?)\s*<\/span>/i, cardHtml),
        location: locationInfo.location,
        city: locationInfo.city,
        country: locationInfo.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: extractMatch(/<span class="contract">\s*([\s\S]*?)\s*<\/span>/i, cardHtml),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter((job) => job?.title && job.sourceUrl)

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const title = stripTags(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || listing.title || null)
  const country = extractFieldValue(page, 'Country/Region') || listing.country || 'India'
  const locationInfo = parseLocation(
    extractFieldValue(page, 'Location') || listing.location,
    country,
  )
  const department = extractFieldValue(page, 'Field') || listing.department || null
  const experienceRequired = extractFieldValue(page, 'Level of experience') || listing.experienceRequired || null
  const applyUrl = toAbsoluteUrl(
    page.match(/href="(https:\/\/careers-systra\.icims\.com\/jobs\/[^"]+)"[^>]*class="postuler"/i)?.[1],
    CAREERS_URL,
  ) || listing.applyUrl || listing.sourceUrl || null
  const postingDate = extractMatch(/"datePublished":"([^"]+)"/i, page) || listing.postingDate || null
  const contentHtml = page.match(
    /<section class="job-content">\s*<div>([\s\S]*?)<\/div>\s*<section class="marque_employeur">/i,
  )?.[1] || ''
  const requiredSkills = extractListItems(extractSectionHtml(contentHtml, 'Profile/Skills'))
  const descriptionSource = contentHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '')
  const jobDescription = stripTags(descriptionSource) || listing.jobDescription || null

  return {
    title,
    company: listing.company || COMPANY,
    department,
    location: locationInfo.location || listing.location || null,
    city: locationInfo.city || listing.city || null,
    country: locationInfo.country || listing.country || null,
    jobId: listing.jobId || extractJobIdFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    employmentType: listing.employmentType || null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate,
    closingDate: null,
    jobDescription,
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

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const buildListingsRequestOptions = ({ jobsListingNonce, lang }, page) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-WP-Nonce': jobsListingNonce,
  },
  body: buildJobsRequestBody({
    page,
    country: INDIA_COUNTRY_FILTER,
    lang,
  }),
})

export const createSystraEngineeringScraper = ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  maxPages = 100,
  maxJobs = null,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    fetchJson: overrideFetchJson,
    maxPages: overrideMaxPages = maxPages,
    maxJobs: overrideMaxJobs = maxJobs,
    now: overrideNow = now,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const fetchJsonImpl = overrideFetchJson || fetchJson
    const nowImpl = overrideNow || now

    const homepageHtml = await fetchTextImpl(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Systra Engineering verified official homepage no longer matches the known public surface')
    }

    if (extractCareersUrl(homepageHtml) !== CAREERS_URL) {
      throw new Error('Systra Engineering homepage no longer links to the verified official careers route')
    }

    const careersHtml = await fetchTextImpl(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Systra Engineering verified official careers page no longer matches the known first-party jobs surface')
    }

    const careersConfig = extractCareersConfig(careersHtml)
    if (!careersConfig || careersConfig.jobsListingEndpoint !== JOBS_LISTING_ENDPOINT) {
      throw new Error('Systra Engineering verified careers config changed materially')
    }

    const jobs = []
    const seenJobIds = new Set()
    const effectiveMaxPages = Number.isFinite(overrideMaxPages) && overrideMaxPages > 0
      ? Math.floor(overrideMaxPages)
      : 1
    let totalPages = effectiveMaxPages

    for (let page = 1; page <= totalPages && page <= effectiveMaxPages; page += 1) {
      const payload = await fetchJsonImpl(
        careersConfig.jobsListingEndpoint,
        buildListingsRequestOptions(careersConfig, page),
      )

      if (!hasListingsPayload(payload)) {
        throw new Error('Systra Engineering first-party jobs payload changed materially')
      }

      totalPages = Math.min(
        Math.max(Number(payload.stats?.mp) || 1, 1),
        effectiveMaxPages,
      )

      const listings = extractJobCards(payload.jobs)
      if (page === 1 && listings.length === 0 && Number(payload.stats?.c || 0) > 0) {
        throw new Error('Systra Engineering first-party jobs payload no longer matches the verified public jobs surface')
      }

      const freshListings = []
      for (const listing of listings) {
        if (!listing.jobId || seenJobIds.has(listing.jobId)) {
          continue
        }

        seenJobIds.add(listing.jobId)
        freshListings.push(listing)
      }

      const remainingSlots = Number.isInteger(overrideMaxJobs)
        ? Math.max(overrideMaxJobs - jobs.length, 0)
        : freshListings.length
      const selectedListings = Number.isInteger(overrideMaxJobs)
        ? freshListings.slice(0, remainingSlots)
        : freshListings
      const pageJobs = await mapWithConcurrency(
        selectedListings,
        detailConcurrency,
        async (listing) => {
          const detailHtml = await fetchTextImpl(listing.sourceUrl)
          const job = extractJobDetail(detailHtml, listing)

          if (!job.title || !job.applyUrl) {
            throw new Error(`Systra Engineering detail page changed materially: ${listing.sourceUrl}`)
          }

          return {
            ...job,
            source: SOURCE,
            link: job.applyUrl || job.sourceUrl,
            scrapedAt: nowImpl(),
          }
        },
      )

      jobs.push(...pageJobs)
      if (Number.isInteger(overrideMaxJobs) && jobs.length >= overrideMaxJobs) {
        return jobs.slice(0, overrideMaxJobs)
      }

      if (Number(payload.stats?.cp) >= Number(payload.stats?.mp)) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createSystraEngineeringScraper(options).run(options)

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
