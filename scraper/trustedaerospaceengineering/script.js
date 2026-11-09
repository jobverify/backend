import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'trustedaerospaceengineering'
export const COMPANY = 'Trusted Aerospace Engineering Private Limited'
export const CAREERS_URL = 'https://www.taseglobal.com/career.php'
export const VERIFIED_ON = '2026-08-14'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Join Our Team at TASE\s*\|\s*Career Opportunities in Precision CNC Manufacturing\s*<\/title>/i
const OFFICIAL_BRAND_PATTERN = /Trusted Aerospace(?:\s*&amp;|\s*&)\s*Engineering\s+Pvt\.?\s*Ltd\.?/i
const SHARED_FORM_PATTERN = /submitForm\(\s*['"]\.modal-body['"]\s*,\s*['"]career_mail\.php['"]\s*\)/i
const HIDDEN_JOB_ID_PATTERN = /<input[^>]+name=["']job_id["'][^>]+id=["']job_id["'][^>]*>/i
const FETCH_ID_PATTERN = /function\s+fetch_id\s*\(\s*id\s*\)\s*\{[\s\S]*?#job_id[\s\S]*?\}/i
const INDIA_SECTION_PATTERN = /<h5[^>]*class=["'][^"']*\bcoun\b[^"']*["'][^>]*>\s*INDIA\b[\s\S]*?<\/h5>([\s\S]*?)<h5[^>]*class=["'][^"']*\bcoun\b[^"']*["'][^>]*>\s*USA\b/i
const INDIA_JOB_PATTERN = /<div class="accordion-item">[\s\S]*?<button[^>]*class=["'][^"']*accordion-button[^"']*["'][^>]*>([\s\S]*?)<\/button>[\s\S]*?<div class="accordion-body">([\s\S]*?)<button[^>]*onclick=["']fetch_id\((\d+)\)["'][^>]*>[\s\S]*?Apply\s*Now[\s\S]*?<\/button>/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractExperienceRequired = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const patterns = [
    /(\d+\+\s*years(?:['’]?\s*work\s+experience|\s+of\s+experience)?)/i,
    /(At least\s+\d+\s*-\s*\d+\s*years(?:\s+[a-z ]+experience)?)/i,
    /(\d+\s*plus\s*years(?:\s+of\s+experience)?)/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) return normalizeWhitespace(match[1])
  }

  return null
}

const extractIndiaSection = (html) => {
  const match = INDIA_SECTION_PATTERN.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_BRAND_PATTERN.test(page)
    && SHARED_FORM_PATTERN.test(page)
    && HIDDEN_JOB_ID_PATTERN.test(page)
    && FETCH_ID_PATTERN.test(page)
    && INDIA_SECTION_PATTERN.test(page)
}

export const extractIndiaJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Trusted Aerospace Engineering verified official careers surface changed')
  }

  const indiaSection = extractIndiaSection(html)
  if (!indiaSection) {
    throw new Error('Trusted Aerospace Engineering verified India openings boundary changed')
  }

  const jobs = [...indiaSection.matchAll(INDIA_JOB_PATTERN)].map((match) => {
    const title = stripTags(match[1])
    const bodyText = stripTags(match[2])
    const publicJobId = normalizeWhitespace(match[3])

    if (!title || !bodyText || !publicJobId) return null

    return {
      title,
      company: COMPANY,
      location: 'India',
      city: null,
      country: 'India',
      jobId: publicJobId,
      requisitionId: publicJobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: extractExperienceRequired(bodyText),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: bodyText,
      remoteStatus: 'On-site',
    }
  }).filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Trusted Aerospace Engineering verified India openings changed or disappeared')
  }

  return jobs
}

export const fetchCareersPageText = async (url, {
  fetchPage = fetchPageWithRetry,
} = {}) => {
  const page = await fetchPage(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  const status = Number(page?.status ?? 0)
  if (status < 200 || status >= 300) {
    const error = new Error(`HTTP ${page?.status ?? 'unknown'} for ${url}`)
    error.status = page?.status
    throw error
  }

  return String(page?.html ?? '')
}

const defaultFetchText = (url) => fetchCareersPageText(url)

export const createTrustedAerospaceEngineeringScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    const jobs = extractIndiaJobs(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createTrustedAerospaceEngineeringScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Trusted Aerospace Engineering scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
