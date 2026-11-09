import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.borgwarner.com/careers'
export const INDIA_JOBS_PAGE_URL = 'https://www.borgwarner.com/careers/job-search?country=india'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&#x2011;|&#8209;/gi, '-')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeUrl = (value) => normalizeWhitespace(value)

const extractCity = (location) => {
  const base = normalizeWhitespace(location)?.split(/\s+-\s+/)[0] || null
  if (!base) return null
  return base.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || null
}

const formatPostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(`${normalized} UTC`)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString().slice(0, 10)
}

const extractRequisitionId = ({ blockHtml, sourceUrl }) => {
  const matches = [...String(blockHtml ?? '').matchAll(/<div[^>]*class="h5"[^>]*>\s*([^<]+?)\s*<\/div>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  const fromBlock = matches.find((value) => /^R\d{4}-\d+$/i.test(value))
  if (fromBlock) return fromBlock

  try {
    return new URL(sourceUrl).searchParams.get('id')
  } catch {
    return null
  }
}

const buildJob = ({
  title,
  sourceUrl,
  location,
  postingDate,
  requisitionId,
}) => ({
  title,
  company: 'BorgWarner',
  department: null,
  location,
  city: extractCity(location),
  country: 'India',
  jobId: requisitionId,
  requisitionId,
  sourceUrl,
  applyUrl: sourceUrl,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate,
  closingDate: null,
  jobDescription: 'Official BorgWarner India opening listed on the public job search page.',
  remoteStatus: 'On-site',
})

export const extractIndiaJobs = (html) =>
  [...String(html ?? '').matchAll(/<div class="workday-job-result row widget-row">([\s\S]*?)<hr\/>/gi)]
    .map((match) => {
      const blockHtml = match[1] || ''
      const linkMatch = blockHtml.match(/<a class="link" href="([^"]+)">([\s\S]*?)<\/a>/i)
      const locationMatch = blockHtml.match(/<span class="location mr-8">([\s\S]*?)<\/span>/i)
      const dateMatch = blockHtml.match(/<div[^>]*id="divDate"[^>]*>\s*([\s\S]*?)\s*<\/div>/i)

      const sourceUrl = normalizeUrl(linkMatch?.[1] || null)
      const title = normalizeWhitespace(linkMatch?.[2] || null)
      const location = normalizeWhitespace(locationMatch?.[1] || null)
      const postingDate = formatPostingDate(dateMatch?.[1] || null)
      const requisitionId = extractRequisitionId({ blockHtml, sourceUrl })

      if (!title || !sourceUrl || !location || !requisitionId || !/india/i.test(location)) {
        return null
      }

      return buildJob({
        title,
        sourceUrl,
        location,
        postingDate,
        requisitionId,
      })
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'borgwarner',
  timeoutMs: 15000,
})

export const createBorgwarnerScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobsHtml = await fetchText(INDIA_JOBS_PAGE_URL)
    const jobs = extractIndiaJobs(jobsHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'borgwarner',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createBorgwarnerScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running BorgWarner scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'borgwarner')
    console.log('DB result:', result)
    process.exit(0)
  }
}
