import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://juspay.io/careers'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDescription = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  return normalized || null
}

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

const toAbsoluteUrl = (jobId) => {
  if (!jobId) return null
  return new URL(`/careers/${jobId}`, CAREER_PAGE_URL).toString()
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('full-time')) return 'Full-time'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const extractJobBlocks = (html) => (
  String(html).match(
    /&quot;category&quot;:\[0,&quot;[\s\S]*?&quot;opening_status&quot;:\[0,(?:true|false)]/g,
  ) || []
)

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractSearchResults = (html) => extractJobBlocks(html)
  .map((block) => {
    const isOpen = extractFirst(/&quot;opening_status&quot;:\[0,(true|false)]/, block)
    if (isOpen !== 'true') return null

    const jobId = normalizeWhitespace(extractFirst(/&quot;job_id&quot;:\[0,&quot;([^&]+)&quot;]/, block))
    const title = normalizeWhitespace(extractFirst(/&quot;job_title&quot;:\[0,&quot;([^&]+)&quot;]/, block))
    const department = normalizeWhitespace(extractFirst(/&quot;category&quot;:\[0,&quot;([^&]+)&quot;]/, block))
    const city = normalizeWhitespace(extractFirst(/&quot;job_location&quot;:\[0,&quot;([^&]+)&quot;]/, block))
    const sourceUrl = toAbsoluteUrl(jobId)

    if (!jobId || !title || !city || !sourceUrl) return null

    return {
      title,
      company: 'Juspay',
      department,
      location: `${city}, India`,
      city,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(extractFirst(/&quot;job_type&quot;:\[0,&quot;([^&]+)&quot;]/, block)),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeDescription(
        extractFirst(/&quot;job_description_career&quot;:\[0,&quot;([\s\S]*?)&quot;],&quot;job_description_template&quot;/, block),
      ),
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createJuspayScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'juspay',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createJuspayScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Juspay scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'juspay')
    console.log('DB result:', result)
    process.exit(0)
  }
}
