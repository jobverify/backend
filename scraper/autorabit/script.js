import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.autorabit.com/company/careers/'

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

const extractVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<section\b[^>]*>/gi, '\n')
    .replace(/<article\b[^>]*>/gi, '\n')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toIsoDate = (value) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const readJobLocation = (posting = {}) => normalizeWhitespace(
  posting?.jobLocation?.address?.addressLocality,
)

const readJobCountry = (posting = {}) => normalizeWhitespace(
  posting?.jobLocation?.address?.addressCountry,
)

const isIndiaJob = (posting = {}) => /india/i.test(readJobCountry(posting) || '')

const extractJobId = (url) => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')
    return applyIndex >= 0 ? segments[applyIndex + 1] || null : null
  } catch {
    return null
  }
}

const extractJsonLdPostings = (html) => {
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

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractSearchResults = (html) => extractJsonLdPostings(html)
  .filter(isIndiaJob)
  .map((posting) => {
    const applyUrl = normalizeWhitespace(posting?.url)
    const city = readJobLocation(posting)
    const jobId = extractJobId(applyUrl)
    const jobDescription = normalizeWhitespace(posting?.description)

    return {
      title: normalizeWhitespace(posting?.title),
      company: normalizeWhitespace(posting?.hiringOrganization?.name) || 'AutoRABIT',
      department: null,
      location: city ? `${city}, India` : 'India',
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: normalizeWhitespace(posting?.employmentType),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDate(posting?.datePosted),
      closingDate: null,
      jobDescription,
      publicExperienceChecked: Boolean(jobDescription),
      remoteStatus: inferRemoteStatus(city),
    }
  })
  .filter((job) => job.title && job.jobId && job.applyUrl)

const extractDetailText = (html = '') => {
  const visibleText = extractVisibleText(html)
  if (!visibleText) return null

  const beforeApplicationForm = visibleText.split(/apply for this position/i)[0]?.trim() || ''
  return beforeApplicationForm || visibleText
}

const extractExplicitExperience = (detailText) => {
  const normalizedText = normalizeWhitespace(detailText)
  if (!normalizedText) return null

  const labelMatch = normalizedText.match(/\bexperience\s*:\s*([0-9][0-9+\-–to\s]*(?:years?|yrs?))/i)
  if (labelMatch?.[1]) {
    return normalizeWhitespace(labelMatch[1])
  }

  return null
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const enrichJobFromDetailPage = (job, detailHtml = '') => {
  const detailText = extractDetailText(detailHtml)
  const experienceRequired = (
    extractExplicitExperience(detailText)
    || inferExperienceFromDescription(detailText)
    || inferExperienceFromDescription(job.jobDescription)
    || job.experienceRequired
    || null
  )

  return {
    ...job,
    jobDescription: detailText || job.jobDescription || null,
    experienceRequired,
    publicExperienceChecked: Boolean(detailText),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'autorabit',
  timeoutMs: 15000,
})

export const createAutoRABITScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const enrichedJobs = []

    for (const job of selectedJobs) {
      try {
        enrichedJobs.push(enrichJobFromDetailPage(
          job,
          await fetchText(job.applyUrl || job.sourceUrl),
        ))
      } catch {
        enrichedJobs.push(job)
      }
    }

    return enrichedJobs.map((job) => ({
      ...job,
      source: 'autorabit',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAutoRABITScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AutoRABIT scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'autorabit')
    console.log('DB result:', result)
    process.exit(0)
  }
}
