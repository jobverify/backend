import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INNOPLEXUS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INNOPLEXUS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const REDIRECTED_CAREERS_PAGE_URL = PROVIDER_METADATA.redirectedCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeEntities(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.replace(/\s*\((?:Onsite|Onsite Role)\)\s*/gi, '')
  ?.replace(/\s+/g, ' ')
  ?.trim() || null

const ensureIndiaSuffix = (value) => {
  const normalized = normalizeLocation(value)
  if (!normalized) return { location: null, city: null, country: null }

  const location = /india/i.test(normalized) ? normalized : `${normalized}, India`
  const segments = location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = segments[0] || null
  const country = segments.at(-1) || null

  return { location, city, country }
}

const buildSourceUrl = (id) => `${REDIRECTED_CAREERS_PAGE_URL}#job-${id}`

const parseJobsArrayCandidate = (value) => {
  if (!value) return null

  const candidates = [
    value,
    value.replace(/\\"/g, '"').replace(/\\\\\//g, '/'),
  ]

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      continue
    }
  }

  return null
}

const extractEmbeddedJobsArray = (html = '') => {
  const page = String(html ?? '')
  const candidates = [
    page.match(/"initialJobs"\s*:\s*(\[[\s\S]*?\])\s*[\},]/)?.[1] ?? null,
    page.match(/\\"initialJobs\\":(\[[\s\S]*?\])(?:,\\"|[}\]])/)?.[1] ?? null,
    page.replace(/\\"/g, '"').match(/"initialJobs"\s*:\s*(\[[\s\S]*?\])\s*[\},]/)?.[1] ?? null,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const parsed = parseJobsArrayCandidate(candidate)
    if (Array.isArray(parsed)) {
      return parsed
    }
  }

  return null
}

const isIndiaLocation = (location) => {
  const normalized = normalizeLocation(location)?.toLowerCase() || ''
  return normalized.includes('india')
    || normalized.startsWith('pune')
    || normalized.startsWith('delhi')
  }

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers at Partex\.AI\s*\|\s*Join the Future of AI Pharma\s*<\/title>/i.test(page)
    && normalized.includes('Join the Journey at Partex.AI')
    && normalized.includes('View Openings')
    && normalized.includes('partex.zohorecruit.in/forms/')
}

export const extractIndiaJobsFromHtml = (html = '') => {
  const jobs = extractEmbeddedJobsArray(html)
  if (!Array.isArray(jobs)) return []

  return jobs
    .filter((job) => isIndiaLocation(job?.location))
    .map((job) => {
      const title = normalizeWhitespace(job?.title)?.replace(/\s*[–—]\s*/g, ' - ')
      const jobId = normalizeWhitespace(job?.id)
      const applyUrl = normalizeWhitespace(job?.applyUrl)
      const description = normalizeWhitespace(job?.shortDescription)
      const { location, city, country } = ensureIndiaSuffix(job?.location)

      if (!title || !jobId || !applyUrl || !location || !city || !country) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl: buildSourceUrl(jobId),
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: description,
        remoteStatus: /onsite/i.test(String(job?.location ?? '')) ? 'On-site' : null,
      }
    })
    .filter(Boolean)
}

export const createInnoplexusScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('The verified Innoplexus careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractIndiaJobsFromHtml(careersHtml)
    if (jobs.length === 0) {
      throw new Error('The verified Innoplexus careers page no longer exposes the embedded openings array')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createInnoplexusScraper().run(options)

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
