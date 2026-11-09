import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CADSYS_CATALOG as PROVIDER_METADATA } from './catalog.js'

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

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    url: response.url,
    html: await response.text(),
  }
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Careers')
    && normalized.includes('next generation work platform')
    && normalized.includes('Senior Data Scientist')
    && normalized.includes('Software Engineer, Backend')
    && normalized.includes('Software Engineer, Frontend')
    && normalized.includes('Remote / Hybrid')
  }

const CAREERS_HOSTNAME = new URL(CAREERS_URL).hostname

const isTrustedCareersUrl = (url = CAREERS_URL) => {
  try {
    return new URL(url).hostname === CAREERS_HOSTNAME
  } catch {
    return false
  }
}

export const extractJobs = (html = '') => {
  const jobs = []
  const seen = new Set()
  const rolePattern = /<a[^>]+href=["']([^"']+)["'][^>]*>\s*([^<]+?)\s*<span>\s*(Remote\s*\/\s*Hybrid)\s*<\/span>\s*<\/a>/gi

  for (const match of html.matchAll(rolePattern)) {
    const title = normalizeWhitespace(match[2])
    const location = normalizeWhitespace(match[3])
    const detailUrl = new URL(match[1], CAREERS_URL).toString()
    const jobId = slugify(title)

    if (!title || seen.has(jobId)) continue
    seen.add(jobId)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: null,
      country: null,
      jobId,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs
}

export const createCadsysScraper = ({ maxJobs = Number.POSITIVE_INFINITY } = {}) => ({
  async run({ fetchText, fetchPage = defaultFetchPage, now = () => new Date().toISOString() } = {}) {
    const careersPage = fetchText
      ? {
          url: CAREERS_URL,
          html: await fetchText(CAREERS_URL),
        }
      : await fetchPage(CAREERS_URL)

    if (!isTrustedCareersUrl(careersPage.url)) {
      return []
    }

    const careersHtml = careersPage.html
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Cadsys verified first-party careers page changed materially')
    }

    const jobs = extractJobs(careersHtml)
    if (!jobs.length) {
      throw new Error('Cadsys verified first-party careers page changed materially')
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

export const run = async (options = {}) => createCadsysScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
