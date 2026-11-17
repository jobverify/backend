import { runCurrentManthan } from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MANTHAN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MANTHAN_CATALOG.source
export const COMPANY = MANTHAN_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MANTHAN_CATALOG.officialBrandName
export const VERIFIED_ON = MANTHAN_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MANTHAN_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = MANTHAN_CATALOG
export const HOMEPAGE_URL = MANTHAN_CATALOG.officialHomepageUrl
export const CAREERS_URL = MANTHAN_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripTags = (value) => normalizeWhitespace(value)

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)

  return {
    location,
    city: parts[0] || null,
    country: parts.at(-1) || null,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Manthan\s*<\/title>/i.test(rawHtml)
    && normalized.includes('we are manthan. we love technology, we love consumers.')
    && normalized.includes('we design prescriptive analytics applications powered by ai; on cloud, for customer-facing businesses.')
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Careers\s*(?:&#8211;|&ndash;|-)\s*Manthan\s*<\/title>/i.test(rawHtml)
    && normalized.includes('apply now')
}

export const extractLinkedInJobId = (value) =>
  String(value ?? '').match(/linkedin\.com\/jobs\/view\/(\d+)/i)?.[1] ?? null

export const parseRoleMeta = (value) => {
  const normalized = normalizeWhitespace(value)
  const parts = normalized.split('|').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const [experienceRequired = null, minimumQualification = null, rawLocation = null] = parts
  const locationData = parseLocation(rawLocation)

  return {
    experienceRequired,
    minimumQualification,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
  }
}

export const extractJobCards = (html) => [...String(html ?? '').matchAll(
  /<h4[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/h4>[\s\S]{0,500}?<(?:p|div)[^>]*>\s*([\s\S]*?)\s*<\/(?:p|div)>[\s\S]{0,400}?<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<span[^>]*>\s*Apply Now\s*<\/span>/gi,
)]
  .map((match) => {
    const [, rawTitle, rawMeta, rawApplyUrl] = match
    const applyUrl = normalizeWhitespace(rawApplyUrl)
    const jobId = extractLinkedInJobId(applyUrl)
    if (!jobId) return null

    const title = stripTags(rawTitle)
    const roleMeta = parseRoleMeta(rawMeta)
    if (!title || roleMeta.country !== 'India') return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: roleMeta.location,
      city: roleMeta.city,
      country: roleMeta.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: roleMeta.experienceRequired,
      minimumQualification: roleMeta.minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(rawMeta),
    }
  })
  .filter(Boolean)

// Historical format parsers above are pure helpers; every runtime caller uses the current native contract.
export const createManthanScraper = (defaults = {}) => ({
  run: (options = {}) => runCurrentManthan({...defaults, ...options}),
})

export const run = async (options = {}) => createManthanScraper().run(options)

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
