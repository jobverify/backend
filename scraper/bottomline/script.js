import path from 'node:path'
import { fileURLToPath } from 'node:url'

import BOTTOMLINE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BOTTOMLINE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.careersUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

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

const sameUrl = (left, right) => String(left ?? '').replace(/\/$/, '') === String(right ?? '').replace(/\/$/, '')

export const hasVerifiedCareersPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const title = (extractTitle(html) || '').toLowerCase()

  return title.includes('explore open roles')
    && title.includes('bottomline careers')
    && normalized.includes('current job openings')
    && String(html ?? '').includes('const jobList =')
}

const extractJsonArray = (html = '', anchor = 'const jobList =') => {
  const source = String(html ?? '')
  const anchorIndex = source.indexOf(anchor)
  if (anchorIndex < 0) return null

  const startIndex = source.indexOf('[', anchorIndex)
  if (startIndex < 0) return null

  let depth = 0
  let inString = false
  let isEscaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

export const parseInlineJobList = (html = '') => {
  const rawArray = extractJsonArray(html)
  if (!rawArray) return []

  try {
    const parsed = JSON.parse(rawArray)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const collectLocationSignals = (job = {}) => [
  job?.location?.name,
  ...(Array.isArray(job?.offices) ? job.offices.map((office) => office?.location ?? office?.name) : []),
]
  .filter(Boolean)
  .map((value) => normalizeWhitespace(value))

const metadataIncludesIndia = (metadata = []) =>
  (Array.isArray(metadata) ? metadata : []).some((entry) =>
    /country/i.test(String(entry?.name ?? ''))
    && /india/i.test(Array.isArray(entry?.value) ? entry.value.join(' ') : String(entry?.value ?? '')))

export const isIndiaJob = (job = {}) =>
  collectLocationSignals(job).some((value) => /india/i.test(value)) || metadataIncludesIndia(job.metadata)

const inferCountry = (job = {}) => {
  if (metadataIncludesIndia(job.metadata)) return 'India'
  return collectLocationSignals(job).some((value) => /india/i.test(value)) ? 'India' : null
}

const inferCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const mapJob = (job = {}) => {
  const title = normalizeWhitespace(job?.title)
  const location = normalizeWhitespace(job?.location?.name || collectLocationSignals(job)[0])
  const sourceUrl = normalizeWhitespace(job?.absolute_url)

  if (!title || !location || !sourceUrl) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(job?.departments?.[0]?.name),
    location,
    city: inferCity(location),
    country: inferCountry(job),
    jobId: String(job?.id ?? ''),
    requisitionId: normalizeWhitespace(job?.requisition_id),
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(job?.updated_at ?? job?.created_at)?.slice(0, 10) || null,
    closingDate: null,
    jobDescription: normalizeWhitespace(job?.content),
  }
}

export const extractBottomlineJobs = (html = '') =>
  parseInlineJobList(html)
    .filter(isIndiaJob)
    .map(mapJob)
    .filter(Boolean)

export const createBottomlineScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString() } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasVerifiedCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Bottomline careers page no longer matches the trusted first-party jobs surface')
    }

    const jobs = extractBottomlineJobs(careersPage.html)
    if (jobs.length === 0) {
      throw new Error('Bottomline verified careers page no longer exposes India jobs in the inline jobList payload')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createBottomlineScraper().run(options)

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
