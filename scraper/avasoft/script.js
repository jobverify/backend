import path from 'path'
import { fileURLToPath } from 'url'
import { createAvasoftNativeInventory } from './nativeInventory.js'
import AVASOFT_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const CAREERS_URL = 'https://avasoft.com/career/'
const BASE_URL = 'https://avasoft.com'
export const PROVIDER_METADATA = AVASOFT_CATALOG

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => new URL(String(value ?? ''), BASE_URL).toString()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(
  /<li class="elementor-icon-list-item">[\s\S]*?<span class="elementor-icon-list-text">([\s\S]*?)<\/span>[\s\S]*?<\/li>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0] || normalized
}

const normalizeLocation = (value) => normalizeWhitespace(value)?.replace(/\s*Office$/i, '').trim() || null

const inferExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!normalized) return null
  if (/2025 passing outstudents|passing out students|freshers?|campus/i.test(normalized)) {
    return '0 - 1 Years'
  }
  return null
}

// Archived pure helpers retain the old fixture contract. Registered extraction
// below uses current visibility, full native role documents and inventory proof.
export const extractJobCards = (html) => [...String(html ?? '').matchAll(
  /<div[^>]*open-position[^>]*>[\s\S]*?<div class="elementor-widget-container">\s*([^<]+?)\s*<\/div>[\s\S]*?<h4 class="elementor-heading-title elementor-size-default"><a href="([^"]+)">([^<]+)<\/a><\/h4>[\s\S]*?<div class="elementor-widget-container">\s*([^<]+?)\s*<span class="star-icon"><\/span>\s*([^<]+?)\s*<\/div>/gi,
)]
  .map((match) => {
    const department = normalizeWhitespace(match[1])
    const href = normalizeWhitespace(match[2])
    const title = normalizeWhitespace(match[3])
    const location = normalizeLocation(match[4])
    const mode = normalizeWhitespace(match[5])

    if (!title || !href || !location) return null
    if (!/india/i.test(location)) return null

    return {
      title,
      location,
      city: extractCity(location),
      jobId: slugify(title),
      requisitionId: slugify(title),
      employmentType: 'Full-time',
      experienceRequired: null,
      postingDate: null,
      closingDate: null,
      sourceUrl: buildAbsoluteUrl(href),
      applyUrl: buildAbsoluteUrl('/contact-us/'),
      department,
      minimumQualification: null,
      requiredSkills: [],
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/<h1 class="elementor-heading-title elementor-size-default">([^<]+)<\/h1>/i, html),
  ) || listing.title || null
  const location = normalizeLocation(
    extractFirst(/<div class="elementor-widget-container">\s*([^<]+?)\s*<span class="star-icon"><\/span>\s*Office\s*<\/div>/i, html),
  ) || listing.location || null
  const whoCanApply = stripTags(extractFirst(
    /<p class="elementor-heading-title elementor-size-default">Who can apply\?<\/p>[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>/i,
    html,
  ))
  const requiredSkills = extractListItems(html)

  return {
    title,
    location,
    city: extractCity(location) || listing.city || null,
    jobId: listing.jobId || slugify(title),
    requisitionId: listing.requisitionId || slugify(title),
    department: listing.department || null,
    employmentType: 'Full-time',
    experienceRequired: inferExperienceRequired(whoCanApply) || listing.experienceRequired || null,
    jobDescription: whoCanApply,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    sourceUrl: listing.sourceUrl || buildAbsoluteUrl(extractFirst(/<link rel="canonical" href="([^"]+)"/i, html) || ''),
    applyUrl: buildAbsoluteUrl(extractFirst(/<a class="elementor-button elementor-button-link elementor-size-sm" href="([^"]+)"/i, html) || '/contact-us/'),
  }
}

export const createAvasoftScraper = (options = {}) => createAvasoftNativeInventory(options)

export const run = async (options = {}) => createAvasoftScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AVASOFT scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'avasoft')
    console.log('DB result:', result)
    process.exit(0)
  }
}
