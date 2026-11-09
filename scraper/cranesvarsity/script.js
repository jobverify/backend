import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_API_URL = 'https://cranesvarsity.com/wp-json/wp/v2/awsm_job_openings'
export const PAGE_SIZE = 10

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
    .replace(/[–—]/g, '-')
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

export const buildSearchUrl = (page) => {
  const url = new URL(CAREER_API_URL)
  url.searchParams.set('per_page', String(PAGE_SIZE))
  url.searchParams.set('page', String(page))
  url.searchParams.set('_fields', 'id,date_gmt,link,title,content')
  return url.toString()
}

export const extractSearchResults = (records) => (Array.isArray(records) ? records : [])
  .map((record) => {
    const title = normalizeText(record?.title?.rendered)
    const jobId = record?.id == null ? null : String(record.id)
    const sourceUrl = normalizeText(record?.link)

    return {
      title,
      company: 'Cranes Varsity',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDate(record?.date_gmt),
      closingDate: null,
      jobDescription: normalizeText(record?.content?.rendered),
      remoteStatus: 'On-site',
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: 'cranesvarsity',
  timeoutMs: 30000,
})

export const createCranesVarsityScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const jobs = []

    for (let page = 1; ; page += 1) {
      const pageRecords = await fetchJson(buildSearchUrl(page))
      jobs.push(...extractSearchResults(pageRecords))

      if (pageRecords.length < PAGE_SIZE || (maxJobs && jobs.length >= maxJobs)) break
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    return selectedJobs.map((job) => ({
      ...job,
      source: 'cranesvarsity',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCranesVarsityScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Cranes Varsity scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cranesvarsity')
    console.log('DB result:', result)
    process.exit(0)
  }
}
