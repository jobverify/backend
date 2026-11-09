import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.elastic.co'
const INDIA_FILTER_PARAMS = {
  groupId: '1509',
  column: 'country',
  value: 'India',
  groupBy: 'city',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toArray = (value) => Array.isArray(value) ? value : []

const buildQueryUrl = (pathname, params) => {
  const url = new URL(pathname, `${BASE_URL}/`)
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, value)
    }
  })
  return url.toString()
}

const stripLeadingSlash = (value) => String(value ?? '').replace(/^\/+/, '')

const extractCity = (groupKey, record = {}) => {
  const explicitCity = normalizeWhitespace(record.city)
  if (explicitCity && !/^distributed$/i.test(explicitCity)) return explicitCity

  const normalizedGroup = normalizeWhitespace(groupKey)
  if (normalizedGroup) return normalizedGroup

  const location = normalizeWhitespace(record.address)
  if (!location || /^india$/i.test(location)) return null
  return normalizeWhitespace(location.split(',')[0])
}

const isIndiaJob = (record = {}) =>
  /india/i.test(String(record.country || ''))
  || /india/i.test(String(record.address || ''))

export const buildIndiaApiUrl = () => buildQueryUrl('/api/filter/jobs', INDIA_FILTER_PARAMS)

export const buildJobUrl = (jobPath, jobId) => buildQueryUrl(
  `/jobs/${stripLeadingSlash(jobPath)}`,
  { gh_jid: normalizeWhitespace(jobId) || '' },
)

export const buildApplyUrl = (jobId) => buildQueryUrl('/jobs', {
  gh_jid: normalizeWhitespace(jobId) || '',
})

export const extractSearchResults = (payload) => Object.entries(payload?.data || {})
  .flatMap(([groupKey, records]) => toArray(records).map((record) => ({ groupKey, record })))
  .filter(({ record }) => record?.live === 1 && isIndiaJob(record))
  .map(({ groupKey, record }) => {
    const jobId = normalizeWhitespace(record.unique_identifier || record.jid || record.id)
    const title = normalizeWhitespace(record.title)
    const jobPath = normalizeWhitespace(record.url)
    const sourceUrl = jobPath && jobId ? buildJobUrl(jobPath, jobId) : null
    const applyUrl = jobId ? buildApplyUrl(jobId) : null
    const location = normalizeWhitespace(record.address) || 'India'
    const city = extractCity(groupKey, record)

    if (!jobId || !title || !sourceUrl || !applyUrl || !location) return null

    return {
      title,
      company: 'Elastic',
      department: normalizeWhitespace(record.subdivision || record.category),
      location,
      city,
      jobId,
      requisitionId: normalizeWhitespace(record.job_code || record.internal_id || jobId),
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(record.created_at),
      closingDate: null,
      jobDescription: stripTags(record.content),
    }
  })
  .filter(Boolean)

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const run = async () => {
  const payload = await fetchJson(buildIndiaApiUrl())
  const listings = extractSearchResults(payload)
  const maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null
  const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings

  return selectedJobs.map((job) => ({
    ...job,
    source: 'elastic',
    link: job.applyUrl || job.sourceUrl,
    scrapedAt: new Date().toISOString(),
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Elastic scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'elastic')
    console.log('DB result:', result)
    process.exit(0)
  }
}
