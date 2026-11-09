import { createDeclaredJobFeedScraper, DECLARED_JOB_FEED_PROFILES } from '../../scraper-support/native-sources/declaredJobFeeds/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SANDBOXAQ_CATALOG } from './catalog.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SANDBOXAQ_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_LIST_URL = PROVIDER_METADATA.officialCareersListUrl
export const ASHBY_PUBLIC_BOARD_URL = PROVIDER_METADATA.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = PROVIDER_METADATA.ashbyJobBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeString = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const stripTags = (value) => normalizeString(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  return normalized ? normalized.replace(/([a-z])([A-Z])/g, '$1 $2') : null
}

const normalizeRemoteStatus = (value, isRemote = false) => {
  const normalized = normalizeString(value)
  if (normalized === 'Remote' || isRemote) return 'Remote'
  if (normalized === 'Hybrid') return 'Hybrid'
  if (normalized === 'OnSite') return 'On-site'
  return null
}

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] ?? null

const toAbsoluteUrl = (value, baseUrl = CAREERS_PAGE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const getAddress = (job = {}) => job?.address?.postalAddress || {}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const visibleText = stripTags(rawHtml) || ''

  return /<title[^>]*>\s*Careers\s*\|\s*SandboxAQ\s*<\/title>/i.test(rawHtml)
    && (
      /Careers at Sandbox AQ/i.test(visibleText)
      || /Careers at SandboxAQ/i.test(visibleText)
    )
    && /Residency Program/i.test(visibleText)
    && /View Job Openings/i.test(visibleText)
    && /href=["'](?:https:\/\/www\.sandboxaq\.com)?\/careers-list(?:[/?#][^"']*)?["']/i.test(rawHtml)
}

export const extractVerifiedCareersListUrl = (html = '') => {
  const href = extractFirst(/href=["']([^"']*\/careers-list[^"']*)["']/i, html)
  const absoluteUrl = toAbsoluteUrl(href, CAREERS_PAGE_URL)
  return hasOfficialCareersSignal(html) && absoluteUrl === CAREERS_LIST_URL ? absoluteUrl : null
}

export const hasVerifiedCareersListShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /Sign up for email updates/i.test(rawHtml)
    && /Get updates on how SandboxAQ can power your organization\./i.test(rawHtml)
    && /©\s*2026\s*SandboxAQ/i.test(rawHtml)
}

export const hasVerifiedAshbyPublicBoardShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title[^>]*>\s*SandboxAQ Jobs\s*<\/title>/i.test(rawHtml)
    && /You need to enable JavaScript to run this app\./i.test(rawHtml)
}

export const buildAshbyJobBoardUrl = (publicBoardUrl) => {
  try {
    const url = new URL(String(publicBoardUrl ?? ''))
    if (url.hostname !== 'jobs.ashbyhq.com') return null
    const slug = url.pathname.split('/').filter(Boolean)[0]
    return slug ? `https://api.ashbyhq.com/posting-api/job-board/${slug}` : null
  } catch {
    return null
  }
}

export const extractAshbyJobs = (payload = {}) => (
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const sourceUrl = normalizeString(job?.jobUrl)
      const applyUrl = normalizeString(job?.applyUrl)
      const location = normalizeString(job?.location)
      const address = getAddress(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !location) return null

      return {
        title,
        company: COMPANY,
        department: normalizeString(job?.department),
        location,
        city: normalizeString(address?.addressLocality),
        state: normalizeString(address?.addressRegion),
        country: normalizeString(address?.addressCountry) || location,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: extractAshbyExperienceRequired({
          title,
          jobDescription: normalizeString(job?.descriptionPlain ?? job?.descriptionHtml),
        }),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeString(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeString(job?.descriptionPlain ?? job?.descriptionHtml),
        remoteStatus: normalizeRemoteStatus(job?.workplaceType, job?.isRemote === true),
      }
    })
    .filter(Boolean)
)

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

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createSandboxAQScraper = (options = {}) => createDeclaredJobFeedScraper(DECLARED_JOB_FEED_PROFILES.sandboxaq, options)

export const run = async (options = {}) => createSandboxAQScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
