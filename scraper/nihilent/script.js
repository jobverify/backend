import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NIHILENT_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPENINGS_URL = PROVIDER_METADATA.officialCareersPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const htmlToLines = (html = '') =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(article|section|div|p|h1|h2|h3|h4|h5|h6|li|ul|ol)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isIndiaLocation = (value) =>
  /(pune|chennai|kolkata|bangalore|bengaluru|hyderabad|mumbai|india)/i.test(String(value ?? ''))

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractPrimaryCity = (value) =>
  normalizeWhitespace(value).split(/[\/,]/)[0]?.trim() || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = htmlToLines(page).join(' ')

  return /<title>\s*Life At Nihilent\s*\|\s*Passion For Performance\s*\|\s*Nihilent\s*<\/title>/i.test(page)
    && text.includes('We are Nihilentians')
    && text.includes('Job Openings')
    && text.includes('view openings')
}

export const hasOfficialOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = htmlToLines(page).join(' ')

  return /<title>\s*Job Openings\s*\|\s*Open Positions\s*\|\s*Nihilent\s*<\/title>/i.test(page)
    && text.includes('Open Positions at Nihilent')
    && text.includes('Apply now')
}

export const extractSearchResults = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const blockText = htmlToLines(match[0]).join('\n')
    const title = normalizeWhitespace(
      blockText.match(/^([^\n]+)\nDesignation:/i)?.[1]
      || blockText.match(/Designation:\s*([^\n]+)/i)?.[1],
    )
    const locationValue = normalizeWhitespace(blockText.match(/Location:\s*([^\n]+)/i)?.[1] ?? '')
    const experience = normalizeWhitespace(blockText.match(/Experience:\s*([^\n]+)/i)?.[1] ?? '')
    const description = normalizeWhitespace(blockText.match(/About the Job Opening:\s*([^\n]+)/i)?.[1] ?? '')

    if (!title || !locationValue || !isIndiaLocation(locationValue)) {
      continue
    }

    const location = normalizeLocation(locationValue)
    const jobId = slugify(title)
    const sourceUrl = `${OPENINGS_URL}#${jobId}`

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractPrimaryCity(locationValue),
      country: 'India',
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: experience || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description || null,
    })
  }

  return jobs
}

export const createNihilentScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Nihilent verified first-party careers page no longer matches the trusted surface')
    }

    const openingsHtml = await fetchText(OPENINGS_URL)
    if (!hasOfficialOpeningsSignal(openingsHtml)) {
      throw new Error('Nihilent verified first-party job openings page no longer matches the trusted surface')
    }

    return extractSearchResults(openingsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNihilentScraper({
  now: options.now,
}).run({
  fetchText: options.fetchText,
})

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
