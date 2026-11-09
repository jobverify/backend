import { readCurrentCareers } from './currentCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'tensorgosoftwarepvtltd'
export const COMPANY = 'TensorGo Software Pvt Ltd'
export const CAREERS_PAGE_URL = 'https://tensorgo.com/careers-at-tensorgo/'
export const JOBS_API_URL = 'https://tensorgo.com/wp-json/wp/v2/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FOREIGN_LOCATION_PATTERN =
  /united states|usa|u\.s\.|canada|europe|uk|united kingdom|singapore|dubai|uae|australia/i

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) return directMatch[1]

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/india/i.test(normalized)) return true
  return !FOREIGN_LOCATION_PATTERN.test(normalized)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const withoutCountry = normalized.replace(/,\s*India$/i, '')
  const withoutParenthetical = normalizeWhitespace(withoutCountry.replace(/\s*\([^)]*\)\s*/g, ' '))
  if (!withoutParenthetical) return null
  if (/[\/|]/.test(withoutParenthetical)) return null

  const firstPart = normalizeWhitespace(withoutParenthetical.split(',')[0])
  return firstPart || null
}

const normalizeLocationLabel = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return /india/i.test(normalized) ? normalized : `${normalized}, India`
}

const inferRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote') || normalized.includes('wfh')) return 'Remote'
  return 'On-site'
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractJobSpecification = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp(`${escapeRegExp(label)}<\\/p>[\\s\\S]{0,200}?<h5>\\s*([\\s\\S]*?)\\s*<\\/h5>`, 'i'),
  )

  return stripTags(match?.[1] || null)
}

const extractDetailSections = (html) => {
  const page = String(html ?? '')
  const descriptionsIndex = page.indexOf('class="descriptions"')
  if (descriptionsIndex < 0) return []

  const applyIndex = page.indexOf('Join the awesome squad. Apply now!', descriptionsIndex)
  const segment = applyIndex >= 0 ? page.slice(descriptionsIndex, applyIndex) : page.slice(descriptionsIndex)

  return [...segment.matchAll(
    /<h2\b[^>]*class="title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/h2>([\s\S]*?)(?=<h2\b[^>]*class="title|$)/gi,
  )]
    .map((match) => ({
      heading: stripTags(match[1]),
      text: stripTags(match[2]),
      items: extractListItems(match[2]),
    }))
    .filter((section) => section.heading && section.text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Careers at TensorGo/i.test(page)
    && /Explore Open Positions/i.test(page)
    && /id="job-results"/i.test(page)
    && /https:\/\/tensorgo\.com\/jobs\//i.test(page)
}

export const hasVerifiedRetiredCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*HumAIn by TensorGo \| The World's First Pre-AGI Teammates\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/(?:humains\.one|tensorgo\.com)\/["']/i.test(page)
    && /"name"\s*:\s*"TensorGo"/i.test(page)
    && !/id=["']job-results["']/i.test(page)
    && !/Explore Open Positions/i.test(page)
}

export const hasOfficialJobDetailSignal = (html) => {
  const page = String(html ?? '')

  return /Job ID<\/p>/i.test(page)
    && /Location<\/p>/i.test(page)
    && /Experience<\/p>/i.test(page)
    && /Join the awesome squad\. Apply now!/i.test(page)
}

export const buildListingsApiUrl = (page = 1, pageSize = 100) => {
  const url = new URL(JOBS_API_URL)
  url.searchParams.set('_fields', 'id,date,link,title')
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractJobDetail = (html) => {
  if (!hasOfficialJobDetailSignal(html)) {
    throw new Error('Response is not the verified TensorGo job detail surface')
  }

  const jobId = extractJobSpecification(html, 'Job ID')
  const location = extractJobSpecification(html, 'Location')
  const experienceRequired = extractJobSpecification(html, 'Experience')

  if (!jobId || !location || !experienceRequired) {
    throw new Error('Response is not the verified TensorGo job detail surface')
  }

  const sections = extractDetailSections(html)
  const qualifications = sections.find((section) => /qualifications/i.test(section.heading))
  const jobDescription = sections
    .map((section) => `${section.heading}: ${section.text}`)
    .join('\n\n') || null

  return {
    jobId,
    requisitionId: jobId,
    location: normalizeLocationLabel(location),
    city: extractCity(location),
    state: null,
    country: 'India',
    experienceRequired,
    employmentType: null,
    requiredSkills: qualifications?.items || [],
    jobDescription,
    remoteStatus: inferRemoteStatus(location),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 15000,
})

const buildJobFromListing = async (listing, { fetchText }) => {
  const title = stripTags(listing?.title?.rendered)
  const sourceUrl = normalizeWhitespace(listing?.link)

  if (!title || !sourceUrl) return null

  const detailHtml = await fetchText(sourceUrl)
  const detail = extractJobDetail(detailHtml)
  if (!isIndiaLocation(detail.location)) return null

  return {
    title,
    company: COMPANY,
    department: null,
    location: detail.location,
    city: detail.city,
    state: detail.state,
    country: detail.country,
    jobId: detail.jobId,
    requisitionId: detail.requisitionId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: detail.employmentType,
    experienceRequired: detail.experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: detail.requiredSkills,
    postingDate: normalizePostingDate(listing?.date),
    closingDate: null,
    jobDescription: detail.jobDescription,
    remoteStatus: detail.remoteStatus,
  }
}

export const createTensorGoSoftwarePvtLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  pageSize = 100,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const readText = async url => { signal?.throwIfAborted(); const value = await fetchText(url, { signal }); signal?.throwIfAborted(); return value }
    const readJson = async url => { signal?.throwIfAborted(); const value = await fetchJson(url, { signal }); signal?.throwIfAborted(); return value }
    const careersHtml = await readText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      if (hasVerifiedRetiredCareersSignal(careersHtml)) return readCurrentCareers({ html: careersHtml, readText, readJson, maxJobs, now })
      throw new Error('Response is not the verified official TensorGo careers surface')
    }

    const jobs = []
    let page = 1

    while (true) {
      const payload = await readJson(buildListingsApiUrl(page, pageSize))
      if (!Array.isArray(payload)) {
        throw new Error('Response is not the verified TensorGo jobs feed')
      }

      if (payload.length === 0) break

      for (const listing of payload) {
        const job = await buildJobFromListing(listing, { fetchText: readText })
        if (!job) continue

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      if (payload.length < pageSize) break
      page += 1
    }

    return jobs
  },
})

export const run = async (options = {}) => createTensorGoSoftwarePvtLtdScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total TensorGo Software Pvt Ltd jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
