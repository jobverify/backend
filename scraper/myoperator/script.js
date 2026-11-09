import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import MYOPERATOR_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MYOPERATOR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PORTAL_URL = PROVIDER_METADATA.externalHandoffUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const hasInputWithId = (html, id) => new RegExp(
  `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`,
  'i',
).test(String(html ?? ''))

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const getLocation = (record = {}) => [record.City, record.State, record.Country]
  .map(normalizeWhitespace)
  .filter(Boolean)
  .join(', ') || null

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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page.replace(/<[^>]+>/g, ' ')) || ''

  return /<title>\s*Careers at MyOperator\s*\|\s*Build, Scale, and Lead With Ownership\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && normalized.includes('Channel Partner Sales Manager')
    && normalized.includes('Performance Marketing Executive')
    && normalized.includes('Talent Acquisition Specialist')
    && new RegExp(`href=["']${PORTAL_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(page)
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs\s*@\s*MyOperator\s*<\/title>/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && /page_id\s*=\s*['"]163599000003109531['"]/i.test(page)
  }

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter(isIndiaJob)
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const city = normalizeWhitespace(record.City)
    const country = normalizeWhitespace(record.Country)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = normalizeWhitespace(record.$url)
    const location = getLocation(record)

    if (!title || !city || !country || !jobId || !sourceUrl || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
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
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)

export const createMyOperatorScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified MyOperator careers shell no longer matches the trusted first-party surface')
    }

    const portalHtml = await fetchText(PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('The verified MyOperator portal no longer matches the trusted first-party Zoho surface')
    }

    const payload = await fetchJson(JOBS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('The verified MyOperator jobs API no longer returns the trusted public Zoho Recruit payload')
    }

    return extractIndiaJobs(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createMyOperatorScraper(options).run(options)

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
