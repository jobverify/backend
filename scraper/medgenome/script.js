import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { MEDGENOME_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = MEDGENOME_CATALOG
export const SOURCE = MEDGENOME_CATALOG.source
export const COMPANY_NAME = MEDGENOME_CATALOG.companyName
export const COUNTRY_FILTER = MEDGENOME_CATALOG.countryFilter
export const CAREERS_URL = MEDGENOME_CATALOG.companyCareerPage
export const AJAX_URL = MEDGENOME_CATALOG.jobsApiUrl
export const AJAX_ACTION = MEDGENOME_CATALOG.ajaxAction

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|section)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(value)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!normalized) return null
  if (normalized.includes('full')) return 'Full-time'
  if (normalized.includes('part')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractCity = (value) => normalizeWhitespace(value)
  ?.split(/,|\/|\|/)[0]
  ?.trim() || null

const extractListItems = (html) =>
  [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractSectionHtml = (html, className) =>
  String(html ?? '').match(
    new RegExp(`<div[^>]+class="${className}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
  )?.[1] || ''

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
  ...options,
})

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<h1[^>]*>\s*Careers\s*<\/h1>/i.test(page)
    && /Be\s+Part\s+of\s+the\s+Mission/i.test(page)
    && /wp-admin\/admin-ajax\.php/i.test(page)
}

export const buildAjaxRequestBody = ({ page, locationCatId = 0, careerCatTab = 0 } = {}) =>
  new URLSearchParams({
    page: String(page),
    location_cat_id: String(locationCatId),
    career_cat_tab: String(careerCatTab),
    action: AJAX_ACTION,
  }).toString()

export const extractListingCards = (html) => {
  const listings = []
  const page = String(html ?? '')

  for (const match of page.matchAll(/<div class="career_tab_col">([\s\S]*?)<\/ul>\s*<\/div>/gi)) {
    const cardHtml = match[1]
    const title = stripTags(cardHtml.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
    const sourceUrl = normalizeWhitespace(cardHtml.match(/<a[^>]*href="([^"]+)"/i)?.[1])
    const items = extractListItems(cardHtml)
    const employmentType = items[0] || null
    const location = items[1] || null

    if (!title || !sourceUrl || !location || !employmentType) continue

    listings.push({
      title,
      location,
      employmentType,
      sourceUrl,
    })
  }

  return listings
}

export const extractJobDetail = (html) => {
  const page = String(html ?? '')
  const headerItems = extractListItems(
    page.match(/<div class="careers_details_heading_left">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || '',
  )
  const responsibilitiesHtml = page.match(
    /<div class="job_responsibilties">([\s\S]*?)<\/div>\s*<hr/i,
  )?.[1] || ''
  const qualificationHtml = page.match(
    /<div class="skills_xpertise">([\s\S]*?)<\/div>/i,
  )?.[1] || ''
  const jobDescription = normalizeWhitespace(
    extractListItems(responsibilitiesHtml).join(' '),
  )
  const minimumQualification = normalizeWhitespace(
    qualificationHtml.replace(/<h4[^>]*>[\s\S]*?<\/h4>/i, ' '),
  )

  return {
    location: headerItems[1] || null,
    employmentType: headerItems[0] || null,
    minimumQualification,
    jobDescription,
  }
}

const dedupeListings = (listings) => {
  const uniqueListings = []
  const seen = new Set()

  for (const listing of listings) {
    if (!listing.sourceUrl || seen.has(listing.sourceUrl)) continue
    seen.add(listing.sourceUrl)
    uniqueListings.push(listing)
  }

  return uniqueListings
}

const extractJobIdFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return slugify(segments.at(-1))
  } catch {
    return slugify(value)
  }
}

export const createMedGenomeScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSurface(careersHtml)) {
      throw new Error('The verified MedGenome careers page no longer matches the trusted first-party surface')
    }

    const listings = []
    let page = 1

    while (true) {
      const listingHtml = await fetchText(AJAX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Origin: 'https://diagnostics.medgenome.com',
          Referer: CAREERS_URL,
        },
        body: buildAjaxRequestBody({ page }),
      })

      const cards = extractListingCards(listingHtml)
      if (cards.length === 0) break

      listings.push(...cards)
      page += 1
    }

    const selectedListings = Number.isInteger(maxJobs)
      ? dedupeListings(listings).slice(0, maxJobs)
      : dedupeListings(listings)

    const jobs = []

    for (const listing of selectedListings) {
      const detail = extractJobDetail(await fetchText(listing.sourceUrl))
      const jobId = extractJobIdFromUrl(listing.sourceUrl)

      jobs.push({
        title: listing.title,
        company: COMPANY_NAME,
        location: detail.location || listing.location,
        city: extractCity(detail.location || listing.location),
        country: COUNTRY_FILTER,
        source: SOURCE,
        jobId,
        requisitionId: jobId,
        sourceUrl: listing.sourceUrl,
        applyUrl: listing.sourceUrl,
        link: listing.sourceUrl,
        employmentType: normalizeEmploymentType(detail.employmentType || listing.employmentType),
        experienceRequired: null,
        minimumQualification: detail.minimumQualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: 'On-site',
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createMedGenomeScraper().run(options)

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
