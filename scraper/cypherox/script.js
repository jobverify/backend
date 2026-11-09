import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import CYPHEROX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CYPHEROX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const MIN_VERIFIED_JOB_GRAPH_COUNT = 2
const CAREERS_TITLE_PATTERN =
  /<title>\s*(?:Tech Careers at Cypherox\s*\|\s*Software Job Openings & Hiring|Engineering Careers\s*\|\s*Join a Growing AI Development Team)\s*<\/title>/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const collectJobPostingNodes = (value, jobs = []) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectJobPostingNodes(entry, jobs)
    }
    return jobs
  }

  if (!value || typeof value !== 'object') return jobs
  if (value['@type'] === 'JobPosting') {
    jobs.push(value)
  }

  for (const entry of Object.values(value)) {
    collectJobPostingNodes(entry, jobs)
  }

  return jobs
}

const extractStructuredDataObjects = (html = '') => {
  const objects = []

  for (const match of String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      objects.push(JSON.parse(match[1]))
    } catch {
      continue
    }
  }

  return objects
}

const formatLocation = (city, country) => {
  const normalizedCity = normalizeWhitespace(city)
  if (!normalizedCity) return normalizeWhitespace(country) || 'India'
  if ((country || '').toUpperCase() === 'IN' || /india/i.test(String(country ?? ''))) {
    return `${normalizedCity}, India`
  }
  return normalizedCity
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return CAREERS_TITLE_PATTERN.test(page)
    && /Current Opportunities/i.test(page)
    && /Apply Now/i.test(page)
}

export const extractJobsFromStructuredData = (html = '', { scrapedAt } = {}) => {
  const jobs = []

  for (const object of extractStructuredDataObjects(html)) {
    for (const posting of collectJobPostingNodes(object)) {
      const fragment = normalizeWhitespace(posting?.['@id']?.split('#')[1])
      const title = normalizeWhitespace(posting?.title)
      const description = normalizeWhitespace(posting?.description)
      const city = normalizeWhitespace(posting?.jobLocation?.address?.addressLocality)
      const country = normalizeWhitespace(posting?.jobLocation?.address?.addressCountry)

      if (!fragment || !title || !description) continue

      const sourceUrl = `${CAREERS_URL}#${fragment}`
      jobs.push({
        jobId: fragment,
        title,
        company: COMPANY,
        department: null,
        location: formatLocation(city, country),
        city: city || null,
        country: 'India',
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(posting?.employmentType),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: description,
        requisitionId: fragment,
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      })
    }
  }

  return jobs
}

export const createCypheroxScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Cypherox careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobsFromStructuredData(careersHtml, {
      scrapedAt: now(),
    })
    if (jobs.length < MIN_VERIFIED_JOB_GRAPH_COUNT) {
      throw new Error('The verified Cypherox embedded jobs graph no longer matches the trusted first-party surface')
    }

    return jobs.map((job) => ({
      ...job,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'cypherox.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createCypheroxScraper(options).run(options)

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
