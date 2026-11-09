import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SONATYPE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SONATYPE_CATALOG.source
export const COMPANY = SONATYPE_CATALOG.companyName
export const CAREERS_URL = SONATYPE_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = SONATYPE_CATALOG.officialLeverBoardUrl
export const LEVER_API_URL = SONATYPE_CATALOG.leverApiUrl
export const COMPANY_DOMAIN = SONATYPE_CATALOG.companyDomain
export const PROVIDER_METADATA = SONATYPE_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s+-\s+|,/)[0] || null

const toRemoteStatus = (value) => {
  const normalized = normalizeText(value)
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
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

const isIndiaLocation = (value) => {
  const location = normalizeText(value)
  return location.includes('india') || location === 'hyderabad'
}

const isIndiaJob = (job) => {
  const locations = [
    job?.categories?.location,
    ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
  ]

  return locations.some(isIndiaLocation)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>Sonatype Careers &(?:amp;)? Current Job Openings(?: \| Sonatype)?<\/title>/i.test(page)
    && text.includes('sonatype careers')
    && page.includes('jobs.lever.co/sonatype')
}

export const hasOfficialLeverBoardSignal = (html) => {
  const page = String(html ?? '')

  return /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/jobs\.lever\.co\/sonatype\/?["']/i.test(page)
    && /job openings at sonatype/i.test(page)
    && /location type/i.test(page)
    && /team/i.test(page)
    && /work type/i.test(page)
    && /https:\/\/jobs\.lever\.co\/sonatype\/[a-z0-9-]+/i.test(page)
}

export const extractLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('Sonatype Lever postings payload no longer returns an array')
  }

  return leverJobs
    .filter(isIndiaJob)
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl)
      const id = normalizeWhitespace(job?.id)

      if (!title || !location || !sourceUrl || !id) {
        throw new Error('Sonatype Lever postings payload no longer exposes the verified India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: id,
        requisitionId: id,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.descriptionPlain || job?.descriptionBodyPlain),
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
}

export const createSonatypeScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Sonatype verified official careers surface changed materially')
    }

    const boardHtml = await fetchText(LEVER_BOARD_URL)
    if (!hasOfficialLeverBoardSignal(boardHtml)) {
      throw new Error('Sonatype verified public Lever board changed materially')
    }

    const jobs = extractLeverJobs(await fetchJson(LEVER_API_URL))
    if (jobs.length === 0) {
      throw new Error('Sonatype Lever postings payload no longer yields India jobs')
    }

    const scrapedAt = now()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: SONATYPE_CATALOG.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSonatypeScraper().run(options)

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
