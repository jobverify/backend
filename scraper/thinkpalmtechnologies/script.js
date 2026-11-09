import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { THINKPALM_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = THINKPALM_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const CITY_MAP = {
  cochin: 'Cochin, Kerala, India',
  trivandrum: 'Trivandrum, Kerala, India',
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&rsquo;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const parseTitleAndExperience = (rawTitle) => {
  const normalized = normalizeWhitespace(rawTitle)
  const match = normalized.match(/^(.*?)\s*-\s*([0-9+]+\s*Years?)$/i)

  if (!match) {
    return {
      title: normalized,
      experienceRequired: null,
    }
  }

  return {
    title: normalizeWhitespace(match[1]),
    experienceRequired: normalizeWhitespace(match[2]),
  }
}

const normalizeLocation = (value) => {
  const city = normalizeWhitespace(value)
  return {
    location: CITY_MAP[city.toLowerCase()] || `${city}, India`,
    city,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*ThinkPalm Careers\s*\|\s*Job Openings\s*\|\s*Work Culture and Values\s*<\/title>/i
      .test(page)
    && /Open Positions/i.test(page)
    && /DotNet Architect/i.test(page)
    && /Java Tech Lead/i.test(page)
    && /Lead Cloud Engineer/i.test(page)
    && /\bApply\b/i.test(page)
}

export const extractJobs = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<article[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
  )) {
    const block = match[1]
    const href = block.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1]
    const rawTitle = normalizeWhitespace(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const locationValue = normalizeWhitespace(block.match(/<p[^>]*class=["']location["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const parsedTitle = parseTitleAndExperience(rawTitle)
    const normalizedLocation = normalizeLocation(locationValue)
    const jobId = slugify(parsedTitle.title)

    if (!href || !parsedTitle.title || !locationValue || !jobId) continue

    const sourceUrl = new URL(href, CAREERS_URL).toString()

    jobs.push({
      title: parsedTitle.title,
      company: COMPANY,
      department: null,
      location: normalizedLocation.location,
      city: normalizedLocation.city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: parsedTitle.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

export const createThinkPalmTechnologiesScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error(
        'The verified ThinkPalm Technologies careers surface no longer matches the trusted first-party page',
      )
    }

    const jobs = extractJobs(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createThinkPalmTechnologiesScraper().run(options)

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
