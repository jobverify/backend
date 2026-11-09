import path from 'path'
import { fileURLToPath } from 'url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { isIndiaJob as isIndiaJobInScope } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://flydocs.aero/vacancies/'
export const CAREERS_PORTAL_URL = 'https://flydocs.zohorecruit.in/jobs/Careers?source=CareerSite'
export const CAREERS_API_URL =
  'https://flydocs.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
export const COMPANY = 'flydocs'
export const SOURCE = 'flydocs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const DETAIL_URL_REGEX = /^https:\/\/flydocs\.zohorecruit\.in\/jobs\/Careers\/(\d+)\/[^?\s]+(?:\?[^"\s<>]*)?$/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/contract/.test(normalized)) return 'Contract'
  if (/intern/.test(normalized)) return 'Internship'
  return normalizeWhitespace(value)
}

const isPublishedRecord = (record = {}) => record.Publish !== false

const normalizeNativePostingDate = (value) => {
  if (value == null || value === '') return null
  // This portal's Date_Opened field is day-first (including native 26/03 and
  // 17/08 values). The JavaScript date parser reverses ambiguous days/months.
  const match = typeof value === 'string' && /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  const iso = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const parts = match ? [match[3], match[2], match[1]] : iso ? iso.slice(1) : null
  if (!parts) throw new Error('Flydocs Date_Opened no longer has a supported native date format')
  const [year, month, day] = parts.map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Flydocs Date_Opened contains an invalid calendar date')
  }
  return parts.join('-')
}

const isUnlockedRecord = (record = {}) => {
  if (record.Locked === true || record.Is_Locked === true) return false
  const status = normalizeWhitespace(
    record.Job_Opening_Status || record.Status || record.Job_Status || record.Record_Status,
  )?.toLowerCase()
  return status !== 'locked'
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Jobs at Careers\s*<\/title>/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && /page_id\s*=\s*['"]61915000000214664['"]/i.test(page)
    && normalized.includes('"company_name":"flydocs"')
    && normalized.includes('"list_url":"https://flydocs.zohorecruit.in/jobs/careers"')
    && normalized.includes('"page_name":"careers"')
}

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => isPublishedRecord(record) && isUnlockedRecord(record))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const city = normalizeCity(normalizeWhitespace(record.City)) || normalizeWhitespace(record.City)
    const state = normalizeWhitespace(record.State)
    const country = normalizeWhitespace(record.Country)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = normalizeWhitespace(record.$url)
    const location = [city, state, country].filter(Boolean).join(', ') || null

    if (!title || !jobId || !sourceUrl || !DETAIL_URL_REGEX.test(sourceUrl)) return null

    const job = {
      title,
      company: COMPANY,
      department: normalizeWhitespace(record.Department),
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
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: /^(yes|true)$/i.test(String(record.Remote_Job ?? '')) ? 'Remote' : 'On-site',
    }

    if (!isIndiaJobInScope(job)) return null
    const postingDate = normalizeNativePostingDate(record.Date_Opened)
    return {
      ...job,
      postingDate,
      nativePostingDate: record.Date_Opened ?? null,
      nativePostingDateFormat: postingDate ? (/^\d{4}-/.test(record.Date_Opened) ? 'yyyy-MM-dd' : 'dd/MM/yyyy') : null,
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

export const createFlydocsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official Flydocs careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Flydocs public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createFlydocsScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Flydocs scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
