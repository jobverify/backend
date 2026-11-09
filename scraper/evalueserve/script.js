import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { EVALUESERVE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = EVALUESERVE_CATALOG.source
export const COMPANY = EVALUESERVE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EVALUESERVE_CATALOG.officialBrandName
export const VERIFIED_ON = EVALUESERVE_CATALOG.verifiedOn
export const HOMEPAGE_URL = EVALUESERVE_CATALOG.homepageUrl
export const CAREERS_URL = EVALUESERVE_CATALOG.companyCareerPage
export const JOBS_URL = EVALUESERVE_CATALOG.jobsPageUrl
export const DARWINBOX_BASE_URL = EVALUESERVE_CATALOG.darwinboxBaseUrl
export const PROVIDER_METADATA = EVALUESERVE_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&mdash;/gi, '—')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const extractPrimaryCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const firstToken = normalized.split(',')[0]?.trim()
  if (!firstToken) return null

  return normalizeCity(firstToken) || firstToken
}

const extractDepartment = (summary) => {
  const normalized = normalizeWhitespace(summary)
  if (!normalized) return null

  const match = /within the (.+?) department\.?$/i.exec(normalized)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractJobIdFromUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = /\/careers\/([^/?#]+)/i.exec(normalized)
  return match ? match[1] : null
}

const isIndiaJob = (job = {}) => /^india$/i.test(normalizeWhitespace(job.country) || '')

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Evalueserve\s*<\/title>/i.test(page)
    && /Impact Starts Here\./i.test(page)
    && /Open Positions/i.test(page)
    && /href=["'](?:https:\/\/www\.evalueserve\.com\/jobs\/|\/jobs\/)["']/i.test(page)
}

export const extractJobsPageUrl = (html) => {
  const page = String(html ?? '')
  const match = page.match(/href=["'](https:\/\/www\.evalueserve\.com\/jobs\/)["']/i)
    || page.match(/href=["'](\/jobs\/)["']/i)

  return match ? toAbsoluteUrl(match[1], HOMEPAGE_URL) : null
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')

  return /Jobs at Evalueserve/i.test(page)
    && /db-filters/i.test(page)
    && /<label[^>]*for=['"]India['"]/i.test(page)
    && /db-single-job-wrap/i.test(page)
    && /https:\/\/lighthouse\.darwinbox\.com\/ms\/candidate\/careers\//i.test(page)
}

const extractAllJobCards = (html) => [...String(html ?? '').matchAll(
  /<div class='([^']*db-single-job-wrap)'[\s\S]*?<div class='db-location-country'><h6>([\s\S]*?)<\/h6><\/div>[\s\S]*?<div class='db-job-title'><h4>([\s\S]*?)<\/h4><\/div>[\s\S]*?<div class='db-busniess-unit'><h6>([\s\S]*?)<\/h6><\/div>[\s\S]*?<div class='db-experience-level'><h6>\s*EXP:\s*<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>\s*<\/h6><\/div>[\s\S]*?<div class='db-job-link'><a href=([^\s>]+)[^>]*>Learn More<\/a>/gi,
)]
  .map((match) => {
    const location = stripTags(match[2])
    const title = stripTags(match[3])
    const summary = stripTags(match[4])
    const experienceRequired = stripTags(match[5])
    const sourceUrl = toAbsoluteUrl(match[6], DARWINBOX_BASE_URL)
    const country = location?.split(',').at(-1)?.trim() || null
    const isIndia = /^india$/i.test(country || '')

    if (isIndia && (!sourceUrl || !sourceUrl.startsWith(`${DARWINBOX_BASE_URL}ms/candidate/careers/`))) {
      throw new Error('Evalueserve verified first-party jobs surface no longer exposes the expected Darwinbox job links')
    }

    const jobId = extractJobIdFromUrl(sourceUrl)

    if (!location || !title || !summary || !experienceRequired || !sourceUrl || (isIndia && !jobId)) {
      return null
    }

    if (isIndia && !sameUrl(sourceUrl, `${DARWINBOX_BASE_URL}ms/candidate/careers/${jobId}`)) {
      throw new Error('Evalueserve verified first-party jobs surface no longer exposes the expected Darwinbox job links')
    }

    return {
      title,
      company: COMPANY,
      department: extractDepartment(summary),
      location,
      city: extractPrimaryCity(location),
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: summary,
      publicExperienceChecked: true,
      remoteStatus: null,
    }
  })
  .filter(Boolean)

export const extractJobCards = (html) => extractAllJobCards(html).filter(isIndiaJob)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEvalueserveScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Evalueserve verified official careers surface no longer matches the first-party contract')
    }

    const jobsPageUrl = extractJobsPageUrl(careersHtml)
    if (!sameUrl(jobsPageUrl, JOBS_URL)) {
      throw new Error('Evalueserve verified official careers surface no longer links to the expected first-party jobs page')
    }

    const jobsHtml = await fetchText(JOBS_URL)

    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('Evalueserve verified first-party jobs surface no longer matches the public contract')
    }

    const allJobs = extractAllJobCards(jobsHtml)
    if (allJobs.length === 0) {
      throw new Error('Evalueserve verified first-party jobs surface no longer exposes the expected job cards')
    }

    const jobs = allJobs
      .filter(isIndiaJob)
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createEvalueserveScraper(options).run(options)

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
