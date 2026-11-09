import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createZohoNativeInventoryScraper } from '../../scraper-support/utils/zohoNativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'Fasal'
export const SOURCE = 'fasal'
export const OFFICIAL_CAREERS_URL = 'https://www.fasal.co/life-at-fasal'
export const CAREERS_PORTAL_URL = 'https://jobs.fasal.co/jobs/Careers'
export const CAREERS_API_URL =
  'https://jobs.fasal.co/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /join us in bringing a new era to indian agriculture/i.test(page)
    && /href=["']https:\/\/jobs\.fasal\.co\/jobs\/Careers["']/i.test(page)
    && /view vacancies/i.test(page)
}

const hasInputWithId = (html, id) => new RegExp(
  `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`,
  'i',
).test(String(html ?? ''))

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at PeoplePlus\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/jobs\.fasal\.co\/jobs\/Careers["']/i.test(page)
    && /meta property=["']og:site_name["'] content=["']Wolkus Technology Solutions Private Limited["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

export const extractIndiaJobs = (payload) => {
  if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
    throw new Error('Fasal public jobs API no longer returns the verified success payload')
  }

  return payload.data
    .filter((record) => /india/i.test(normalizeWhitespace(record.Country) || ''))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const city = normalizeWhitespace(record.City)
      const state = normalizeWhitespace(record.State)
      const country = normalizeWhitespace(record.Country)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const location = [city, state, country].filter(Boolean).join(', ') || null

      if (!title || !country || !jobId || !sourceUrl || !location) return null

      return {
        title,
        company: COMPANY_NAME,
        department: normalizeWhitespace(record.Department || record.Industry),
        location,
        city,
        state,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)
}

export const createFasalScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => createZohoNativeInventoryScraper({
  source: SOURCE, company: COMPANY_NAME, nativeCompany: 'Wolkus Technology Solutions Private Limited', companyDomain: 'fasal.co',
  officialUrl: OFFICIAL_CAREERS_URL, boardUrl: CAREERS_PORTAL_URL, orgId: '622955000000340005', pageId: '622955000000340237',
}, { maxJobs: maxJobs ?? 0 })

export const run = async (options = {}) => createFasalScraper(options).run(options)

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
