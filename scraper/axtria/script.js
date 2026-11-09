import path from 'path'
import { fileURLToPath } from 'url'

import { inferExperienceFromPublicPageHtml } from '../../scraper-support/utils/publicExperienceEnrichment.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.axtria.com/axtria-careers/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const DETAIL_BLOCK_PATTERN = /<div class="joqReqDescription"[^>]*>[\s\S]*?<div class="externalPosting"[^>]*>/i
const DEFAULT_DETAIL_FETCH_CONCURRENCY = 4
const UNAVAILABLE_JOB_SHELL_PATTERN =
  /(?:\bthis job cannot be viewed at this time\b[\s\S]*?\bno longer available for application\b|\ban error occurred while processing your request\b[\s\S]*?\bcheck the url\b)/i

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

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const ensureIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /any axtria location/i.test(normalized)) return 'India'
  if (/india/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const inferCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /any axtria location/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const extractJobId = (url) => {
  try {
    return new URL(url).searchParams.get('jobId')
  } catch {
    return null
  }
}

export const buildSearchUrl = () => CAREER_PAGE_URL

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length)
  const limit = Math.max(1, Math.min(items.length, concurrency))
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

const hasPublicDetailBlock = (html) => DETAIL_BLOCK_PATTERN.test(String(html ?? ''))
const hasUnavailableJobShell = (html) => UNAVAILABLE_JOB_SHELL_PATTERN.test(String(html ?? ''))

const buildSyntheticDetailHtml = (job, rawHtml) => {
  const jobSummary = normalizeWhitespace(job.jobDescription || job.description || job.title)

  return `
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(job.title || '')}</title>
        ${jobSummary ? `<meta name="description" content="${escapeHtml(jobSummary)}">` : ''}
      </head>
      <body>
        <h1>${escapeHtml(job.title || '')}</h1>
        ${String(rawHtml ?? '')}
      </body>
    </html>
  `
}

export const enrichJobFromDetailPage = (job, rawHtml) => {
  if (hasUnavailableJobShell(rawHtml)) {
    return {
      ...job,
      publicExperienceChecked: true,
    }
  }

  if (!hasPublicDetailBlock(rawHtml)) return job

  const enriched = inferExperienceFromPublicPageHtml({
    ...job,
    source: 'axtria',
    link: job.applyUrl || job.sourceUrl,
  }, buildSyntheticDetailHtml(job, rawHtml))

  return {
    ...job,
    experienceRequired: enriched.experienceRequired || job.experienceRequired || null,
    description: enriched.description || job.description || job.jobDescription || null,
    jobDescription: enriched.jobDescription || job.jobDescription || null,
    publicExperienceChecked: true,
  }
}

export const extractSearchResults = (html) => {
  const jobs = []
  const pattern = /<div class="career-bottom-tabs-manual-block">([\s\S]*?)<\/div>\s*<\/div>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<p class="text-2xl">([\s\S]*?)<\/p>/i)?.[1])
    const locationText = normalizeWhitespace(block.match(/<p class="text-lg">([\s\S]*?)<\/p>/i)?.[1])
    const applyUrl = normalizeWhitespace(block.match(/<a[^>]+class="[^"]*career-job-link[^"]*"[^>]+href="([^"]+)"/i)?.[1])
    const jobId = extractJobId(applyUrl)

    if (!title || !applyUrl || !jobId) continue

    const location = ensureIndiaLocation(locationText)
    const city = inferCity(locationText)

    jobs.push({
      title,
      company: 'Axtria',
      department: null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(`Axtria India opening for ${title} in ${location}.`),
      remoteStatus: inferRemoteStatus(location),
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'axtria',
  timeoutMs: 15000,
})

export const createAxtriaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  detailFetchConcurrency = DEFAULT_DETAIL_FETCH_CONCURRENCY,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchDetailText = options.fetchDetailText || fetchText
    const html = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const jobsWithDetails = await mapWithConcurrency(
      selectedJobs,
      detailFetchConcurrency,
      async (job) => {
        const detailUrl = job.applyUrl || job.sourceUrl
        if (!detailUrl) return job

        try {
          const detailHtml = await fetchDetailText(detailUrl)
          return enrichJobFromDetailPage(job, detailHtml)
        } catch {
          return job
        }
      },
    )

    return jobsWithDetails.map((job) => ({
      ...job,
      source: 'axtria',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAxtriaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Axtria scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'axtria')
    console.log('DB result:', result)
    process.exit(0)
  }
}
