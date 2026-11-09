import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { BUDDI_AI_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const toAnchorUrl = (title) => `${CAREERS_URL}#${slugify(title)}`

const normalizeIndiaLocation = (value) => {
  const cleaned = normalizeWhitespace(String(value ?? '').replace(/^Location:\s*/i, ''))
  if (!cleaned) return null
  const normalized = cleaned.replace(/\s*,\s*/g, ', ')
  if (/\bchennai\b/i.test(normalized)) return 'Chennai, India'
  return normalized
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('BUDDI.AI')
    && text.includes('Healthcare AI Automation Platform')
    && text.includes("You're in good company")
    && text.includes('Hello Automation, Goodbye Complexity.')
    && text.includes('Medical Coders')
}

const extractRoleBlocks = (html = '') => [
  ...Array.from(
    String(html ?? '').matchAll(/<div[^>]*class=["'][^"']*blurbs[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi),
    (match) => match[1],
  ),
  ...Array.from(
    String(html ?? '').matchAll(/<section[^>]*class=["'][^"']*role[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi),
    (match) => match[1],
  ),
]

export const extractJobs = (html = '') => {
  const jobs = []
  const seen = new Set()
  const page = String(html ?? '')

  for (const block of extractRoleBlocks(page)) {
    const department = normalizeWhitespace(
      block.match(/<p[^>]*class=["'][^"']*pink-header[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]
      || block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1],
    )
    const title = normalizeWhitespace(block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const detailsText = normalizeWhitespace(
      block.match(/<p[^>]*class=["'][^"']*white-description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]
      || block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1],
    )
    const location = normalizeIndiaLocation(
      detailsText?.match(/Location:\s*(.*?)(?:No\.\s*of openings:\s*\d+|$)/i)?.[1]
      || detailsText?.match(/([^<]*United States of America[^<]*)/i)?.[1],
    )
    const jobDescription = normalizeWhitespace(
      detailsText?.split(/Location:/i)[0] || '',
    )

    if (!title || !location || !/\bindia\b/i.test(location)) continue

    const city = normalizeCity(location.split(',')[0]) || location.split(',')[0].trim()
    const anchorUrl = toAnchorUrl(title)
    const jobId = slugify(title)
    const dedupeKey = `${jobId}:${location.toLowerCase()}`

    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      company: COMPANY,
      department: department || null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: anchorUrl,
      applyUrl: anchorUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: jobDescription || null,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

export const createBuddiAiScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified BUDDI.AI careers surface no longer matches the trusted first-party page')
    }

    const scrapedAt = now()
    return extractJobs(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createBuddiAiScraper(options).run(options)

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
