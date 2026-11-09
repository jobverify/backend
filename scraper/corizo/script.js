import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://corizo.in/career/'
export const CAREER_API_URL = 'https://corizo.in/wp-json/wp/v2/awsm_job_openings'
export const PAGE_SIZE = 100

const SOURCE = 'corizo'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => {
  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  if (!value) return null

  const date = new Date(`${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const titleCase = (value) => normalizeText(value)
  ?.split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ') || null

const classSlugToLabel = (slug) => titleCase(String(slug ?? '').replace(/-/g, ' '))

const getClassSlug = (classList, prefix) => {
  const match = (Array.isArray(classList) ? classList : [])
    .find((className) => String(className).startsWith(prefix))

  return match ? String(match).slice(prefix.length) : null
}

const toLocationLabel = (city) => (city ? `${city}, India` : null)

const toRemoteStatus = (employmentType, city) => {
  const combined = `${employmentType || ''} ${city || ''}`.toLowerCase()
  if (combined.includes('remote')) return 'Remote'
  if (combined.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

export const buildSearchUrl = (page, pageSize = PAGE_SIZE) => {
  const url = new URL(CAREER_API_URL)
  url.searchParams.set('_fields', 'id,date_gmt,link,title,content,class_list')
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractSearchResults = (records) => (Array.isArray(records) ? records : [])
  .map((record) => {
    const classList = Array.isArray(record?.class_list) ? record.class_list : []
    const title = normalizeText(record?.title?.rendered)
    const jobId = record?.id == null ? null : String(record.id)
    const sourceUrl = normalizeText(record?.link)
    const city = classSlugToLabel(getClassSlug(classList, 'job-location-'))
    const employmentType = classSlugToLabel(getClassSlug(classList, 'job-type-'))
    const remoteStatus = toRemoteStatus(employmentType, city)

    return {
      title,
      company: 'Corizo',
      department: null,
      location: toLocationLabel(city),
      city,
      country: city ? 'India' : null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDate(record?.date_gmt),
      closingDate: null,
      jobDescription: normalizeText(record?.content?.rendered),
      remoteStatus,
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createCorizoScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = PAGE_SIZE,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []

    for (let page = 1; ; page += 1) {
      const pageRecords = await fetchJson(buildSearchUrl(page, pageSize))
      jobs.push(...extractSearchResults(pageRecords))

      if (pageRecords.length < pageSize || (maxJobs && jobs.length >= maxJobs)) break
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

export const run = async () => createCorizoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Corizo scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
