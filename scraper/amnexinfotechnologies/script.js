import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { AMNEX_INFOTECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = AMNEX_INFOTECHNOLOGIES_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_HUB_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const PROFESSIONAL_OPPORTUNITIES_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const JOB_LOCATIONS_API_URL = PROVIDER_METADATA.jobLocationsApiUrl
export const JOB_YEARS_API_URL = PROVIDER_METADATA.jobYearsApiUrl
export const VERIFIED_JOB_DETAIL_URL = PROVIDER_METADATA.verifiedJobDetailUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const FOREIGN_LOCATION_PATTERN =
  /united states|usa|u\.s\.|canada|singapore|dubai|uae|europe|uk|united kingdom|australia/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, ' - ')
  .replace(/&#8212;|&mdash;/gi, ' - ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractCanonicalUrl = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1],
  )

const toAbsoluteUrl = (value, baseUrl = PROFESSIONAL_OPPORTUNITIES_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) return directMatch[1]

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const normalizeExperienceLabel = (value) =>
  normalizeWhitespace(value)
    ?.replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, ' - ') || null

const formatLocation = (locationNames = []) => {
  const cleanedNames = locationNames.map((value) => normalizeWhitespace(value)).filter(Boolean)
  if (cleanedNames.length === 0) return null

  const combined = cleanedNames.join(' | ')
  return /india/i.test(combined) ? combined : `${combined}, ${COUNTRY_FILTER}`
}

const isLikelyIndiaLocationNames = (locationNames = []) =>
  locationNames.length > 0
    && locationNames.every((value) => !FOREIGN_LOCATION_PATTERN.test(String(value)))

const extractCityFromLocationNames = (locationNames = []) =>
  locationNames.length === 1 ? normalizeWhitespace(locationNames[0]) : null

const extractCityFromLocationLabel = (locationLabel) => {
  const normalized = normalizeWhitespace(locationLabel)
  if (!normalized) return null
  if (normalized.includes('|')) return null

  const withoutCountry = normalized.replace(/,\s*India$/i, '')
  const city = normalizeWhitespace(withoutCountry.split(',')[0])
  return city || null
}

const extractDetailRoleTitle = (html) => {
  const title = extractTitle(html)
  if (!title) return null
  return normalizeWhitespace(title.replace(/\s*-\s*AMNEX$/i, ''))
}

const hasInlineApplyForm = (html) => {
  const page = String(html ?? '')

  return /<form\b/i.test(page)
    && /(?:<input\b[^>]+type=["']file["']|forminator-module-\d+|forminator_submit_form_custom-forms)/i.test(page)
    && /(?:Upload resume|name=["']upload-\d+["']|forminator-field-upload|forminator-module-\d+|forminator_submit_form_custom-forms)/i.test(page)
    && /(?:SUBMIT|forminator_submit_form_custom-forms)/i.test(page)
}

const extractFieldValue = (html, label) => {
  const page = String(html ?? '')
  const pattern = new RegExp(
    `<p>\\s*(?:<strong>)?\\s*${escapeRegExp(label)}\\s*(?:<\\/strong>)?\\s*<\\/p>[\\s\\S]{0,600}?<p>([\\s\\S]*?)<\\/p>`,
    'i',
  )

  return normalizeWhitespace(page.match(pattern)?.[1])
}

const extractDescriptionText = (html) => {
  const page = String(html ?? '')
  const labelPattern = /<p>\s*(?:<strong>)?\s*Job Code\s*(?:<\/strong>)?\s*<\/p>/i
  const startMatch = labelPattern.exec(page)
  const endMatch = /Upload resume|<form\b/i.exec(page)

  if (!startMatch || !endMatch || endMatch.index <= startMatch.index + startMatch[0].length) {
    return null
  }

  const afterLabelStart = startMatch.index + startMatch[0].length
  const betweenLabelAndForm = page.slice(afterLabelStart, endMatch.index)
  const valueMatch = /<p>[\s\S]*?<\/p>/i.exec(betweenLabelAndForm)
  const descriptionStart = valueMatch
    ? afterLabelStart + valueMatch.index + valueMatch[0].length
    : afterLabelStart

  return stripTags(page.slice(descriptionStart, endMatch.index))
}

export const extractProfessionalOpportunitiesUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)) {
    const url = toAbsoluteUrl(match[1], CAREER_HUB_URL)
    if (url === PROFESSIONAL_OPPORTUNITIES_URL) return url
  }

  return null
}

export const hasOfficialCareerHubSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Career - AMNEX'
    && extractCanonicalUrl(page) === CAREER_HUB_URL
    && normalized.includes('Fuel your passion. Shape the future')
    && extractProfessionalOpportunitiesUrl(page) === PROFESSIONAL_OPPORTUNITIES_URL
}

export const hasOfficialProfessionalOpportunitiesSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return extractTitle(page) === 'Professional Opportunities - AMNEX'
    && extractCanonicalUrl(page) === PROFESSIONAL_OPPORTUNITIES_URL
    && normalized.includes('Current Openings')
    && normalized.includes('Find Jobs')
    && normalized.includes('Previous')
    && normalized.includes('Next')
    && /href=["']https:\/\/amnex\.com\/jobs\/[^"']+["']/i.test(page)
}

export const buildTaxonomyMap = (terms = []) =>
  new Map(
    (Array.isArray(terms) ? terms : [])
      .map((term) => [String(term?.id ?? ''), normalizeWhitespace(term?.name)])
      .filter(([, label]) => label),
  )

export const extractListingJobs = (jobRecords = [], locationTerms = [], yearTerms = []) => {
  if (!Array.isArray(jobRecords)) return []

  const locationsById = buildTaxonomyMap(locationTerms)
  const yearsById = buildTaxonomyMap(yearTerms)

  return jobRecords.map((record) => {
    const title = normalizeWhitespace(record?.title?.rendered)
    const sourceUrl = toAbsoluteUrl(record?.link, PROFESSIONAL_OPPORTUNITIES_URL)
    const jobId = normalizeWhitespace(String(record?.id ?? ''))
    const locationNames = (Array.isArray(record?.job_locations) ? record.job_locations : [])
      .map((id) => locationsById.get(String(id)))
      .filter(Boolean)

    if (!title || !sourceUrl || !jobId || !isLikelyIndiaLocationNames(locationNames)) {
      return null
    }

    return {
      title,
      location: formatLocation(locationNames),
      city: extractCityFromLocationNames(locationNames),
      country: COUNTRY_FILTER,
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: yearsById.get(String((record?.job_years || [])[0])) || null,
      postingDate: normalizePostingDate(record?.date_gmt || record?.date),
      closingDate: null,
      department: null,
      jobDescription: null,
    }
  }).filter(Boolean)
}

export const hasOfficialJobDetailSignal = (html, expectedListing = null) => {
  const page = String(html ?? '')
  const detailTitle = extractDetailRoleTitle(page)
  const sourceUrl = expectedListing?.sourceUrl || VERIFIED_JOB_DETAIL_URL

  return extractCanonicalUrl(page) === sourceUrl
    && Boolean(detailTitle)
    && detailTitle === (expectedListing?.title || detailTitle)
    && Boolean(extractFieldValue(page, 'Employment'))
    && Boolean(extractFieldValue(page, 'Experience'))
    && Boolean(extractFieldValue(page, 'Location'))
    && Boolean(extractFieldValue(page, 'Job Code'))
    && hasInlineApplyForm(page)
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const rawLocation = extractFieldValue(page, 'Location')
  const location = formatLocation([rawLocation]) || listing.location || null

  return {
    title: extractDetailRoleTitle(page) || listing.title || null,
    company: COMPANY_NAME,
    department: null,
    location,
    city: extractCityFromLocationLabel(location) ?? listing.city ?? null,
    country: COUNTRY_FILTER,
    jobId: listing.jobId || null,
    requisitionId: extractFieldValue(page, 'Job Code') || listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || VERIFIED_JOB_DETAIL_URL,
    applyUrl: listing.applyUrl || listing.sourceUrl || VERIFIED_JOB_DETAIL_URL,
    employmentType: extractFieldValue(page, 'Employment') || listing.employmentType || null,
    experienceRequired:
      normalizeExperienceLabel(extractFieldValue(page, 'Experience'))
      || listing.experienceRequired
      || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    jobDescription: extractDescriptionText(page) || listing.jobDescription || null,
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createAmnexInfoTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careerHubHtml = await fetchText(CAREER_HUB_URL)
    if (!hasOfficialCareerHubSignal(careerHubHtml)) {
      throw new Error(
        'Amnex InfoTechnologies verified careers hub no longer matches the trusted public surface',
      )
    }

    if (extractProfessionalOpportunitiesUrl(careerHubHtml) !== PROFESSIONAL_OPPORTUNITIES_URL) {
      throw new Error(
        'Amnex InfoTechnologies verified careers hub no longer points to the trusted openings route',
      )
    }

    const opportunitiesHtml = await fetchText(PROFESSIONAL_OPPORTUNITIES_URL)
    if (!hasOfficialProfessionalOpportunitiesSignal(opportunitiesHtml)) {
      throw new Error(
        'Amnex InfoTechnologies verified openings page no longer matches the trusted public surface',
      )
    }

    const [jobRecords, locationTerms, yearTerms] = await Promise.all([
      fetchJson(JOBS_API_URL),
      fetchJson(JOB_LOCATIONS_API_URL),
      fetchJson(JOB_YEARS_API_URL),
    ])

    const listings = extractListingJobs(jobRecords, locationTerms, yearTerms)
    if (
      !Array.isArray(jobRecords)
      || !Array.isArray(locationTerms)
      || !Array.isArray(yearTerms)
      || listings.length === 0
    ) {
      throw new Error(
        'Amnex InfoTechnologies verified jobs feed no longer matches the trusted public surface',
      )
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      detailHtmlByUrl[listing.sourceUrl] = await fetchText(listing.sourceUrl)
    }))

    return selectedListings.map((listing) => {
      const detailHtml = detailHtmlByUrl[listing.sourceUrl]
      if (!hasOfficialJobDetailSignal(detailHtml, listing)) {
        throw new Error(
          'Amnex InfoTechnologies verified detail page no longer matches the trusted public surface',
        )
      }

      const job = extractJobDetail(detailHtml, listing)

      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }
    })
  },
})

export const run = async (options = {}) => createAmnexInfoTechnologiesScraper().run(options)

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
