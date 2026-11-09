import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NUBERG_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = NUBERG_CATALOG.source
export const COMPANY = NUBERG_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = NUBERG_CATALOG.officialBrandName
export const VERIFIED_ON = NUBERG_CATALOG.verifiedOn
export const PROVIDER_METADATA = NUBERG_CATALOG
export const HOMEPAGE_URL = NUBERG_CATALOG.homepageUrl
export const CAREERS_URL = NUBERG_CATALOG.companyCareerPage
export const APPLY_EMAIL = NUBERG_CATALOG.officialResumeSubmissionEmail
export const APPLY_MAILTO_URL = `mailto:${APPLY_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const titleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase())
  || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { location: null, city: null, country: 'India' }

  const cleaned = normalized.replace(/^HO\s*-\s*/i, '')
  const city = /\bnoida\b/i.test(cleaned) ? 'Noida' : titleCase(cleaned)
  const location = city ? `${city}, India` : `${cleaned}, India`

  return { location, city, country: 'India' }
}

const extractField = (body, label) =>
  normalizeWhitespace(
    body.match(
      new RegExp(
        `<strong>\\s*${label}\\s*:?\\s*<\\/strong>\\s*([^<]+?)\\s*(?:<br\\s*\\/?>|$)`,
        'i',
      ),
    )?.[1],
  )

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career\s*\|\s*Nuberg EPC\s*<\/title>/i.test(page)
    && /<h2[^>]*>\s*Current Opportunities:/i.test(page)
}

const getOpportunitiesSection = (html) =>
  String(html ?? '').match(
    /<h2[^>]*id=["']Opportunities["'][^>]*>\s*Current Opportunities:\s*<\/h2>([\s\S]*?)<h2[^>]*>\s*Application Form/i,
  )?.[1]
  || null

export const extractListings = (html) => {
  const section = getOpportunitiesSection(html)
  if (!section) {
    throw new Error('verified Nuberg careers page no longer exposes trusted public openings blocks')
  }

  const jobs = []
  const sourceUrl = `${CAREERS_URL}#Opportunities`

  for (const match of section.matchAll(
    /<h6[^>]*>\s*([^<]+?)\s*<\/h6>([\s\S]*?)<div class=["']apply-section["'][^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const body = match[2]
    const applySection = match[3]
    const experienceRequired = extractField(body, 'Experience')
    const industry = extractField(body, 'Industry')
    const minimumQualification = extractField(body, 'Education')
    const { location, city, country } = normalizeLocation(extractField(body, 'Location'))
    const applyUrl = normalizeWhitespace(
      applySection.match(/href=["']([^"']+)["']/i)?.[1],
    )
    const descriptionHtml = body.replace(
      /[\s\S]*?<strong>\s*Job Description\s*:\s*<\/strong>\s*(?:<br\s*\/?>)?/i,
      '',
    )
    const requiredSkills = [...descriptionHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)
    const jobDescription = stripTags(descriptionHtml)
    const jobId = slugify(title)

    if (!title || !location || !applyUrl || !jobDescription || !jobId) {
      continue
    }

    jobs.push({
      title,
      experienceRequired,
      industry,
      minimumQualification,
      location,
      city,
      country,
      requiredSkills,
      jobDescription,
      sourceUrl,
      applyUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  if (jobs.length === 0) {
    throw new Error('verified Nuberg careers page no longer exposes trusted public openings blocks')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNubergScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('verified Nuberg careers page no longer matches the trusted first-party contract')
    }

    const jobs = extractListings(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      preferredQualification: null,
      requiredSkills: job.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNubergScraper().run(options)

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
