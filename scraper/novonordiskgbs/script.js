import {runNovoNordiskGbsNative} from './nativeCareers.js'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.novonordisk.com'
const SEARCH_PATH = '/search/?q=&locationsearch=India'
const ALLOWED_CITY_PATTERN = /\b(bangalore|bengaluru)\b/i
const GBS_PATTERN = /\b(?:novo nordisk global business services|global business services|gbs)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
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
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toOfficialUrl = (value) => {
  try {
    const url = new URL(decodeHtmlEntities(value), BASE_URL)
    return url.origin === BASE_URL ? url.toString() : null
  } catch {
    return null
  }
}

const normalizePostingDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const match = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(text)
  if (!match) return text

  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .indexOf(match[2])
  if (month < 0) return text

  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractLabelValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWhitespace(extractFirst(
    new RegExp(`<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i'),
    html,
  ))
}

export const isIndiaLocation = (location) => /(?:\bIN\b|\bIndia\b)/i.test(location ?? '')

export const isBengaluruLocation = (location) => ALLOWED_CITY_PATTERN.test(location ?? '')

export const isNovoNordiskGbsOrganization = (value) => GBS_PATTERN.test(value ?? '')

export const buildIndiaSearchUrl = (startRow = null) => {
  const url = new URL(SEARCH_PATH, BASE_URL)
  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => {
    const row = match[1]
    const linkMatch = /<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i.exec(row)
    const title = normalizeWhitespace(linkMatch?.[2])
    const sourceUrl = toOfficialUrl(linkMatch?.[1])
    const location = normalizeWhitespace(extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row))
    const department = normalizeWhitespace(
      extractFirst(/<span\b[^>]*class=["'][^"']*(?:jobDepartment|jobCategory)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const postingDate = normalizePostingDate(
      extractFirst(/<span\b[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row),
    )
    const jobId = extractJobIdFromUrl(sourceUrl)

    if (!title || !location || !isIndiaLocation(location) || !sourceUrl || !jobId) return null

    return {
      title,
      location,
      city: location.split(',')[0]?.trim() || null,
      department,
      jobId,
      requisitionId: null,
      sourceUrl,
      postingDate,
    }
  })
  .filter(Boolean)

export const extractResultsSummary = (html) => {
  const label = stripTags(extractFirst(
    /<span class="paginationLabel"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const helpText = stripTags(extractFirst(
    /<span class="srHelp"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))

  const pageMatch = /Page\s+(\d+)\s+of\s+(\d+)/i.exec(helpText || '')
  const labelNumbers = [...String(label ?? '').matchAll(/\d[\d,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite)

  const [start, end, totalResults] = labelNumbers
  const currentPage = pageMatch ? Number.parseInt(pageMatch[1], 10) : null
  const totalPages = pageMatch ? Number.parseInt(pageMatch[2], 10) : null

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages) ? totalPages : null,
    pageSize: Number.isInteger(start) && Number.isInteger(end) ? end - start + 1 : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i, html)
  const applyUrl = toOfficialUrl(
    extractFirst(/<a\b[^>]*class=["'][^"']*apply[^"']*["'][^>]*href=["']([^"']+)["']/i, html),
  )
  const title = normalizeWhitespace(
    extractFirst(/<(?:h1|span)\b[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/(?:h1|span)>/i, html),
  ) || listing.title || null
  const location = extractLabelValue(html, 'Location(s):') || listing.location || null
  const organization = extractLabelValue(html, 'Company:')
    || extractLabelValue(html, 'Organization:')
    || extractLabelValue(html, 'Business Area:')
    || null

  return {
    title,
    location,
    city: location?.split(',')[0]?.trim() || listing.city || null,
    department: extractLabelValue(html, 'Category:') || listing.department || null,
    jobId: listing.jobId || extractJobIdFromUrl(listing.sourceUrl),
    requisitionId: extractLabelValue(html, 'Requisition ID:') || null,
    employmentType: extractLabelValue(html, 'Type of position:') || null,
    experienceRequired: extractLabelValue(html, 'Work experience:') || null,
    organization,
    jobDescription: stripTags(descriptionHtml),
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/<meta\b[^>]*itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html),
    ) || listing.postingDate || null,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
  }
}

export const createNovoNordiskGBSScraper = (options = {}) => ({
  run: (overrides = {}) => runNovoNordiskGbsNative({...options, ...overrides}),
})

export const run = async (options) => createNovoNordiskGBSScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Novo Nordisk GBS scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India GBS jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'novonordiskgbs')
    console.log('DB result:', result)
    process.exit(0)
  }
}
