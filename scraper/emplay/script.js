import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://www.emplay.net/careers/'
export const JOBS_URL = 'https://www.emplay.net/careers-all-jobs'

const COMPANY = 'Emplay'
const SOURCE = 'emplay'
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

const stripTags = (value) => decodeHtmlEntities(value).replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = stripTags(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, JOBS_URL).toString()
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  if (/full.?time|permanent/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Join us and change yours by shaping the future of Conversations!/i.test(page)
    && /Explore Job Openings/i.test(page)
    && /\/careers-all-jobs/i.test(page)
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*all jobs\s*<\/title>/i.test(page)
    && /collection-item-6-copy/i.test(page)
    && /All Jobs/i.test(page)
    && /Join Our Team/i.test(page)
}

export const extractJobs = (html) => {
  const page = String(html ?? '')
  const sections = [...page.matchAll(
    /<section\b[^>]*>[\s\S]*?<div class="text-block-256">([^<]+)<\/div>[\s\S]*?<div class="w-dyn-list">([\s\S]*?)<\/section>/gi,
  )]

  const jobs = []

  for (const [, departmentHtml, sectionHtml] of sections) {
    const department = normalizeWhitespace(departmentHtml)
    const cardPattern = /<div role="listitem" class="collection-item-6-copy[\s\S]*?<a href="([^"]+)" class="link-41">([\s\S]*?)<\/a>[\s\S]*?<div class="text-block-264">([^<]+)<\/div>[\s\S]*?<div class="text-block-268">([^<]+)<\/div>[\s\S]*?<div>([^<]+)<\/div>[\s\S]*?<div class="text-block-263">([^<]+)<\/div>/gi

    for (const match of sectionHtml.matchAll(cardPattern)) {
      const [, href, titleHtml, postingDateHtml, locationHtml, compensationHtml, experienceHtml] = match
      const sourceUrl = toAbsoluteUrl(href)
      const title = normalizeWhitespace(titleHtml)
      const location = normalizeWhitespace(locationHtml)

      if (!title || !location || !sourceUrl) continue

      jobs.push({
        title,
        company: COMPANY,
        department,
        location,
        city: /remote/i.test(location) ? 'Remote' : null,
        country: 'India',
        jobId: sourceUrl,
        requisitionId: sourceUrl,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: normalizeWhitespace(experienceHtml),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(postingDateHtml),
        closingDate: null,
        jobDescription: normalizeWhitespace(compensationHtml),
        remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
      })
    }
  }

  return jobs
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

export const createEmplayScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Emplay careers page no longer matches the verified official careers entry surface')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('Emplay jobs page no longer matches the verified official static listings surface')
    }

    const listings = extractJobs(jobsHtml)
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createEmplayScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Emplay scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
