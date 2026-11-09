import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vernacularai'
export const COMPANY = 'Vernacular.ai'
export const CAREERS_URL = 'https://careers.smartrecruiters.com/vernacularai'
export const SMARTRECRUITERS_COMPANY_IDENTIFIER = 'Vernacularai'
export const SMARTRECRUITERS_LISTING_API_URL =
  'https://api.smartrecruiters.com/v1/companies/vernacularai/postings'
export const SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE =
  'https://api.smartrecruiters.com/v1/companies/vernacularai/postings/{{jobId}}'

const PAGE_SIZE = 100
const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim() || null
const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const buildListingApiUrl = (offset = 0) => {
  const url = new URL(SMARTRECRUITERS_LISTING_API_URL)
  url.searchParams.set('limit', String(PAGE_SIZE))
  url.searchParams.set('country', 'in')
  url.searchParams.set('offset', String(offset))
  return url.toString()
}

const buildDetailApiUrl = (jobId) =>
  SMARTRECRUITERS_DETAIL_API_URL_TEMPLATE.replace('{{jobId}}', encodeURIComponent(String(jobId)))

const isTrustedApplicationUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.toLowerCase() === 'jobs.smartrecruiters.com'
      && url.pathname.split('/').filter(Boolean)[0] === SMARTRECRUITERS_COMPANY_IDENTIFIER
  } catch {
    return false
  }
}

const mapJob = (posting, detail, scrapedAt) => {
  const jobId = normalizeWhitespace(detail.id || posting.id)
  const title = normalizeWhitespace(detail.name || posting.name)
  const location = normalizeWhitespace(detail.location?.fullLocation || posting.location?.fullLocation)
  const sourceUrl = normalizeWhitespace(detail.postingUrl)
  const applyUrl = normalizeWhitespace(detail.applyUrl || sourceUrl)

  if (!jobId || !title || !location || !isTrustedApplicationUrl(sourceUrl) || !isTrustedApplicationUrl(applyUrl)) {
    throw new Error('Vernacular.ai SmartRecruiters detail payload no longer exposes a trusted public job URL')
  }

  return {
    title, company: COMPANY,
    department: normalizeWhitespace(detail.function?.label || posting.function?.label),
    location, city: normalizeWhitespace(detail.location?.city || posting.location?.city), country: 'India',
    link: sourceUrl, applyUrl, sourceUrl, source: SOURCE, jobId,
    requisitionId: normalizeWhitespace(detail.refNumber || posting.refNumber),
    employmentType: normalizeWhitespace(detail.typeOfEmployment?.label || posting.typeOfEmployment?.label),
    postingDate: normalizeWhitespace(detail.releasedDate || posting.releasedDate),
    jobDescription: stripTags(detail.jobAd?.sections?.jobDescription?.text) || 'Apply via the Vernacular.ai careers page.',
    scrapedAt,
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json,text/plain,*/*', Referer: CAREERS_URL } })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createVernacularAiScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const jobs = []
    let offset = 0
    while (!Number.isFinite(maxJobs) || jobs.length < maxJobs) {
      const payload = await fetchJson(buildListingApiUrl(offset))
      const postings = Array.isArray(payload?.content) ? payload.content : null
      if (!postings) throw new Error('Vernacular.ai SmartRecruiters listings payload no longer returns content[]')

      for (const posting of postings) {
        if (normalizeWhitespace(posting.company?.identifier) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
          throw new Error('Vernacular.ai SmartRecruiters payload company identifier changed')
        }
        if (normalizeWhitespace(posting.visibility)?.toUpperCase() !== 'PUBLIC') continue
        if (normalizeWhitespace(posting.location?.country)?.toLowerCase() !== 'in') continue
        const detail = await fetchJson(normalizeWhitespace(posting.ref) || buildDetailApiUrl(posting.id))
        if (normalizeWhitespace(detail.company?.identifier) !== SMARTRECRUITERS_COMPANY_IDENTIFIER) {
          throw new Error('Vernacular.ai SmartRecruiters detail company identifier changed')
        }
        jobs.push(mapJob(posting, detail, now()))
        if (Number.isFinite(maxJobs) && jobs.length >= maxJobs) break
      }

      offset += postings.length
      if (!postings.length || !Number.isFinite(Number(payload?.totalFound)) || offset >= Number(payload.totalFound)) break
    }
    if (!jobs.length) throw new Error('Vernacular.ai SmartRecruiters API returned no public India jobs')
    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createVernacularAiScraper(options).run(options)

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scraper/vernacularai/script.js')) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
