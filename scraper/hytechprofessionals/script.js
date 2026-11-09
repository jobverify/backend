import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HYTECH_PROFESSIONALS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: `${SOURCE}-html`,
    timeoutMs: 20000,
  })

const defaultFetchJson = (url) =>
  fetchJsonWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    label: `${SOURCE}-json`,
    timeoutMs: 20000,
  })

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeLocation = (city, country) => {
  const normalizedCity = normalizeWhitespace(city)
  const normalizedCountry = normalizeWhitespace(country)

  if (normalizedCity && normalizedCountry) {
    return `${normalizedCity}, ${normalizedCountry}`
  }

  return normalizedCountry || normalizedCity || 'India'
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Current Openings/i.test(page)
    && /widget_id:"rec_job_listing_div"/i.test(page)
    && /site:"https:\/\/hytechprous\.zohorecruit\.com"/i.test(page)
    && /empty_job_msg:"No current Openings"/i.test(page)
  }

export const extractJobsFromPayload = (payload = {}) => {
  const jobs = []
  const postings = Array.isArray(payload?.data) ? payload.data : []

  for (const posting of postings) {
    const country = normalizeWhitespace(posting?.Country)
    if (country !== 'India') continue

    const title = normalizeWhitespace(posting?.Posting_Title || posting?.Job_Opening_Name)
    const sourceUrl = normalizeWhitespace(posting?.$url)
    const jobId = normalizeWhitespace(posting?.id)

    if (!title || !sourceUrl || !jobId) continue

    jobs.push({
      title,
      company: COMPANY,
      department: normalizeWhitespace(posting?.Industry) || null,
      location: normalizeLocation(posting?.City, country),
      city: normalizeWhitespace(posting?.City) || null,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeWhitespace(posting?.Job_Type) || null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: normalizeWhitespace(posting?.Remote_Job).toLowerCase() === 'yes' ? 'Remote' : 'On-site',
    })
  }

  return jobs
}

export const createHyTechProfessionalsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified HyTech Professionals careers page no longer matches the trusted first-party shell')
    }

    const jobs = extractJobsFromPayload(await fetchJson(JOBS_API_URL))
    if (jobs.length === 0) {
      throw new Error('HyTech Professionals no longer exposes trusted public India jobs')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createHyTechProfessionalsScraper().run(options)

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
