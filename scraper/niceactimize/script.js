import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { NICE_ACTIMIZE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = NICE_ACTIMIZE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const ACTIMIZE_HANDOFF_URL = PROVIDER_METADATA.officialActimizePageUrl
export const NICE_FILTERED_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  return parsed.toISOString().slice(0, 10)
}

const getMetadataValue = (job, name) => {
  const entries = Array.isArray(job?.metadata) ? job.metadata : []
  return entries.find((entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === name.toLowerCase())?.value ?? null
}

const getLocationName = (job) => normalizeWhitespace(job?.location?.name)

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized.split('-').map((part) => normalizeWhitespace(part)).filter(Boolean)
  if (parts.length >= 2) return parts[1]

  return normalized.split(',')[0]?.trim() || null
}

const deriveCountry = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return 'India'
  return null
}

const buildJobRecord = (job = {}) => ({
  title: normalizeWhitespace(job?.title),
  company: COMPANY,
  department: normalizeWhitespace(getMetadataValue(job, 'Category')),
  location: getLocationName(job),
  city: deriveCity(getLocationName(job)),
  country: deriveCountry(getLocationName(job)),
  jobId: normalizeWhitespace(job?.id),
  requisitionId: normalizeWhitespace(job?.requisition_id),
  sourceUrl: normalizeWhitespace(job?.absolute_url),
  applyUrl: normalizeWhitespace(job?.absolute_url),
  employmentType: normalizeWhitespace(getMetadataValue(job, 'Job Type')),
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: normalizeDate(job?.first_published),
  closingDate: null,
  jobDescription: stripTags(job?.content),
})

export const hasOfficialActimizeHandoffSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Get In Touch \| NICE Actimize\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.nice\.com\/careers["']/i.test(page)
    && /NICE Actimize helps you assess the risks you face/i.test(page)
}

export const hasFilteredNiceCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const hasCareersHeading = /<h1\b[^>]*>\s*Careers at NiCE\s*<\/h1>/i.test(page)
  const hasSelectedPuneFilter = /<option\b[^>]*value=["']India - Pune["'][^>]*selected(?:=["'][^"']*["'])?[^>]*>/i.test(page)
    || /<option\b[^>]*selected(?:=["'][^"']*["'])?[^>]*value=["']India - Pune["'][^>]*>/i.test(page)
  const hasKnownActimizeResult = /boards\.eu\.greenhouse\.io\/nice\/jobs\/\d+\?gh_jid=\d+/i.test(page)
    && /\bActimize\b/i.test(page)

  return hasCareersHeading
    && hasSelectedPuneFilter
    && hasKnownActimizeResult
}

export const isActimizeIndiaJob = (job = {}) => {
  const location = getLocationName(job)
  if (!/\bindia\b/i.test(location || '')) return false

  const title = normalizeWhitespace(job?.title) || ''
  const content = stripTags(job?.content) || ''
  const metadata = Array.isArray(job?.metadata) ? job.metadata : []
  const metadataText = metadata
    .flatMap((entry) => {
      const values = [entry?.name]

      if (typeof entry?.value === 'string' || typeof entry?.value === 'number') {
        values.push(entry.value)
      } else if (entry?.value && typeof entry.value === 'object') {
        values.push(...Object.values(entry.value))
      }

      return values
    })
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')

  return /\bactimize\b/i.test(title)
    || /\bactimize\b/i.test(content)
    || /\bactimize\b/i.test(metadataText)
}

export const extractJobs = (payload = {}) => {
  if (!Array.isArray(payload?.jobs)) {
    throw new Error('NICE Actimize Greenhouse payload no longer matches the verified public board contract')
  }

  return payload.jobs
    .filter((job) => isActimizeIndiaJob(job))
    .map((job) => buildJobRecord(job))
    .filter((job) => job.title && job.jobId && job.sourceUrl)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createNiceActimizeScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const actimizeHandoffHtml = await fetchText(ACTIMIZE_HANDOFF_URL)
    if (!hasOfficialActimizeHandoffSignal(actimizeHandoffHtml)) {
      throw new Error('NICE Actimize verified NICE Actimize handoff page no longer matches the known first-party surface')
    }

    const filteredCareersHtml = await fetchText(NICE_FILTERED_CAREERS_URL)
    if (!hasFilteredNiceCareersSignal(filteredCareersHtml)) {
      throw new Error('NICE Actimize verified filtered NICE careers page no longer matches the known India/Pune Actimize surface')
    }

    const payload = await fetchJson(GREENHOUSE_JOBS_API_URL)
    const jobs = extractJobs(payload)
      .slice(0, Number.isFinite(maxJobs) ? maxJobs : undefined)
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))

    return jobs
  },
})

export const run = async (options = {}) => createNiceActimizeScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
