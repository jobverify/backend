import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'firstsolar'
export const COMPANY_NAME = 'First Solar'
export const CORPORATE_CAREERS_URL = 'https://www.firstsolar.com/en/Careers'
export const CANDIDATE_EXPERIENCE_URL =
  'https://fa-esbv-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2001'
export const LISTING_API_BASE_URL =
  'https://fa-esbv-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions'
export const DETAIL_API_BASE_URL =
  'https://fa-esbv-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails'
export const PUBLIC_JOBS_BASE_URL = `${CANDIDATE_EXPERIENCE_URL}/job/`
export const SITE_NUMBER = 'CX_2001'
export const COUNTRY_FILTER = 'India'
export const VERIFIED_AT = '2026-07-26'

const WORKSPACE_DOMAIN = 'fa-esbv-saasfaprod1.fa.ocs.oraclecloud.com'
const DEFAULT_LIMIT = 24
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'

const normalize = (value) => {
  const result = String(value ?? '').replace(/\s+/g, ' ').trim()
  return result || null
}

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const stripTags = (value) => normalize(decodeHtml(value).replace(/<[^>]+>/g, ' '))

const normalizeDate = (value) => {
  const normalized = normalize(value)
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? normalized : date.toISOString().slice(0, 10)
}

const getRecords = (payload) => Array.isArray(payload?.items)
  ? payload.items.flatMap((item) => Array.isArray(item?.requisitionList) ? item.requisitionList : [])
  : Array.isArray(payload?.requisitionList) ? payload.requisitionList : []

const getDetail = (payload) => Array.isArray(payload?.items) ? payload.items[0] || {} : payload || {}

const isIndiaJob = (record) => {
  const locations = [
    record?.PrimaryLocation,
    ...(Array.isArray(record?.secondaryLocations) ? record.secondaryLocations.map((item) => item?.Name) : []),
  ].map(normalize).filter(Boolean)

  return String(record?.PrimaryLocationCountry || '').toUpperCase() === 'IN'
    || locations.some((location) => /(?:^|,)\s*india\s*$/i.test(location))
}

const getLocation = (record) => normalize(
  record?.PrimaryLocation
    || record?.secondaryLocations?.[0]?.Name,
)

const getCity = (location) => normalize(location)?.split(',')[0] || null

export const hasOfficialCorporateCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*\|\s*First Solar\s*<\/title>/i.test(page)
    && new RegExp(`href=["']${CANDIDATE_EXPERIENCE_URL}["']`, 'i').test(page)
    && /Find Open Positions and Apply/i.test(stripTags(page) || '')
}

export const hasOfficialCandidateExperienceSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*First Solar India\s*<\/title>/i.test(page)
    && /property=["']og:title["'][^>]+content=["']First Solar India Careers["']/i.test(page)
    && /property=["']og:site_name["'][^>]+content=["']First Solar India["']/i.test(page)
    && new RegExp(`data-apibaseurl=["']https://${WORKSPACE_DOMAIN}:443["']`, 'i').test(page)
    && /data-sitenumber=["']CX_2001["']/i.test(page)
}

export const buildSearchUrl = ({ page = 0, limit = DEFAULT_LIMIT, location = COUNTRY_FILTER } = {}) =>
  `${LISTING_API_BASE_URL}?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${SITE_NUMBER},limit=${Number(limit) || DEFAULT_LIMIT},offset=${Math.max(0, Number(page) || 0) * (Number(limit) || DEFAULT_LIMIT)},location=${encodeURIComponent(location)}`

export const buildJobDetailApiUrl = (jobId) =>
  `${DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(normalize(jobId) || '')}%22,siteNumber=${SITE_NUMBER}`

export const buildJobDetailUrl = (jobId) => `${PUBLIC_JOBS_BASE_URL}${encodeURIComponent(normalize(jobId) || '')}`

export const extractSearchResults = (payload) => getRecords(payload)
  .filter(isIndiaJob)
  .map((record) => {
    const jobId = normalize(record.Id)
    const location = getLocation(record)
    return {
      title: normalize(record.Title), company: COMPANY_NAME, department: normalize(record.JobFunction || record.Department || record.Category),
      location, city: getCity(location), country: COUNTRY_FILTER, jobId, requisitionId: jobId,
      sourceUrl: buildJobDetailUrl(jobId), applyUrl: buildJobDetailUrl(jobId), employmentType: normalize(record.JobSchedule || record.RequisitionType),
      postingDate: normalizeDate(record.PostedDate), closingDate: normalizeDate(record.PostingEndDate), jobDescription: stripTags(record.ShortDescriptionStr),
    }
  })
  .filter((job) => job.title && job.jobId)

const extractPageInfo = (payload, page) => {
  const summary = payload?.items?.[0] || {}
  const pageSize = Number(summary.Limit) || DEFAULT_LIMIT
  return { hasNext: (page + 1) * pageSize < (Number(summary.TotalJobsCount) || 0) }
}

export const createFirstSolarScraper = ({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) => ({
  async run() {
    const corporateHtml = await fetchText(CORPORATE_CAREERS_URL)
    if (!hasOfficialCorporateCareersSignal(corporateHtml)) {
      throw new Error('First Solar official careers page no longer matches the verified first-party handoff')
    }

    const candidateHtml = await fetchText(CANDIDATE_EXPERIENCE_URL)
    if (!hasOfficialCandidateExperienceSignal(candidateHtml)) {
      throw new Error('First Solar India Oracle board no longer matches the verified exact company shell')
    }

    const jobs = []
    for (let page = 0; ; page += 1) {
      const payload = await fetchJson(buildSearchUrl({ page }))
      const listings = extractSearchResults(payload)
      for (const listing of listings) {
        const detail = getDetail(await fetchJson(buildJobDetailApiUrl(listing.jobId)))
        const location = getLocation(detail) || listing.location
        jobs.push({
          ...listing,
          title: normalize(detail.Title) || listing.title,
          department: normalize(detail.Category || detail.Department || detail.JobFunction) || listing.department,
          location, city: getCity(location) || listing.city,
          employmentType: normalize(detail.JobSchedule || detail.RequisitionType) || listing.employmentType,
          minimumQualification: normalize(detail.StudyLevel || detail.ExternalQualificationsStr),
          jobDescription: stripTags([detail.ExternalDescriptionStr, detail.ExternalResponsibilitiesStr, detail.ExternalQualificationsStr].filter(Boolean).join(' ')) || listing.jobDescription,
          postingDate: normalizeDate(detail.ExternalPostedStartDate) || listing.postingDate,
          closingDate: normalizeDate(detail.ExternalPostedEndDate) || listing.closingDate,
          source: SOURCE,
          link: listing.applyUrl,
          scrapedAt: now(),
        })
      }
      if (!extractPageInfo(payload, page).hasNext) break
    }
    return jobs
  },
})

const defaultFetchText = (url) => fetchTextWithRetry(url, { headers: { 'User-Agent': USER_AGENT }, label: SOURCE, timeoutMs: 20000 })
const defaultFetchJson = (url) => fetchJsonWithRetry(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, label: SOURCE, timeoutMs: 30000 })

export const run = async (options = {}) => createFirstSolarScraper(options).run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
