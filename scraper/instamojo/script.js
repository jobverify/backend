import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { INSTAMOJO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = INSTAMOJO_CATALOG.source
export const COMPANY = INSTAMOJO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = INSTAMOJO_CATALOG.officialBrandName
export const VERIFIED_ON = INSTAMOJO_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = INSTAMOJO_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = INSTAMOJO_CATALOG
export const HOMEPAGE_URL = INSTAMOJO_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = INSTAMOJO_CATALOG.companyCareerPage
export const JOBS_BOARD_URL = INSTAMOJO_CATALOG.jobsBoardUrl
export const VERIFIED_SAMPLE_JOB_URL = INSTAMOJO_CATALOG.verifiedSampleJobUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('part time') || normalized.includes('part-time')) return 'Part-time'
  return normalizeWhitespace(value)
}

const getRemoteStatus = (value) => (/remote/i.test(value ?? '') ? 'Remote' : 'On-site')

const getCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

export const extractJobsBoardUrl = (html) => {
  const page = String(html ?? '')
  for (const match of page.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], CAREERS_PAGE_URL).toString()
      if (url === JOBS_BOARD_URL) return url
    } catch {
      continue
    }
  }

  return null
}

const getJobsList = (html) => {
  const match = String(html ?? '').match(/window\.jobsList\s*=\s*(\{[\s\S]*?\});/)
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const hasOfficialTeamPageSignal = (html) => {
  const page = String(html ?? '')
  const hasVerifiedTeamCopy = /Join the Instamojo team/i.test(page)
    || /People That Put The Mojo \(Magic\) In Instamojo/i.test(page)
    || /Discover the people of Instamojo/i.test(page)

  return /<title>\s*Life at Instamojo - Culture, team, jobs, and mojo!\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.instamojo\.com\/company\/team\/["']/i.test(page)
    && hasVerifiedTeamCopy
    && /careers@instamojo\.com/i.test(page)
    && extractJobsBoardUrl(page) === JOBS_BOARD_URL
}

export const hasOfficialJobsBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Instamojo\s*<\/title>/i.test(page)
    && /Check out our job openings here!/i.test(page)
    && /window\.jobsList\s*=/i.test(page)
}

export const extractRecruiterflowJobs = (html) => {
  const jobsList = getJobsList(html)
  if (!Array.isArray(jobsList?.department)) return []

  return jobsList.department.flatMap(([department, listings]) => (
    Array.isArray(listings)
      ? listings.map((listing) => {
        const title = normalizeWhitespace(listing?.job_name)
        const jobId = normalizeWhitespace(listing?.job_id)
        const location = normalizeWhitespace(listing?.details)
        const applyPath = normalizeWhitespace(listing?.apply_link)

        if (!title || !jobId || !location || !applyPath) return null

        const applyUrl = new URL(applyPath, 'https://recruiterflow.com/').href
        return {
          title,
          company: COMPANY,
          department: normalizeWhitespace(department),
          location,
          city: getCity(location),
          country: 'India',
          jobId,
          requisitionId: jobId,
          sourceUrl: applyUrl,
          applyUrl,
          employmentType: normalizeEmploymentType(listing.employment_type),
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: normalizeWhitespace(listing.last_opened),
          closingDate: null,
          jobDescription: null,
          remoteStatus: getRemoteStatus(listing.remote_type),
        }
      }).filter(Boolean)
      : []
  ))
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createInstamojoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialTeamPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Instamojo team page')
    }

    const jobsBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasOfficialJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('Response is not the verified Instamojo Recruiterflow jobs board')
    }

    const jobs = extractRecruiterflowJobs(jobsBoardHtml)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createInstamojoScraper().run(options)

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
