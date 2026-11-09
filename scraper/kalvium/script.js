import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const SOURCE = 'kalvium'
const COMPANY = 'Kalvium'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const CAREERS_PAGE_URL = 'https://app.pyjamahr.com/careers?company=Kalvium&company_uuid=DBE8CE5737'
export const JOBS_API_BASE_URL = 'https://api.pyjamahr.com/api/career/jobs/'
export const JOBS_BOARD_BASE_URL = 'https://jobs.pyjamahr.com'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
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

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractNextData = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const getPublicPageProps = (html) => extractNextData(html)?.props?.pageProps ?? null

export const hasCareersSurfaceSignal = (html) => {
  const page = String(html ?? '')

  return (/Careers at\s*Kalvium/i.test(page) || /<title>\s*Kalvium\s*<\/title>/i.test(page))
    && /Loading jobs\.\.\./i.test(page)
    && /Hiring Powered By/i.test(page)
    && /__NEXT_DATA__/i.test(page)
}

export const extractCompanyContext = (html) => {
  const nextData = extractNextData(html)
  const companyDetails = nextData?.props?.pageProps?.companyDetails ?? {}
  const query = nextData?.query ?? {}

  const companyName = normalizeWhitespace(companyDetails.name || query.company)
  const companySlug = normalizeWhitespace(companyDetails.slug)
  const companyUuid = normalizeWhitespace(companyDetails.uuid || query.company_uuid)

  if (!companyName || !companySlug || !companyUuid) return null

  return {
    companyName,
    companySlug,
    companyUuid,
  }
}

export const buildJobsApiUrl = (companyUuid, page = 1) => {
  const url = new URL(JOBS_API_BASE_URL)
  url.searchParams.set('company_uuid', String(companyUuid ?? '').trim())
  url.searchParams.set('page', String(page))
  url.searchParams.set('is_careers_page', 'false')
  return url.toString()
}

export const buildJobDetailUrl = (companySlug, jobSlug) =>
  `${JOBS_BOARD_BASE_URL}/${encodeURIComponent(companySlug)}/${encodeURIComponent(jobSlug)}`

const buildApplyUrl = (companyName, jobId, companyUuid) => {
  const url = new URL('https://app.pyjamahr.com/careers')
  url.searchParams.set('company', companyName)
  url.searchParams.set('job_id', String(jobId))
  url.searchParams.set('company_uuid', companyUuid)
  url.searchParams.set('source', 'DIRECT')
  url.searchParams.set('apply_now', 'true')
  return url.toString()
}

const normalizeEmploymentType = (job = {}) => {
  const title = normalizeWhitespace(job.title) || ''
  if (/intern/i.test(title)) return 'Internship'

  switch (String(job.job_type ?? '').toUpperCase()) {
    case 'PARTTIME':
    case 'PART_TIME':
      return 'Part-time'
    case 'CONTRACT':
      return 'Contract'
    case 'INTERNSHIP':
    case 'INTERN':
      return 'Internship'
    case 'FULLTIME':
    case 'FULL_TIME':
      return 'Full-time'
    default:
      return null
  }
}

const normalizeExperienceRequired = (job = {}) => {
  const minExperience = Number(job.min_experience)
  const maxExperience = Number(job.max_experience)

  if (Number.isFinite(minExperience) && Number.isFinite(maxExperience)) {
    return `${minExperience} - ${maxExperience} years`
  }

  if (Number.isFinite(minExperience)) {
    return `${minExperience}+ years`
  }

  return null
}

const normalizeListing = (entry = {}) => {
  const jobId = normalizeWhitespace(entry.id)
  const slug = normalizeWhitespace(entry.slug)
  const title = normalizeWhitespace(entry.title)

  if (!jobId || !slug || !title || entry.published_internally !== false) {
    return null
  }

  return {
    jobId,
    slug,
    title,
    department: normalizeWhitespace(entry.department_name),
    location: normalizeWhitespace(entry.location),
    country: normalizeWhitespace(entry.country) || 'India',
  }
}

const extractJobDetailData = (html) => {
  const pageProps = getPublicPageProps(html)
  const job = pageProps?.jobDetails || pageProps?.job || null
  return job && typeof job === 'object' ? job : null
}

const toJob = (listing, detail, context, scrapedAt) => {
  const detailUrl = buildJobDetailUrl(context.companySlug, listing.slug)
  const applyUrl = buildApplyUrl(context.companyName, listing.jobId, context.companyUuid)
  const location = normalizeWhitespace(detail.location || listing.location)
  const city = normalizeWhitespace(location)?.split(',')[0] || null

  return {
    title: normalizeWhitespace(detail.title || listing.title),
    company: context.companyName,
    department: normalizeWhitespace(detail.department_name || listing.department),
    location,
    city,
    country: normalizeWhitespace(detail.country || listing.country) || 'India',
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: detailUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(detail),
    experienceRequired: normalizeExperienceRequired(detail),
    minimumQualification: Array.isArray(detail.education)
      ? detail.education.map((item) => normalizeWhitespace(item)).filter(Boolean).join(', ') || null
      : null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skill)
      ? detail.skill.map((item) => normalizeWhitespace(item)).filter(Boolean)
      : [],
    postingDate: normalizeWhitespace(detail.created_at),
    closingDate: normalizeWhitespace(detail.valid_through),
    jobDescription: stripHtml(detail.description),
    attachmentUrl: null,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json, text/plain, */*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createKalviumScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasCareersSurfaceSignal(careersHtml)) {
      throw new Error('Kalvium careers page no longer exposes the expected public PyjamaHR shell')
    }

    const context = extractCompanyContext(careersHtml)
    if (!context || context.companyName !== COMPANY) {
      throw new Error('Kalvium careers page no longer exposes the expected public company context')
    }

    const listings = []
    let page = 1

    while (true) {
      const payload = await fetchJson(buildJobsApiUrl(context.companyUuid, page))
      const pageListings = (payload?.results || [])
        .map((entry) => normalizeListing(entry))
        .filter(Boolean)

      listings.push(...pageListings)

      if (!payload?.next) break
      page += 1
    }

    const scrapedAt = now()
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(buildJobDetailUrl(context.companySlug, listing.slug))
      const detail = extractJobDetailData(detailHtml)

      if (!detail) {
        throw new Error(`Kalvium job detail page no longer exposes structured job data for ${listing.slug}`)
      }

      jobs.push(toJob(listing, detail, context, scrapedAt))
    }

    return jobs
  },
})

export const run = async (options = {}) => createKalviumScraper().run(options)

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
