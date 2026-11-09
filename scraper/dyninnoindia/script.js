import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DYNINNO_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return (
    /<title>\s*India Office\s*<\/title>/i.test(page)
    || /<title>\s*India\s*-\s*DYNINNO\s*<\/title>/i.test(page)
  )
    && /India Office/i.test(normalized)
    && /Jobs in India/i.test(normalized)
    && /Trevolution/i.test(normalized)
}

const toRemoteStatus = ({ title, location } = {}) => {
  if (/^Remote\b/i.test(title ?? '')) return 'Remote'
  if (/global/i.test(location ?? '')) return 'Remote'
  return 'On-site'
}

const extractCity = (location = '') => {
  const match = String(location ?? '').match(/India\s*\(([^)]+)\)/i)
  const candidate = normalizeWhitespace(match?.[1])
  if (!candidate || /^global$/i.test(candidate)) return null
  return candidate
}

export const extractIndiaJobs = (html = '') =>
  [...String(html ?? '').matchAll(
    /<div[^>]*class=["'][^"']*jobtitle[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*class=["'][^"']*joblocation[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*class=["'][^"']*jobtype[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  )]
    .map(([, rawTitle, rawLocation, rawDepartment]) => {
      const title = normalizeWhitespace(rawTitle)
      const location = normalizeWhitespace(rawLocation)
      const department = normalizeWhitespace(rawDepartment)
      const city = extractCity(location)
      const jobId = slugify(title)

      if (!title || !location || !jobId) return null
      if (!/^India\b/i.test(location)) return null

      return {
        title,
        company: COMPANY,
        department,
        location,
        city,
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: toRemoteStatus({ title, location }),
      }
    })
    .filter(Boolean)

export const createDyninnoIndiaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Dyninno India office jobs page no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobs(html)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
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

export const run = async (options = {}) => createDyninnoIndiaScraper().run(options)

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
