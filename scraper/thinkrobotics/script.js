import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://thinkrobotics.com/'
export const CAREERS_PORTAL_URL = 'https://jobs.thinkrobotics.com/jobs/Careers'
export const COMPANY = 'Atlantis Robotics Pvt. Ltd.'
export const SOURCE = 'thinkrobotics'

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

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const hasInputWithId = (html, id) => new RegExp(
  `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`,
  'i',
).test(String(html ?? ''))

const extractInputValue = (html, id) => {
  const match = new RegExp(
    `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*\\bvalue=(["'])([\\s\\S]*?)\\1[^>]*>`,
    'i',
  ).exec(String(html ?? ''))

  return match ? decodeHtmlEntities(match[2]) : null
}

const buildJobSlug = (title) => {
  const normalized = normalizeWhitespace(title)
  if (!normalized) return ''
  return encodeURIComponent(normalized.replace(/\s+/g, '-'))
}

const buildJobUrl = ({ id, title, rawUrl }) => {
  const sourceUrl = normalizeWhitespace(rawUrl)
  if (sourceUrl) return sourceUrl
  return `${CAREERS_PORTAL_URL}/${normalizeWhitespace(id) || ''}/${buildJobSlug(title)}?source=CareerSite`
}

const extractJobsPayload = (html) => {
  const rawPayload = extractInputValue(html, 'jobs')
  if (!rawPayload) return []

  try {
    const parsed = JSON.parse(rawPayload)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)
  const location = [city, country].filter(Boolean).join(', ') || null

  return { location, city, state, country }
}

const normalizeRemoteStatus = (record = {}) => {
  if (record.Remote_Job === true) return 'Remote'
  if (record.Remote_Job === false) return 'On-site'
  return null
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const isPublishedRecord = (record = {}) => record.Publish !== false

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /https:\/\/jobs\.thinkrobotics\.com(?:\/jobs\/Careers)?/i.test(page)
    && /ThinkRobotics/i.test(page)
    && /Atlantis Robotics/i.test(page)
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at ThinkRobotics\s*-\s*Atlantis Robotics Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && /https:\/\/jobs\.thinkrobotics\.com\/jobs\/Careers/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

export const extractIndiaJobs = (html) => extractJobsPayload(html)
  .filter((record) => isPublishedRecord(record) && isIndiaJob(record))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = buildJobUrl({
      id: jobId,
      title,
      rawUrl: record.$url,
    })
    const { location, city, state, country } = normalizeLocation(record)

    if (!title || !jobId || !sourceUrl || !location || country !== 'India') return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: normalizeRemoteStatus(record),
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

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createThinkRoboticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official ThinkRobotics careers page')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official ThinkRobotics careers portal')
    }

    const jobs = extractIndiaJobs(portalHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createThinkRoboticsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ThinkRobotics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
