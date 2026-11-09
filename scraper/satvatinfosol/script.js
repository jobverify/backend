import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SATVAT_INFOSOL_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toCity = (value) => {
  const normalized = normalizeWhitespace(value).replace(/\s*-\s*India$/i, '')
  return normalized || null
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Life @ Satvat Infosol | Job Openings Satvat Infosol')
    && normalized.includes('Software Programmer/Developer')
    && normalized.includes('Business Development Manager')
    && normalized.includes('Apply Now')
  }

export const extractJobs = (html = '') => {
  const jobs = []
  const seen = new Set()
  const cardPattern = /<div class="brows-job-list"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p><i class="flaticon-pin"><\/i>\s*([^<]+)<\/p>[\s\S]*?<a href="([^"]+)" class="btn btn-default">Apply Now<\/a>/gi

  for (const match of html.matchAll(cardPattern)) {
    const cardHtml = match[0]
    const title = normalizeWhitespace(match[1])
    const rawLocation = normalizeWhitespace(match[2])
    const applyUrl = new URL(match[3], CAREERS_URL).toString()
    const description = normalizeWhitespace(cardHtml.match(/<p class="tooltiptext">([\s\S]*?)<\/p>/i)?.[1]) || null
    const city = toCity(rawLocation)
    const location = city ? `${city}, India` : null
    const jobId = slugify(title)
    const dedupeKey = `${jobId}::${location}::${applyUrl}`

    if (!title || !location || seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      publicExperienceChecked: true,
    })
  }

  return jobs
}

export const createSatvatInfosolScraper = ({ maxJobs = Number.POSITIVE_INFINITY } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Satvat Infosol verified first-party careers page changed materially')
    }

    const jobs = extractJobs(careersHtml)
    if (!jobs.length) {
      throw new Error('Satvat Infosol verified first-party careers page changed materially')
    }

    return jobs.slice(0, maxJobs).map((job) => ({
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

export const run = async (options = {}) => createSatvatInfosolScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
