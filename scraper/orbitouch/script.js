import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import ORBITOUCH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = ORBITOUCH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const JOBS_URL = PROVIDER_METADATA.companyCareerPage
export const SUBMIT_CV_URL = PROVIDER_METADATA.submitCvUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const stripHtml = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripHtml(value)
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^full[\s-]?time$/i.test(normalized)) return 'Full-time'
  if (/^part[\s-]?time$/i.test(normalized)) return 'Part-time'
  if (/^contract$/i.test(normalized)) return 'Contract'
  if (/^intern(ship)?$/i.test(normalized)) return 'Internship'
  return normalized
}

const normalizeWorkModel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^on[\s-]?site$/i.test(normalized)) return 'Onsite'
  if (/^hybrid$/i.test(normalized)) return 'Hybrid'
  if (/^remote$/i.test(normalized)) return 'Remote'
  return normalized
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s*-\s*/g, '-')
    .replace(/([0-9.+-]+)(years?)/i, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

const getJobIdFromUrl = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

const normalizeTitleKey = (value) => normalizeWhitespace(value)?.toLowerCase() || null

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Jobs \(List\) \| orbitouch-hr\s*<\/title>/i.test(page)
    && text.includes('Job Listings')
    && text.includes('Number of jobs found')
    && text.includes('OrbiTouch Outsourcing Private Limited')
}

export const buildJobUrlFromTitle = (title) => {
  const rawTitle = String(title ?? '')
  if (!rawTitle) return null

  const slug = rawTitle.toLowerCase().replace(/\s/g, '-')
  return new URL(`/jobs/${slug}`, HOMEPAGE_URL).toString()
}

export const extractAllJobTitles = (html = '') => {
  const match = String(html ?? '').match(
    /"fieldName":"title","role":"userInputFilterDropdownRole","options":\[(.*?)\]/,
  )

  if (!match) return []

  return [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((titleMatch) => JSON.parse(`"${titleMatch[1]}"`))
}

export const extractVisibleListings = (html = '') => [...String(html ?? '').matchAll(
  /<h2[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/h2>[\s\S]*?<p[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/p>[\s\S]*?<a[^>]+href="(https:\/\/www\.orbitouch-hr\.com\/jobs\/[^"]+)"[^>]*>[\s\S]*?View Job[\s\S]*?<\/a>/gi,
)].map((match) => {
  const title = normalizeWhitespace(match[1])
  const location = normalizeWhitespace(match[2])
  const sourceUrl = normalizeWhitespace(match[3])
  const jobId = getJobIdFromUrl(sourceUrl)

  if (!title || !location || !sourceUrl || !jobId) return null

  return {
    title,
    location,
    sourceUrl,
    applyUrl: sourceUrl,
    jobId,
    requisitionId: jobId,
  }
}).filter(Boolean)

const extractTitle = (html, listing = {}) =>
  normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  || normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  || normalizeWhitespace(listing.title)
  || null

export const extractJobDetail = (html = '', listing = {}) => {
  const text = normalizeWhitespace(html)
  const title = extractTitle(html, listing)
  const detailMatch = text.match(
    /Apply Now\s+(.+?)\s+Job Type\s+(.+?)\s+Workspace\s+(.+?)\s+About the Role\s+(.+?)(?:\s+Apply Now\s+Want to learn more\b|\s+Want to learn more\b|$)/i,
  )

  const location = detailMatch?.[1] ? normalizeWhitespace(detailMatch[1]) : normalizeWhitespace(listing.location)
  const employmentType = detailMatch?.[2] ? normalizeEmploymentType(detailMatch[2]) : null
  const workModel = detailMatch?.[3] ? normalizeWorkModel(detailMatch[3]) : null
  const description = detailMatch?.[4] ? normalizeWhitespace(detailMatch[4]) : null
  const experience = normalizeExperience(
    description?.match(/Experience[-:\s]+([0-9][0-9+.\- ]*years?)/i)?.[1] ?? null,
  )
  const minimumQualification = normalizeWhitespace(
    description?.match(/Qualification[-:\s]+([^]+?)(?:\s+(?:Minimum|Experience|Responsibilities|Want to learn more|$))/i)?.[1] ?? null,
  )
  const sourceUrl = listing.sourceUrl || null
  const jobId = listing.jobId || getJobIdFromUrl(sourceUrl)

  return {
    title,
    company: COMPANY,
    department: null,
    location: location || null,
    city: location ? normalizeCity(location.split(',')[0]) : null,
    country: 'India',
    jobId,
    requisitionId: listing.requisitionId || jobId,
    sourceUrl,
    applyUrl: listing.applyUrl || sourceUrl,
    employmentType,
    experienceRequired: experience,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    workModel,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'orbitouch-html',
  timeoutMs: 15000,
})

export const createOrbiTouchScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = defaultNow } = {}) {
    const listHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsBoardSignal(listHtml)) {
      throw new Error('OrbiTouch verified official jobs board no longer matches the trusted first-party surface')
    }

    const visibleListings = extractVisibleListings(listHtml)
    const titleOptions = extractAllJobTitles(listHtml)
    if (visibleListings.length === 0 || titleOptions.length === 0) {
      throw new Error('OrbiTouch verified official jobs board no longer exposes the expected job listing contract')
    }

    const visibleByTitle = new Map(
      visibleListings.map((listing) => [normalizeTitleKey(listing.title), listing]),
    )

    const jobs = []
    const seenJobIds = new Set()

    for (const rawTitle of titleOptions) {
      const titleKey = normalizeTitleKey(rawTitle)
      if (!titleKey) continue

      const listing = visibleByTitle.get(titleKey) || (() => {
        const sourceUrl = buildJobUrlFromTitle(rawTitle)
        const jobId = getJobIdFromUrl(sourceUrl)

        return {
          title: normalizeWhitespace(rawTitle),
          location: null,
          sourceUrl,
          applyUrl: sourceUrl,
          jobId,
          requisitionId: jobId,
        }
      })()

      if (!listing.jobId || seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createOrbiTouchScraper(options).run(options)

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
