import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'ramcosystemsltd'
export const COMPANY_NAME = 'Ramco Systems Ltd.'
export const CAREERS_URL = 'https://www.ramco.com/careers/'
export const JOBS_URL = 'https://www.ramco.com/careers/jobs-by-locations'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
)

const decodeJsString = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/\\`/g, '`')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
)

const extractQuotedValue = (block, key) => {
  const pattern = new RegExp(`"${key}"\\s*:\\s*("([^"\\\\]|\\\\.)*"|\`([^\\\\\`]|\\\\.)*\`)`, 'g')
  const match = pattern.exec(block)
  if (!match) return null
  const raw = match[1]
  return decodeJsString(raw.slice(1, -1))
}

const extractQuotedValues = (block, key) => {
  const pattern = new RegExp(`"${key}"\\s*:\\s*("([^"\\\\]|\\\\.)*"|\`([^\\\\\`]|\\\\.)*\`)`, 'g')
  const values = []
  let match = pattern.exec(block)
  while (match) {
    values.push(decodeJsString(match[1].slice(1, -1)))
    match = pattern.exec(block)
  }
  return values
}

const splitObjectBlocks = (arrayLiteral) => {
  const blocks = []
  let depth = 0
  let start = -1
  let insideString = false
  let quoteChar = null
  let escaping = false

  for (let index = 0; index < arrayLiteral.length; index += 1) {
    const char = arrayLiteral[index]

    if (insideString) {
      if (escaping) {
        escaping = false
        continue
      }

      if (char === '\\') {
        escaping = true
        continue
      }

      if (char === quoteChar) {
        insideString = false
        quoteChar = null
      }
      continue
    }

    if (char === '"' || char === '\'' || char === '`') {
      insideString = true
      quoteChar = char
      continue
    }

    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        blocks.push(arrayLiteral.slice(start, index + 1))
        start = -1
      }
    }
  }

  return blocks
}

const isIndiaLocation = (location) => /\bindia\b/i.test(normalizeWhitespace(location))

const toJobDetailUrl = (pagePath) => {
  const normalizedPath = normalizeWhitespace(pagePath)?.replace(/^\/+/, '')
  return normalizedPath ? new URL(normalizedPath, `${JOBS_URL}/`).toString() : JOBS_URL
}

const splitSkills = (value) => stripTags(value)
  .split(/[,\n]/)
  .map((item) => normalizeWhitespace(item))
  .filter(Boolean)

const joinDescriptionParts = (...parts) => normalizeWhitespace(
  parts
    .map((part) => stripTags(part))
    .filter(Boolean)
    .join(' ')
)

export const hasOfficialCareersSignal = (html) => {
  const normalized = String(html ?? '')
  return /Ramco Careers\s*\|\s*Jobs at Ramco/i.test(normalized)
    && /https:\/\/www\.ramco\.com\/careers\/jobs-by-locations(?:\?[^"'`\s<>]*)?/i.test(normalized)
}

export const extractJobsPageUrl = (html) => {
  const match = String(html ?? '').match(
    /https:\/\/www\.ramco\.com\/careers\/jobs-by-locations(?:\?[^"'`\s<>]*)?|\/careers\/jobs-by-locations(?:\?[^"'`\s<>]*)?/i,
  )

  if (!match) return null

  const url = new URL(match[0], CAREERS_URL)
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

export const hasOfficialJobsSignal = (html) => {
  const normalized = String(html ?? '')
  return /Ramco Careers\s*\|\s*Explore Job Opportunities/i.test(normalized)
    && /const\s+jobData\s*=\s*\[/i.test(normalized)
    && /displayJobposts/i.test(normalized)
}

export const extractEmbeddedJobData = (html) => {
  const scriptMatch = String(html ?? '').match(/const\s+jobData\s*=\s*(\[[\s\S]*?\])\s*const\s+displayJobposts/i)
  if (!scriptMatch) return []

  return splitObjectBlocks(scriptMatch[1]).map((block) => {
    const qualifications = extractQuotedValues(block, 'qualification')

    return {
      page_path: extractQuotedValue(block, 'page_path'),
      job_title: extractQuotedValue(block, 'job_title'),
      job_code: extractQuotedValue(block, 'job_code'),
      job_level: extractQuotedValue(block, 'job_level'),
      location: extractQuotedValue(block, 'location'),
      job_status: extractQuotedValue(block, 'job_status'),
      experience: extractQuotedValue(block, 'experience'),
      roles_responsibilities: extractQuotedValue(block, 'roles_responsibilities'),
      skills: extractQuotedValue(block, 'skills'),
      sbu: extractQuotedValue(block, 'sbu'),
      qualificationRequirement: qualifications[0] || null,
      qualificationBucket: qualifications.at(-1) || null,
    }
  })
}

export const extractIndiaListings = (html) =>
  extractEmbeddedJobData(html)
    .filter((job) => /^active$/i.test(normalizeWhitespace(job.job_status)))
    .filter((job) => isIndiaLocation(job.location))
    .map((job) => {
      const sourceUrl = toJobDetailUrl(job.page_path)
      const requiredSkills = splitSkills(job.skills)

      return {
        title: normalizeWhitespace(job.job_title) || null,
        company: COMPANY_NAME,
        department: normalizeWhitespace(job.sbu) || null,
        location: 'India',
        city: null,
        country: 'India',
        jobId: normalizeWhitespace(job.page_path) || null,
        requisitionId: normalizeWhitespace(job.job_code) || null,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: stripTags(job.experience) || null,
        minimumQualification: normalizeWhitespace(job.qualificationRequirement) || null,
        preferredQualification: null,
        requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: joinDescriptionParts(job.roles_responsibilities, job.skills) || null,
        remoteStatus: 'On-site',
      }
    })
    .filter((job) => job.title && job.jobId)

export const createRamcoSystemsLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      return []
    }

    const jobsPageUrl = extractJobsPageUrl(careersHtml)
    if (jobsPageUrl !== JOBS_URL) {
      return []
    }

    const jobsHtml = await fetchText(jobsPageUrl)
    if (!hasOfficialJobsSignal(jobsHtml)) {
      return []
    }

    const scrapedAt = new Date().toISOString()
    const jobs = extractIndiaListings(jobsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.sourceUrl,
      scrapedAt,
    }))

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createRamcoSystemsLtdScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Ramco Systems Ltd. scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
