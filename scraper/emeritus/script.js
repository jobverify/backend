import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://careers.emeritus.org/'
export const CAREERS_PAGE_URL = 'https://careers.emeritus.org/jobs/'

const COMPANY = 'Emeritus'
const SOURCE = 'emeritus'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeLocationLabel = (value) => normalizeWhitespace(value)?.replace(/\s*\(OL_[^)]+\)\s*/gi, '').trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/permanent|full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeExperienceRange = (fromValue, toValue) => {
  const from = normalizeWhitespace(fromValue)
  const to = normalizeWhitespace(toValue)
  if (from && to) return `${from}-${to} years`
  if (from) return `${from}+ years`
  if (to) return `Up to ${to} years`
  return null
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (!match) return normalized
  return `${match[3]}-${match[2]}-${match[1]}`
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Careers at Emeritus\s*<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && /https:\/\/careers\.emeritus\.org\/jobs\//i.test(page)
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Current Openings - Emeritus Careers\s*<\/title>/i.test(page)
    && /var jobListData = \[/i.test(page)
    && /location_country":"India"/i.test(page)
}

export const extractJobListData = (html) => {
  const page = String(html ?? '')
  const match = page.match(/var\s+jobListData\s*=\s*(\[[\s\S]*?\]);/)
  if (!match) {
    throw new Error('Emeritus jobs page no longer exposes the embedded jobListData payload')
  }

  return JSON.parse(match[1])
}

export const extractIndiaJobs = (records) => (Array.isArray(records) ? records : [])
  .filter((record) => Number(record?.post_on_careers_page) === 1)
  .filter((record) => /india/i.test(normalizeWhitespace(record?.location_country) || ''))
  .map((record) => {
    const title = normalizeWhitespace(record.job_title)
    const locationValues = Array.isArray(record.location) ? record.location.map(normalizeLocationLabel).filter(Boolean) : []
    const location = locationValues[0] || normalizeWhitespace(record.location_country)
    const city = Array.isArray(record.location_city)
      ? normalizeWhitespace(record.location_city[0])
      : normalizeWhitespace(record.location_city)
    const jobId = normalizeWhitespace(record.job_id)
    const requisitionId = normalizeWhitespace(record.job_code)

    if (!title || !location || !jobId) return null

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(record.department),
      location,
      city,
      country: 'India',
      jobId,
      requisitionId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: CAREERS_PAGE_URL,
      employmentType: normalizeEmploymentType(record.employee_type),
      experienceRequired: normalizeExperienceRange(record.experience_from, record.experience_to),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizePostingDate(record.job_created_timestamp),
      closingDate: null,
      jobDescription: null,
      remoteStatus: Number(record.is_remote) === 1 ? 'Remote' : 'On-site',
    }
  })
  .filter(Boolean)

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

export const createEmeritusScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Emeritus homepage no longer matches the verified official careers entry surface')
    }

    const jobsPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsPageHtml)) {
      throw new Error('Emeritus jobs page no longer matches the verified official embedded listings surface')
    }

    const listings = extractIndiaJobs(extractJobListData(jobsPageHtml))
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createEmeritusScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Emeritus scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
