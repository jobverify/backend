import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SOROCO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SOROCO_CATALOG.source
export const COMPANY = SOROCO_CATALOG.companyName
export const CAREERS_URL = SOROCO_CATALOG.companyCareerPage
export const ALL_OPENINGS_URL = SOROCO_CATALOG.allOpeningsUrl
export const EMBEDDED_GREENHOUSE_API_URL = SOROCO_CATALOG.embeddedGreenhouseApiUrl
export const ZOHO_JOBS_API_URL = 'https://soroco.zohorecruit.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
export const VERIFIED_ON = SOROCO_CATALOG.verifiedOn
export const COMPANY_DOMAIN = SOROCO_CATALOG.companyDomain
export const PROVIDER_METADATA = SOROCO_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

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

export const hasOfficialSorocoCareersSignal = (html) =>
  /<title>\s*Grow with Soroco\s*<\/title>/i.test(String(html))
  && /View Career Opportunities/i.test(String(html))
  && /href=["']\/all-job-openings\/["']/i.test(String(html))

export const hasOfficialAllOpeningsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Job openings at Soroco\s*<\/title>/i.test(page)
    && /static\.zohocdn\.com\/recruit\/embed_careers_site\/javascript\/v1\.1\/embed_jobs\.js/i.test(page)
    && /site\s*:\s*["']https:\/\/soroco\.zohorecruit\.com["']/i.test(page)
    && /page_name\s*:\s*["']Careers["']/i.test(page)
}

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)

  return {
    city,
    state,
    country,
    location: [city, state, country].filter(Boolean).join(', ') || null,
  }
}

export const extractIndiaJobsFromZohoPayload = (payload = {}) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => /^india$/i.test(normalizeWhitespace(record?.Country) || ''))
  .map((record) => {
    const title = normalizeWhitespace(record?.Posting_Title || record?.Job_Opening_Name)
    const jobId = normalizeWhitespace(record?.id)
    const sourceUrl = normalizeWhitespace(record?.$url)
    const { location, city, state, country } = normalizeLocation(record)

    if (!title || !jobId || !sourceUrl || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeWhitespace(record?.Job_Type),
      experienceRequired: normalizeWhitespace(record?.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(record?.Job_Description),
      remoteStatus: record?.Remote_Job === true ? 'Remote' : null,
    }
  })
  .filter(Boolean)

export const extractSorocoJobs = (html) => {
  const matches = String(html).matchAll(
    /id="job-title"[\s\S]{0,400}?elementor-heading-title[^>]*>([^<]+)<\/span>[\s\S]{0,1600}?elementor-heading-title[^>]*>([^<]+)<\/span>[\s\S]{0,800}?href="([^"]*)"/gi,
  )

  const jobs = []
  const seen = new Set()

  for (const match of matches) {
    const title = normalizeWhitespace(match[1])
    const location = normalizeWhitespace(match[2])
    const rawHref = normalizeWhitespace(match[3])

    if (!title || !location) continue

    const key = `${title}::${location}`
    if (seen.has(key)) continue
    seen.add(key)

    const resolvedUrl = !rawHref || rawHref === '#'
      ? ALL_OPENINGS_URL
      : new URL(rawHref, CAREERS_URL).toString()

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: /bangalore/i.test(location) ? 'Bangalore' : null,
      country: /india|bangalore/i.test(location) ? 'India' : null,
      jobId: slugify(`${title}-${location}`),
      requisitionId: null,
      sourceUrl: resolvedUrl,
      applyUrl: resolvedUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `${title} - ${location}`,
      remoteStatus: null,
    })
  }

  return jobs
}

export const createSorocoScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialSorocoCareersSignal(careersHtml)) {
      throw new Error('Soroco verified official careers surface changed')
    }

    const visibleJobs = extractSorocoJobs(careersHtml)
    if (visibleJobs.length > 0) {
      return visibleJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
      }))
    }

    const allOpeningsHtml = await fetchText(ALL_OPENINGS_URL)
    if (!hasOfficialAllOpeningsSignal(allOpeningsHtml)) {
      throw new Error('Soroco official all-openings page no longer exposes the verified Zoho careers handoff')
    }

    const payload = await fetchJson(ZOHO_JOBS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Soroco public Zoho jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobsFromZohoPayload(payload)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createSorocoScraper().run(options)

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
