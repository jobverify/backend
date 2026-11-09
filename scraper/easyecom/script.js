import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { runNativeInventory } from './native.js'
export { extractNativeInventory } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://easyecom.io/careers'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const decodeHtmlEntities = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREER_PAGE_URL).toString()
  } catch {
    return null
  }
}

const toJobId = (url) => {
  const normalized = toAbsoluteUrl(url)
  if (!normalized) return null

  try {
    const pathname = new URL(normalized).pathname.replace(/\/+$/, '')
    return pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

const inferRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase() || ''
  if (normalized.includes('hybrid') || normalized.includes('remote')) return 'Hybrid'
  return 'On-site'
}

const buildLocation = (city) => {
  const normalized = normalizeWhitespace(city)
  if (!normalized) return 'India'
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractTabContent = (tabName, html) => {
  const document = String(html ?? '')
  const start = document.search(new RegExp(`<div[^>]+data-w-tab="${tabName}"[^>]*>`, 'i'))
  if (start < 0) return null

  const remainder = document.slice(start)
  const nextTabIndex = remainder.slice(1).search(/<div[^>]+data-w-tab="Tab \d"[^>]*>/i)
  const tabHtml = nextTabIndex >= 0 ? remainder.slice(0, nextTabIndex + 1) : remainder
  const match = tabHtml.match(/<div class="rich-text-v2 w-richtext">([\s\S]*?)<\/div>/i)
  return match ? match[1] : null
}

const extractSectionLines = (html) => [...String(html ?? '').matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
  .map((match) => stripTags(match[2])?.replace(/^[●•*\-]\s*/, ''))
  .filter(Boolean)

// Archived Webflow fixture readers remain exported for historical data review.
// The registered runtime below exclusively uses the current native inventory.
export const extractSearchResults = (html) => {
  const pattern = /<div role="listitem" class="career-item w-dyn-item">[\s\S]*?<h3 class="heading-h3-size mg-bottom-10px">([\s\S]*?)<\/h3>[\s\S]*?<div class="text-200 medium color-neutral-800">([\s\S]*?)<\/div>[\s\S]*?<a href="([^"]+)" class="btn-primary width-100---mbl w-button">Apply now<\/a>/gi

  return [...String(html ?? '').matchAll(pattern)]
    .map((match) => {
      const title = stripTags(match[1])
      const city = stripTags(match[2])
      const sourceUrl = toAbsoluteUrl(match[3])
      const jobId = toJobId(sourceUrl)

      if (!title || !city || !sourceUrl || !jobId) return null

      return {
        title,
        company: 'EasyEcom',
        department: null,
        location: buildLocation(city),
        city,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: inferRemoteStatus(city),
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(extractFirst(/<h1[^>]*class="display-1[^"]*"[^>]*>([\s\S]*?)<\/h1>/i, html)) || listing.title || null
  const headerDetails = [...String(html ?? '').matchAll(/<div class="text-200 medium color-neutral-100">([\s\S]*?)<\/div>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const city = headerDetails[0] || listing.city || null
  const employmentType = normalizeEmploymentType(headerDetails[1] || null)

  const aboutHtml = extractTabContent('Tab 1', html)
  const responsibilitiesHtml = extractTabContent('Tab 2', html)
  const requirementsHtml = extractTabContent('Tab 3', html)
  const applyUrl = toAbsoluteUrl(extractFirst(/<a href="([^"]+)" class="btn-primary w-button">Apply now<\/a>/i, html)) || listing.applyUrl || null

  const responsibilities = extractSectionLines(responsibilitiesHtml).filter((line) => !/responsibilities:?/i.test(line))
  const requirements = extractSectionLines(requirementsHtml).filter((line) => !/requirements:?/i.test(line))
  const aboutLines = extractSectionLines(aboutHtml)

  return {
    ...listing,
    title,
    location: listing.location || buildLocation(city),
    city,
    employmentType,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
    jobDescription: [stripTags(aboutHtml), stripTags(responsibilitiesHtml), stripTags(requirementsHtml)]
      .filter(Boolean)
      .join('\n\n'),
    minimumQualification: requirements[0] || null,
    preferredQualification: requirements[1] || null,
    requiredSkills: responsibilities,
    experienceRequired: listing.experienceRequired || null,
    department: listing.department || null,
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    country: 'India',
    remoteStatus: listing.remoteStatus || inferRemoteStatus(city),
    aboutLines,
  }
}

function extractFirst(pattern, value, transform = (match) => match[1]) {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

function normalizeEmploymentType(value) {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  if (/full[\s-]*time/.test(normalized)) return 'Full-time'
  if (/hybrid/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

export const createEasyEcomScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    return runNativeInventory({ ...options, maxJobs })
  },
})

export const run = async options => createEasyEcomScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EasyEcom scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'easyecom')
    console.log('DB result:', result)
    process.exit(0)
  }
}
