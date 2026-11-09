import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KANERIKA_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = KANERIKA_SOFTWARE_CATALOG.source
export const COMPANY = KANERIKA_SOFTWARE_CATALOG.companyName
export const CAREERS_URL = KANERIKA_SOFTWARE_CATALOG.companyCareerPage
export const ZOHO_SITE = 'https://kanerika.zohorecruit.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

export const buildZohoJobsApiUrl = () =>
  `${ZOHO_SITE}/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite`

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Join Kanerika\s*\|\s*Innovate and Excel in Your Career\s*<\/title>/i.test(page)
    && /Career Opportunities/i.test(page)
    && /rec_embed_js\.load/i.test(page)
    && /site:\s*"https:\/\/kanerika\.zohorecruit\.com"/i.test(page)
}

export const extractZohoJobs = (payload = {}) => (Array.isArray(payload.data) ? payload.data : [])
  .filter((job) => normalizeWhitespace(job.Country) === 'India')
  .map((job) => {
    const city = normalizeWhitespace(job.City) || null
    const state = normalizeWhitespace(job.State) || null
    const country = normalizeWhitespace(job.Country) || null
    const location = [city, state, country].filter(Boolean).join(', ') || null

    return {
      title: normalizeWhitespace(job.Posting_Title || job.Job_Opening_Name),
      company: COMPANY,
      location,
      city,
      state,
      country,
      jobId: String(job.id),
      requisitionId: String(job.id),
      sourceUrl: normalizeWhitespace(job.$url),
      applyUrl: normalizeWhitespace(job.$url),
      employmentType: normalizeEmploymentType(job.Job_Type),
      experienceRequired: normalizeWhitespace(job.Work_Experience) || null,
      postingDate: normalizeWhitespace(job.Date_Opened) || null,
      jobDescription: normalizeWhitespace(job.Job_Description) || null,
    }
  })
  .filter((job) => job.title && job.location && job.sourceUrl)

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
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createKanerikaSoftwareScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Kanerika careers page no longer matches the verified first-party Zoho Recruit widget surface')
    }

    const payload = await fetchJson(buildZohoJobsApiUrl())
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Kanerika public jobs API no longer returns the verified success payload')
    }

    return extractZohoJobs(payload).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createKanerikaSoftwareScraper().run(options)

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
