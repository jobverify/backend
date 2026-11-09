import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = 'eulermotors'
const COMPANY = 'Euler Motors'
const COMPANY_SLUG = 'euler-motors'
const COMPANY_UUID = 'AD8D0AD806'
const COMPANY_URL = 'https://www.eulermotors.com'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'

export const CAREERS_BOARD_URL = 'https://jobs.pyjamahr.com/euler-motors'
export const JOBS_API_BASE_URL = 'https://api.pyjamahr.com/api/career/jobs/'

const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim() || null

const extractNextData = (html) => {
  const match = String(html ?? '').match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const hasCareersSurfaceSignal = (html) => {
  const page = String(html ?? '')
  return /Hiring Powered By/i.test(page)
    && /__NEXT_DATA__/i.test(page)
}

export const extractCompanyContext = (html) => {
  const company = extractNextData(html)?.props?.pageProps?.companyDetails ?? {}
  const context = {
    companyName: normalize(company.name),
    companySlug: normalize(company.slug),
    companyUuid: normalize(company.uuid),
  }
  return Object.values(context).every(Boolean) ? context : null
}

export const buildJobsApiUrl = (companyUuid, page = 1) => {
  const url = new URL(JOBS_API_BASE_URL)
  url.searchParams.set('company_uuid', String(companyUuid ?? '').trim())
  url.searchParams.set('page', String(page))
  url.searchParams.set('is_careers_page', 'false')
  return url.toString()
}

const buildJobDetailUrl = (slug) => `https://jobs.pyjamahr.com/${COMPANY_SLUG}/${encodeURIComponent(slug)}`

const buildApplyUrl = (jobId) => {
  const url = new URL('https://app.pyjamahr.com/careers')
  url.searchParams.set('company', COMPANY)
  url.searchParams.set('job_id', String(jobId))
  url.searchParams.set('company_uuid', COMPANY_UUID)
  url.searchParams.set('source', 'DIRECT')
  url.searchParams.set('apply_now', 'true')
  return url.toString()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain, */*' },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeListing = (listing) => {
  const jobId = normalize(listing?.id)
  const slug = normalize(listing?.slug)
  const title = normalize(listing?.title)
  if (!jobId || !slug || !title || listing.published_internally !== false) return null
  return { jobId, slug, title, location: normalize(listing.location), department: normalize(listing.department_name) }
}

const extractDetail = (html) => extractNextData(html)?.props?.pageProps?.jobDetails ?? null

const toJob = (listing, detail, scrapedAt) => {
  const location = normalize(detail.location || listing.location)
  const applyUrl = buildApplyUrl(listing.jobId)
  return {
    title: normalize(detail.title || listing.title),
    company: COMPANY,
    department: normalize(detail.department_name || listing.department),
    location,
    city: location?.split(',')[0] || null,
    country: normalize(detail.country) || 'India',
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: buildJobDetailUrl(listing.slug),
    applyUrl,
    employmentType: normalize(detail.job_type),
    experienceRequired: Number.isFinite(Number(detail.min_experience)) ? `${detail.min_experience}${Number.isFinite(Number(detail.max_experience)) ? ` - ${detail.max_experience}` : '+'} years` : null,
    minimumQualification: Array.isArray(detail.education) ? detail.education.map(normalize).filter(Boolean).join(', ') || null : null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skill) ? detail.skill.map(normalize).filter(Boolean) : [],
    postingDate: normalize(detail.created_at),
    closingDate: normalize(detail.valid_through),
    jobDescription: normalize(String(detail.description ?? '').replace(/<[^>]+>/g, ' ')),
    attachmentUrl: null,
    source: SOURCE,
    link: applyUrl,
    scrapedAt,
  }
}

export const createEulerMotorsScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const boardHtml = await fetchText(CAREERS_BOARD_URL)
    if (!hasCareersSurfaceSignal(boardHtml)) throw new Error('Euler Motors board no longer exposes the expected public PyjamaHR shell')

    const context = extractCompanyContext(boardHtml)
    const officialUrl = normalize(extractNextData(boardHtml)?.props?.pageProps?.companyDetails?.url)?.replace(/\/$/, '')
    if (!context || context.companyName !== COMPANY || context.companySlug !== COMPANY_SLUG || context.companyUuid !== COMPANY_UUID || officialUrl !== COMPANY_URL) {
      throw new Error('Euler Motors board no longer exposes the expected exact company context')
    }

    const listings = []
    for (let page = 1; ; page += 1) {
      const payload = await fetchJson(buildJobsApiUrl(COMPANY_UUID, page))
      listings.push(...(payload?.results || []).map(normalizeListing).filter(Boolean))
      if (!payload?.next) break
    }

    const scrapedAt = now()
    const jobs = []
    for (const listing of listings) {
      const detail = extractDetail(await fetchText(buildJobDetailUrl(listing.slug)))
      if (!detail) throw new Error(`Euler Motors job detail page no longer exposes structured data for ${listing.slug}`)
      jobs.push(toJob(listing, detail, scrapedAt))
    }
    return jobs
  },
})

export const run = async (options = {}) => createEulerMotorsScraper().run(options)

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scraper/eulermotors/script.js')) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
