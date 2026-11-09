import path from 'node:path'
import { fileURLToPath } from 'node:url'

import EVOKE_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EVOKE_TECHNOLOGIES_CATALOG.source
export const COMPANY = EVOKE_TECHNOLOGIES_CATALOG.companyName
export const CAREERS_URL = EVOKE_TECHNOLOGIES_CATALOG.companyCareerPage
export const INDIA_JOBS_URL = EVOKE_TECHNOLOGIES_CATALOG.indiaJobsPageUrl
export const VERIFIED_ON = EVOKE_TECHNOLOGIES_CATALOG.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeUrl = (value) => {
  try {
    return new URL(String(value), INDIA_JOBS_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /View Job Openings/i.test(text)
    && text.includes('Join Our Team and Shape the Future of Transformation')
    && /careers\.evoketechnologies\.com/i.test(page)
}

export const hasOfficialIndiaJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return (
    /View All Jobs/i.test(text)
      && /Results\s*1\b[\s\S]{0,20}\bof\s+\d+\s+Page\s+1\s+of\s+1/i.test(text)
      && /Job Req ID/i.test(text)
      && /Evoke Technologies Pvt\. Ltd\./i.test(text)
      && /Privacy Policy/i.test(text)
  ) || (
    /<h1>\s*India\s*<\/h1>/i.test(page)
      && /Results\s*1\b[\s\S]{0,20}\bof\s+\d+\s+Page\s+1\s+of\s+1/i.test(text)
      && /<table[\s>]/i.test(page)
  )
}

export const extractIndiaJobs = (html = '') => {
  const page = String(html ?? '')
  const structuredJobs = Array.from(
    page.matchAll(
      /<tr[^>]*class=["'][^"']*data-row[^"']*["'][\s\S]*?<span[^>]*class=["'][^"']*jobFacility[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*jobTitle-link[^"']*["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/tr>/gi,
    ),
    (match) => ({
      jobId: normalizeWhitespace(match[1]),
      title: stripTags(match[3]),
      location: stripTags(match[4]),
      postingDate: stripTags(match[5]),
      sourceUrl: normalizeUrl(match[2]),
    }),
  ).filter((job) => job.jobId && job.title && job.location && job.postingDate && job.sourceUrl)

  if (structuredJobs.length > 0) {
    return structuredJobs
  }

  return Array.from(
    page.matchAll(
      /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
    ),
    (match) => ({
      jobId: normalizeWhitespace(match[1]),
      title: stripTags(match[3]),
      location: stripTags(match[4]),
      postingDate: stripTags(match[5]),
      sourceUrl: normalizeUrl(match[2]),
    }),
  ).filter((job) => job.jobId && job.title && job.location && job.postingDate && job.sourceUrl)
}

export const createEvokeTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Evoke careers page no longer matches the trusted first-party surface')
    }

    const indiaHtml = await fetchText(INDIA_JOBS_URL)
    if (!hasOfficialIndiaJobsSignal(indiaHtml)) {
      throw new Error('Evoke India listing page no longer matches the trusted public jobs surface')
    }

    const jobs = extractIndiaJobs(indiaHtml)
    if (jobs.length === 0) {
      throw new Error('Evoke India listing page no longer exposes trusted public openings')
    }

    return jobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: normalizeWhitespace(job.location?.split(',')[0]) || null,
      country: 'India',
      jobId: job.jobId,
      requisitionId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: job.postingDate,
      closingDate: null,
      jobDescription: null,
      source: SOURCE,
      link: job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: EVOKE_TECHNOLOGIES_CATALOG.companyDomain,
      atsPlatform: EVOKE_TECHNOLOGIES_CATALOG.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createEvokeTechnologiesScraper(options).run(options)

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
