import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INFINITI_SOFTWARE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INFINITI_SOFTWARE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:chennai|mumbai|india)\b/i
const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (!url.hostname.endsWith('goodfit.so')) return null
    if (!/\/(?:apply|jobs)\//i.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const extractJobId = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  attempts: 1,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  return /<title[^>]*>\s*Travel Tech Jobs\s*(?:&amp;|&)\s*Careers at Infiniti Software Solutions\s*<\/title>/i.test(page)
    && normalized.includes('Explore Job Opportunities')
    && /goodfit\.so\/apply/i.test(page)
}

export const extractJobsSection = (html = '') =>
  String(html ?? '').match(
    /<h2[^>]*>\s*Explore Job Opportunities\s*<\/h2>([\s\S]*?)(?=<h2[^>]*>\s*Life at Infiniti\s*<\/h2>|$)/i,
  )?.[1] ?? ''

export const extractJobs = (html = '') => {
  const jobsSection = extractJobsSection(html)
  const sectionHtml = jobsSection || String(html ?? '')
  const jobs = []
  const seen = new Set()
  const roleHeadings = [...sectionHtml.matchAll(
    /<h2[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi,
  )]

  for (let index = 0; index < roleHeadings.length; index += 1) {
    const headingMatch = roleHeadings[index]
    const nextHeadingIndex = roleHeadings[index + 1]?.index ?? sectionHtml.length
    const localBlock = sectionHtml.slice(headingMatch.index, nextHeadingIndex)
    const title = normalizeWhitespace(headingMatch[1])
    const applyUrl = toAbsoluteUrl(
      localBlock.match(/<a[^>]*href=["']([^"']*goodfit\.so[^"']+)["'][^>]*>/i)?.[1],
    )
    const jobId = extractJobId(applyUrl)
    if (!title || title === 'Explore Job Opportunities' || !applyUrl || !jobId || seen.has(jobId)) continue

    const descriptionBlock = localBlock.match(
      /<div[^>]*class=["'][^"']*elementor-widget-text-editor[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*elementor-widget-container[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    )?.[1]
    const iconValueMatches = [...localBlock.matchAll(
      /<div[^>]*class=["'][^"']*elementor-icon-box-title[^"']*["'][^>]*>\s*<span\b[^>]*>\s*([^<]+)\s*<\/span>\s*<\/div>/gi,
    )]
    const iconValues = iconValueMatches
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const experienceRequired = iconValues[0] || null
    const city = iconValues[1] || null
    const jobDescription = normalizeWhitespace(descriptionBlock)

    if (!title || !city || !applyUrl || !jobId || !INDIA_LOCATION_PATTERN.test(city)) continue
    seen.add(jobId)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${city}, India`,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

export const createInfinitiSoftwareSolutionsScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let html
    try {
      html = await fetchText(CAREERS_URL)
    } catch (error) {
      throw new Error(
        `Infiniti Software Solutions API-only scraper could not fetch its careers page: ${error?.message ?? error}`,
        { cause: error },
      )
    }

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Infiniti Software Solutions careers surface no longer matches the trusted first-party page')
    }

    const jobs = extractJobs(html)
    if (jobs.length === 0) {
      throw new Error(
        'Infiniti Software Solutions API-only scraper received an unusable JavaScript-only careers shell',
      )
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createInfinitiSoftwareSolutionsScraper().run(options)

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
