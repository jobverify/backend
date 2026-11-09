import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'promantiabusinesssolutionspvtltd'
export const COMPANY = 'PROMANTIA Business Solutions Pvt. Ltd.'
export const CAREERS_URL = 'https://promantia.in/career/'
export const CAREERS_EMAIL = 'careers@promantia.com'
export const APPLY_POPUP_CLASS = 'sg-popup-id-1251'
export const APPLY_POPUP_CONTAINER = 'sgpb-main-popup-data-container-1251'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DETAIL_FETCH_TIMEOUT_MS = 15000

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const toJobSlug = (url) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeComparableTitle = (value) => normalizeWhitespace(value)
  ?.replace(/\b20\d{2}\b/g, ' ')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase() || null

const titlesMatch = (listingTitle, candidateTitle) => {
  const listing = normalizeComparableTitle(listingTitle)
  const candidate = normalizeComparableTitle(candidateTitle)

  return Boolean(listing && candidate && (candidate.includes(listing) || listing.includes(candidate)))
}

const extractLabelValue = (html, label) => {
  const pattern = new RegExp(
    `<(?:strong|b)[^>]*>\\s*${label}:\\s*<\\/(?:strong|b)>\\s*([^<]+)`,
    'i',
  )

  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1] ?? null)
}

const inferLocationFromText = (value) => {
  const text = stripTags(value)
  if (!text) return { location: null, city: null }

  if (/\b(?:bangalore|bengaluru)\b/i.test(text)) {
    return { location: 'Bangalore, India', city: 'Bangalore' }
  }

  if (/\bNCR\b/i.test(text)) {
    return { location: 'NCR, India', city: null }
  }

  if (/\bIndia\b/i.test(text)) {
    const normalized = normalizeWhitespace(text)
    const city = normalizeCity(normalized.replace(/,\s*India$/i, ''))
    return { location: normalized, city: city === normalized ? null : city }
  }

  return { location: null, city: null }
}

const inferExperience = (value) => {
  const text = stripTags(value)
  if (!text) return null

  const match = text.match(/(\d+\s*(?:-\s*\d+)?\+?)\s*years?/i)
  return normalizeWhitespace(match?.[1] ? `${match[1]} years` : null)
}

const extractDetailTitle = (html) => {
  const page = String(html ?? '')
  const candidates = [
    extractLabelValue(page, 'Job Title'),
    normalizeWhitespace(
      page.match(/font-size:\s*xx-large[^>]*>\s*<b>([\s\S]*?)<\/b>/i)?.[1] ?? null,
    ),
    normalizeWhitespace(
      page.match(/font-size:\s*xx-large[^>]*>\s*([\s\S]*?)<\/span>/i)?.[1] ?? null,
    ),
    normalizeWhitespace(page.match(/<h1[^>]*class=["'][^"']*\bentry-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null),
  ]

  return candidates.find(Boolean) || null
}

const extractPopupPageTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<input[^>]+name=["']page-title["'][^>]+value=["']([^"']+)["']/i)?.[1] ?? null,
)

const extractEntryContentText = (html) => {
  const page = String(html ?? '')
  const start = page.indexOf('<div class="entry-content">')
  if (start === -1) return stripTags(page)

  const popupIndex = page.indexOf('sgpb-main-popup-data-container-1251', start)
  const articleIndex = page.indexOf('</article>', start)
  let end = popupIndex
  if (end === -1 || (articleIndex !== -1 && articleIndex < end)) {
    end = articleIndex
  }
  if (end === -1) end = page.length

  const chunk = page
    .slice(start, end)
    .replace(/<a[^>]*sg-popup-id-1251[^>]*>[\s\S]*?<\/a>/gi, ' ')

  return stripTags(chunk)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Career\s*-\s*Promantia Business Solutions Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && /The following are the positions for which we are currently recruiting/i.test(text)
    && new RegExp(`mailto:${CAREERS_EMAIL}`, 'i').test(page)
    && (new RegExp(APPLY_POPUP_CONTAINER).test(page) || new RegExp(APPLY_POPUP_CLASS).test(page))
    && (
      /Upload Your Resume/i.test(text)
      || (/name=["']resume["']/i.test(page) && /type=["']file["']/i.test(page))
    )
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Promantia verified careers page no longer matches the trusted first-party public jobs surface')
  }

  const jobs = [...String(html ?? '').matchAll(
    /<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>\s*<p>([\s\S]*?)<\/p>\s*<p[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>\s*For more details\s*<\/a>\s*<\/p>/gi,
  )]
    .map((match) => {
      const title = normalizeWhitespace(match[1])
      const summary = stripTags(match[2])
      const sourceUrl = toAbsoluteUrl(match[3])
      const jobSlug = toJobSlug(sourceUrl)

      if (!title || !summary || !sourceUrl || !jobSlug) return null

      return {
        title,
        summary,
        sourceUrl,
        applyUrl: sourceUrl,
        jobId: `${SOURCE}-${jobSlug}`,
        requisitionId: `${SOURCE}-${jobSlug}`,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Promantia verified careers page no longer exposes the expected public job blocks')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const detailTitle = extractDetailTitle(page)
  const popupPageTitle = extractPopupPageTitle(page)
  const detailMatchesListing = titlesMatch(listing.title, detailTitle) || titlesMatch(listing.title, popupPageTitle)
  const fallbackLocation = inferLocationFromText(listing.summary)
  const fallbackExperience = inferExperience(listing.summary)

  if (!detailMatchesListing) {
    return {
      ...listing,
      location: fallbackLocation.location,
      city: fallbackLocation.city,
      country: 'India',
      employmentType: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      experienceRequired: fallbackExperience,
      jobDescription: listing.summary || null,
    }
  }

  const detailText = extractEntryContentText(page)
  const locationInfo = inferLocationFromText(extractLabelValue(page, 'Location') || detailText || listing.summary)
  const experienceRequired = inferExperience(extractLabelValue(page, 'Experience') || detailText || listing.summary)

  return {
    ...listing,
    title: listing.title || detailTitle || popupPageTitle || null,
    location: locationInfo.location || fallbackLocation.location,
    city: locationInfo.city || fallbackLocation.city,
    country: 'India',
    employmentType: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    experienceRequired: experienceRequired || fallbackExperience,
    jobDescription: detailText || listing.summary || null,
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

const defaultFetchDetailText = async (url) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(new Error(`Fetch timed out after ${DETAIL_FETCH_TIMEOUT_MS}ms`)), DETAIL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (response.status === 404 || response.status === 410) {
      return ''
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

export const createPromantiaScraper = ({ maxJobs = null, now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchDetailText, now: overrideNow } = {}) {
    const listings = extractListings(await fetchText(CAREERS_URL))
    const selected = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings
    const jobs = []
    const detailFetcher = fetchDetailText || (fetchText === defaultFetchText ? defaultFetchDetailText : fetchText)

    for (const listing of selected) {
      let detail = extractJobDetail('', listing)

      try {
        const detailHtml = await detailFetcher(listing.sourceUrl)
        detail = extractJobDetail(detailHtml, listing)
      } catch {
        detail = extractJobDetail('', listing)
      }

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createPromantiaScraper().run(options)

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
