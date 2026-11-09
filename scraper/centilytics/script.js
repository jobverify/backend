import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createZohoNativeInventoryScraper } from '../../scraper-support/utils/zohoNativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const API_URL =
  'https://jobs.centilytics.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers'

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

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return null
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const country = normalizeWhitespace(record.Country)

  if (city && country) return { location: `${city}, ${country}`, city }
  if (country) return { location: country, city: null }
  if (city) return { location: city, city }
  return { location: null, city: null }
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

export const buildApiUrl = () => API_URL

export const extractSearchResults = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Job_Opening_Name || record.Posting_Title)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const { location, city } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location) return null

      return {
        title,
        company: 'Centilytics',
        department: null,
        location,
        city,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened) || null,
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description) || null,
      }
    })
    .filter(Boolean)

export const createCentilyticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => createZohoNativeInventoryScraper({
  source: 'centilytics', company: 'Centilytics', nativeCompany: 'Centilytics', companyDomain: 'centilytics.com',
  boardUrl: 'https://jobs.centilytics.com/jobs/Careers', orgId: '592387000000320468', pageId: '592387000000320936',
  organizationType: 'staffing', employerClientName: 'Centilytics',
}, { maxJobs: maxJobs ?? 0 })

export const run = async (options = {}) => createCentilyticsScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Centilytics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'centilytics')
    console.log('DB result:', result)
    process.exit(0)
  }
}
