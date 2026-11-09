import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { EVEREST_INDUSTRIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = EVEREST_INDUSTRIES_CATALOG.source
export const COMPANY = EVEREST_INDUSTRIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EVEREST_INDUSTRIES_CATALOG.officialBrandName
export const HOMEPAGE_URL = EVEREST_INDUSTRIES_CATALOG.homepageUrl
export const CAREERS_URL = EVEREST_INDUSTRIES_CATALOG.companyCareerPage
export const DARWINBOX_JOBS_URL = EVEREST_INDUSTRIES_CATALOG.darwinboxPublicPortalUrl
export const DARWINBOX_HOME_URL = EVEREST_INDUSTRIES_CATALOG.darwinboxHomeUrl
export const DARWINBOX_ALL_JOBS_URL = EVEREST_INDUSTRIES_CATALOG.darwinboxAllJobsUrl
export const VERIFIED_ON = EVEREST_INDUSTRIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EVEREST_INDUSTRIES_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EVEREST_INDUSTRIES_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
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

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const firstToken = normalized.split(',')[0]?.trim() || normalized
  const city = normalizeCity(firstToken) || firstToken

  return {
    location: `${normalized}, India`,
    city,
    country: 'India',
  }
}

const extractRequisitionId = (value) =>
  normalizeWhitespace(String(value ?? '').match(/\b(JOB\d+)\b/i)?.[1])

const extractOpaqueJobId = (value) =>
  normalizeWhitespace(
    decodeHtmlEntities(value).match(/\/ms\/candidate\/careers\/([a-z0-9]+)___apply=1/i)?.[1],
  )

const deriveDepartment = (value) =>
  normalizeWhitespace(String(value ?? '').replace(/\s*-\s*JOB\d+\s*$/i, ''))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractCareersUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']*careerateverest(?:#Careers)?)["']/gi)) {
    const absolute = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (sameUrl(absolute, CAREERS_URL)) return CAREERS_URL
  }

  return null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return title === 'High-Quality Building Material Manufacturer | Everest Industries'
    && normalized.includes("everest industries - leading building material manufacturer")
    && normalized.includes('#careerateverest')
    && sameUrl(extractCareersUrl(html), CAREERS_URL)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const rawHtml = String(html ?? '')

  return title === 'Everest Industries Careers: Check for Job Vacancies at Everest'
    && normalized.includes('#careerateverest')
    && normalized.includes('submit your resume to our talent database for future opportunities')
    && normalized.includes('careers@everestind.com')
    && /https:\/\/oneeverest\.darwinbox\.in\/ms\/candidate\/candidate\/login\?redirect=\/ms\/candidate\/careers\/[a-z0-9]+___apply=1/i.test(rawHtml)
}

export const extractJobs = (html = '') => {
  if (!hasOfficialCareersPageSignal(html)) {
    throw new Error('Everest Industries careers page no longer matches the verified first-party public surface')
  }

  const jobs = [...String(html ?? '').matchAll(
    /<div class="fw job">[\s\S]*?<a href="(https:\/\/oneeverest\.darwinbox\.in\/ms\/candidate\/candidate\/login\?redirect=\/ms\/candidate\/careers\/[a-z0-9]+___apply=1)"[^>]*>\s*<h5>\s*<span>([\s\S]*?)<\/span>\s*<br>\s*([\s\S]*?)<\/h5>\s*<\/a>\s*<p>([\s\S]*?)<\/p>/gi,
  )].map((match) => {
    const applyUrl = toAbsoluteUrl(match[1], DARWINBOX_JOBS_URL)
    const titlePrefix = normalizeWhitespace(match[2])
    const titleSuffix = normalizeWhitespace(match[3])
    const locationData = parseLocation(match[4])
    const requisitionId = extractRequisitionId(titlePrefix)
    const jobId = extractOpaqueJobId(applyUrl)
    const title = normalizeWhitespace(`${titlePrefix || ''} ${titleSuffix || ''}`)
    const department = deriveDepartment(titlePrefix)

    if (
      !applyUrl
      || !title
      || !locationData.location
      || !locationData.city
      || !department
      || !jobId
      || !requisitionId
    ) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
    }
  }).filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Everest Industries careers page no longer exposes the verified public job cards')
  }

  return jobs
}

export const isVerifiedDarwinboxHomeRoute = (page = {}) =>
  Number(page.status) === 200
  && sameUrl(page.url, DARWINBOX_HOME_URL)
  && (
    extractTitle(page.html) === 'Everest Industries'
    || /Everest Industries/i.test(String(page.html ?? ''))
    || /<base\s+href=["']\/ms\/candidatev2\/["']/i.test(String(page.html ?? ''))
  )

export const isVerifiedDarwinboxAllJobsShell = (page = {}) =>
  Number(page.status) === 200
  && sameUrl(page.url, DARWINBOX_ALL_JOBS_URL)
  && (
    extractTitle(page.html) === 'Everest Industries'
    || /Everest Industries/i.test(String(page.html ?? ''))
    || /<base\s+href=["']\/ms\/candidatev2\/["']/i.test(String(page.html ?? ''))
  )

export const createEverestIndustriesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Everest Industries homepage no longer matches the verified first-party surface')
    }

    const careersUrl = extractCareersUrl(homepage.html)
    if (!sameUrl(careersUrl, CAREERS_URL)) {
      throw new Error('Everest Industries homepage no longer links to the verified careers page')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Everest Industries careers page no longer matches the verified first-party public surface')
    }

    const darwinboxHome = await fetchPage(DARWINBOX_JOBS_URL)
    if (!isVerifiedDarwinboxHomeRoute(darwinboxHome)) {
      throw new Error('Everest Industries Darwinbox public portal route changed materially')
    }

    const darwinboxAllJobs = await fetchPage(DARWINBOX_ALL_JOBS_URL)
    if (!isVerifiedDarwinboxAllJobsShell(darwinboxAllJobs)) {
      throw new Error('Everest Industries Darwinbox all-jobs shell changed materially')
    }

    const jobs = extractJobs(careersPage.html)
      .map((job) => ({
        ...job,
        publicExperienceChecked: true,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createEverestIndustriesScraper(options).run(options)

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
