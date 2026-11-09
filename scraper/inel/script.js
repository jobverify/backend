import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://indianippon.com/career'
export const OPEN_POSITIONS_URL = `${CAREER_PAGE_URL}#career-opportunities`

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const splitSkills = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((item) => normalizeWhitespace(item))
  .filter(Boolean) || []

const formatLocation = (posting = {}) => {
  const locality = normalizeWhitespace(posting?.jobLocation?.address?.addressLocality)
  const region = normalizeWhitespace(posting?.jobLocation?.address?.addressRegion)
  const countryCode = normalizeWhitespace(posting?.jobLocation?.address?.addressCountry)?.toUpperCase()
  const parts = [locality, region]

  if (countryCode === 'IN') {
    parts.push('India')
  } else if (countryCode) {
    parts.push(countryCode)
  }

  const formatted = parts.filter(Boolean).join(', ')
  return formatted || 'India'
}

const readCity = (posting = {}) => normalizeWhitespace(
  posting?.jobLocation?.address?.addressLocality,
)

const readCountry = (posting = {}) => {
  const countryCode = normalizeWhitespace(posting?.jobLocation?.address?.addressCountry)?.toUpperCase()
  return countryCode === 'IN' ? 'India' : countryCode || 'India'
}

const readJobId = (posting = {}) => normalizeWhitespace(
  posting?.identifier?.value
  || posting?.identifier?.name,
)

const extractJsonLdJobPostings = (html) => {
  const postings = []

  for (const match of String(html ?? '').matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1])
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        if (item?.['@type'] === 'JobPosting') {
          postings.push(item)
        }
      }
    } catch {
      // Ignore unrelated structured data blocks.
    }
  }

  return postings
}

export const hasCareerPageSignal = (html) => (
  /India Nippon Electricals Ltd|INEL-TALENT|career-opportunities/i.test(String(html ?? ''))
)

export const extractSearchResults = (html) => extractJsonLdJobPostings(html)
  .map((posting) => {
    const jobId = readJobId(posting)

    return {
      title: normalizeWhitespace(posting?.title),
      company: normalizeWhitespace(posting?.hiringOrganization?.name) || 'India Nippon Electricals Limited',
      department: null,
      location: formatLocation(posting),
      city: readCity(posting),
      country: readCountry(posting),
      jobId,
      requisitionId: jobId,
      sourceUrl: OPEN_POSITIONS_URL,
      applyUrl: OPEN_POSITIONS_URL,
      employmentType: normalizeWhitespace(posting?.employmentType),
      experienceRequired: normalizeWhitespace(posting?.experienceRequirements),
      minimumQualification: normalizeWhitespace(posting?.qualifications),
      preferredQualification: null,
      requiredSkills: splitSkills(posting?.skills),
      postingDate: toIsoDate(posting?.datePosted),
      closingDate: toIsoDate(posting?.validThrough),
      jobDescription: normalizeWhitespace(
        posting?.description
        || posting?.responsibilities,
      ),
      remoteStatus: 'On-site',
    }
  })
  .filter((job) => job.title && job.jobId)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'inel',
  timeoutMs: 15000,
})

export const createINELScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasCareerPageSignal(html)) {
      throw new Error('INEL careers page no longer exposes the expected careers signal')
    }

    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'inel',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createINELScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running INEL scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'inel')
    console.log('DB result:', result)
    process.exit(0)
  }
}
