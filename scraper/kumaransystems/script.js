import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KUMARAN_SYSTEMS_CATALOG } from './catalog.js'
import { runCurrentKumaran } from './currentNative20261119.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KUMARAN_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const formatLocation = (...parts) => parts
  .map((value) => normalizeWhitespace(value))
  .filter(Boolean)
  .join(', ')

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return normalized || null
  return `${match[3]}-${match[1]}-${match[2]}`
}

const toAbsoluteJobsUrl = (value) => {
  try {
    const url = new URL(value, JOBS_API_URL)
    if (!/^(careers\.)?kumaran\.com$/i.test(url.hostname)) return null
    return url.toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const hasLegacyRecruitingSurface = /Engineer What's Next Alongside People Who Care/i.test(rawHtml)
    && /kumaranite/i.test(rawHtml)
    && /RBP_offshore@kumaran\.com/i.test(rawHtml)
  const hasCurrentBrandedShell = /href=["'][^"']*\/careers\/?["']/i.test(rawHtml)
    && /info@kumaran\.com/i.test(rawHtml)
    && /Founded in 1992, Kumaran Systems is a global technology partner/i.test(normalized)
    && /Life At Kumaran'?s/i.test(normalized)
  const hasCurrentAstroCareersShell = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/kumaran\.com\/careers\/["']/i.test(rawHtml)
    && /<astro-island[^>]+component-url=["']\/_astro\/Careers\.[A-Za-z0-9_-]+\.js["'][^>]+client=["']only["']/i.test(rawHtml)
    && /Find our current openings below and initiate the first step towards becoming a Kumaranite/i.test(rawHtml)

  return /<title>\s*Jobs at Kumaran Systems Pvt Ltd\s*<\/title>/i.test(rawHtml)
    && (hasLegacyRecruitingSurface || hasCurrentBrandedShell || hasCurrentAstroCareersShell)
}

export const extractIndiaJobs = (payload = {}) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((job) => job?.Publish === true)
    .filter((job) => normalizeWhitespace(job?.Country).toLowerCase() === 'india')
    .map((job) => {
      const applyUrl = toAbsoluteJobsUrl(job?.$url)
      const title = normalizeWhitespace(job?.Posting_Title || job?.Job_Opening_Name)

      if (!title || !applyUrl) return null

      return {
        title,
        location: formatLocation(job?.City, job?.State, job?.Country),
        experience: normalizeWhitespace(job?.Work_Experience) || null,
        sourceUrl: applyUrl,
        applyUrl,
        jobId: normalizeWhitespace(job?.id) || null,
        department: normalizeWhitespace(job?.Department_Name?.name) || null,
        jobType: normalizeWhitespace(job?.Job_Type) || null,
        postingDate: normalizeDate(job?.Date_Opened),
        jobDescription: normalizeWhitespace(job?.Job_Description) || null,
      }
    })
    .filter(Boolean)

export const createKumaranSystemsScraper = () => ({ run: runCurrentKumaran })

export const run = async (options = {}) => runCurrentKumaran(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
