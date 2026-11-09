import { createCurrentPrefectScraper } from './currentNative.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'
import { createAshbyApiScraper } from '../../scraper-support/utils/ashbyApi.js'
import { attachInventoryEvidence, mapJobsWithInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { activeIframeSources, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { identifyPublicAtsBoard } from '../../scraper-support/utils/publicAtsIdentity.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'prefect'
export const COMPANY = 'Prefect'
export const VERIFIED_ON = '2026-07-25'
export const COMPANY_PAGE_URL = 'https://www.prefect.io/company'
export const CAREERS_PAGE_URL = 'https://www.prefect.io/careers'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/prefect'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/prefect'

const normalizeString = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}) => {
  const address = getAddress(location)
  const label = normalizeString(location?.location)
  const city = normalizeString(address?.addressLocality)
  const state = normalizeString(address?.addressRegion)
  const country = normalizeString(address?.addressCountry)

  return {
    location: label || [city, state, country].filter(Boolean).join(', '),
    city,
    state,
    country,
  }
}

const hasExplicitIndiaSignal = (candidate = {}) => {
  const location = normalizeString(candidate.location) || ''
  const country = normalizeString(candidate.country) || ''
  const city = normalizeString(candidate.city) || ''
  const state = normalizeString(candidate.state) || ''

  return /india/i.test([location, country, city, state].join(' '))
}

const selectIndiaLocation = (job = {}) => {
  const candidates = [
    toLocationCandidate({ location: job.location, address: job.address }),
    ...(Array.isArray(job.secondaryLocations) ? job.secondaryLocations : []).map(toLocationCandidate),
  ].filter((candidate) => candidate.location)

  return filterIndiaJobs(candidates).find(hasExplicitIndiaSignal) || null
}

const inferRemoteStatus = (job = {}) => {
  if (job?.isRemote === true || /remote/i.test(String(job?.workplaceType ?? ''))) return 'Remote'
  if (/hybrid/i.test(String(job?.workplaceType ?? ''))) return 'Hybrid'
  if (job?.workplaceType) return 'On-site'
  return null
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCompanyPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeString(rawHtml) || ''

  return /prefect/i.test(rawHtml)
    && normalized.includes('We are Prefect')
    && normalized.includes('Defining automation for the context era')
    && normalized.includes('Join the team defining the future of workflow automation')
    && /Careers|See Open Roles/i.test(normalized)
}

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeString(rawHtml) || ''

  return /Careers at Prefect - Open Roles/i.test(rawHtml)
    && normalized.includes('Join the team defining the future of workflow automation')
    && normalized.includes("We're remote first and have carefully created a supportive, high-performance culture.")
    && /Open roles|Loading open roles/i.test(normalized)
    && /ashby-job-board\.css/i.test(rawHtml)
}

const activeLinks = html => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href)
  .map(node => node.attrs.href)

export const extractVerifiedCareersPageUrl = (html = '') => activeLinks(html).some(href => {
  try { return new URL(href, COMPANY_PAGE_URL).href === CAREERS_PAGE_URL } catch { return false }
}) ? CAREERS_PAGE_URL : null

export const extractAnyAshbyPublicBoardUrl = (html = '') => {
  for (const href of [...activeLinks(html), ...activeIframeSources(html)]) {
    let url
    try { url = new URL(href, COMPANY_PAGE_URL) } catch { continue }
    const board = identifyPublicAtsBoard(url.href)
    if (url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password
      && board?.atsPlatform === 'ashby') return `https://jobs.ashbyhq.com/${board.boardToken}`
  }
  return null
}

export const extractVerifiedAshbyPublicBoardUrl = (html = '') =>
  extractAnyAshbyPublicBoardUrl(html) === ASHBY_PUBLIC_BOARD_URL ? ASHBY_PUBLIC_BOARD_URL : null

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

export const extractAshbyJobs = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeString(job?.title)
      const jobId = normalizeString(job?.id)
      const sourceUrl = normalizeString(job?.jobUrl)
      const applyUrl = normalizeString(job?.applyUrl)
      const selectedLocation = selectIndiaLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !selectedLocation) return null

      return {
        title,
        company: COMPANY,
        department: normalizeString(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
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
        remoteStatus: inferRemoteStatus(job),
      }
    })
    .filter(Boolean)

export const createPrefectScraper = (options = {}) => createCurrentPrefectScraper(options)

export const run = async (options = {}) => createPrefectScraper(options).run(options)

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
