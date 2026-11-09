import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { decodeJavaScriptStringLiteral } from '../../scraper-support/utils/safeLiteral.js'

import TECHMOJO_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TECHMOJO_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_JOBS_URL = PROVIDER_METADATA.publicJobsUrl
export const PUBLIC_COMPANY_BOARD_URL = PROVIDER_METADATA.publicCompanyBoardUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) =>
  decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const titleCaseToken = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())

const unwrapQuotedDescription = (value) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''

  if (
    (normalized.startsWith('"') && normalized.endsWith('"'))
    || (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    try {
      return JSON.parse(normalized)
    } catch {
      return normalized.slice(1, -1)
    }
  }

  return normalized
}

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).replace(/_/g, ' ').toLowerCase()
  if (!normalized) return null
  if (normalized === 'full time') return 'Full-time'
  if (normalized === 'part time') return 'Part-time'
  if (normalized === 'contract') return 'Contract'
  return titleCaseToken(normalized)
}

const normalizeWorkMode = (value) => {
  const normalized = normalizeWhitespace(value).replace(/_/g, ' ').toLowerCase()
  if (!normalized) return null
  if (normalized.includes('office')) return 'On-site'
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  return titleCaseToken(normalized)
}

const normalizeLocation = (record = {}) => {
  const extracted = record.location_extracted || {}
  const landingLocation = record._landingApplyPayload?.location || {}
  const country = normalizeWhitespace(extracted.country || record.loc_country || landingLocation.country)
  if (!country) throw new Error('TechMojo incomplete country scope')
  const city = titleCaseToken(
    extracted.city_display_name || extracted.city || record.loc_city || landingLocation.cityDisplay || landingLocation.city || record.location,
  )
  const state = titleCaseToken(extracted.stateName || extracted.state || landingLocation.stateName)

  return {
    country,
    city: city || null,
    location: [city, state, country].filter(Boolean).join(', '),
  }
}

const buildJobUrl = (record = {}) => {
  const segment = normalizeWhitespace(record.jobUrlSegment)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment)) throw new Error('TechMojo invalid job URL segment')
  return new URL(`/jobs/techmojo-solutions/${segment}/`, PUBLIC_JOBS_URL).toString()
}

export const hasOfficialCareersSignal = (html = '') => {
  const text = stripTags(html)
  const page = String(html ?? '')

  return /Careers at TechMojo/i.test(text)
    && /Build where engineering is tested by/i.test(text)
    && [...page.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].some((match) => {
      try {
        const url = new URL(decodeHtml(match[1]), CAREERS_URL)
        return url.origin === 'https://9am.careers' && url.pathname.replace(/\/$/, '') === '/jobs/techmojo-solutions'
      } catch { return false }
    })
}

const findJobsDataLiteral = (html = '') => {
  const page = String(html ?? '')
  const marker = 'const jobsData ='
  const markerIndex = page.indexOf(marker)
  if (markerIndex === -1) return null

  let index = markerIndex + marker.length
  while (/\s/.test(page[index] || '')) index += 1
  const quote = page[index]
  if (quote !== '"' && quote !== "'") return null

  let escaped = false
  for (let cursor = index + 1; cursor < page.length; cursor += 1) {
    const char = page[cursor]
    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === quote) {
      return page.slice(index, cursor + 1)
    }
  }

  return null
}

export const extractPublicJobsPayload = (html = '') => {
  const literal = findJobsDataLiteral(html)
  if (!literal) {
    throw new Error('TechMojo 9am public jobs payload marker disappeared')
  }

  const decoded = decodeJavaScriptStringLiteral(literal)
  const parsed = JSON.parse(decoded)
  if (!Array.isArray(parsed)) {
    throw new Error('TechMojo 9am public jobs payload is no longer an array')
  }

  return parsed
}

export const hasPublicJobsPayloadSignal = (html = '') => (
  extractPublicJobsPayload(html).some((record) => (
    record?.displaySlug === 'techmojo-solutions'
    && /^TECHMOJO SOLUTIONS$/i.test(normalizeWhitespace(record?.company))
  ))
)

const extractJobsFromRecords = (records, scrapedAt) => {
  const seen = new Set()
  const jobs = []

  for (const record of records) {
    if (
      record?.displaySlug !== 'techmojo-solutions'
      || !/^TECHMOJO SOLUTIONS$/i.test(normalizeWhitespace(record?.company))
      || String(record?.status ?? '').toLowerCase() !== 'open'
    ) {
      continue
    }

    const title = normalizeWhitespace(record.title)
    const url = buildJobUrl(record)
    const key = `${record.id || record.sequenceNo || title}::${url}`
    if (!title || !record.id) throw new Error('TechMojo incomplete public role identity')
    if (seen.has(key)) throw new Error('TechMojo duplicate public role')

    seen.add(key)
    const { city, location, country } = normalizeLocation(record)
    if (country.toLowerCase() !== 'india') continue
    const descriptionHtml = unwrapQuotedDescription(record.description || record._landingApplyPayload?.jobDescription)

    jobs.push({
      title,
      company: COMPANY,
      location,
      city,
      country: 'India',
      sourceUrl: url,
      applyUrl: url,
      employmentType: normalizeEmploymentType(record.employment_type || record._landingApplyPayload?.typeOfJob),
      experienceRequired: null,
      requiredSkills: extractListItems(descriptionHtml),
      jobDescription: stripTags(descriptionHtml) || null,
      source: SOURCE,
      link: url,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      jobId: record.id || `${SOURCE}-${record.sequenceNo || record.jobUrlSegment}`,
      requisitionId: String(record.sequenceNo || record.id || record.jobUrlSegment || ''),
      department: null,
      postingDate: record.created_at || record.updated_at || null,
      closingDate: null,
      remoteStatus: normalizeWorkMode(record.workMode),
    })
  }

  return jobs
}

export const extractJobs = (html = '', scrapedAt = new Date().toISOString()) =>
  extractJobsFromRecords(extractPublicJobsPayload(html), scrapedAt)

const extractDetailPayload = (html) => {
  const page = String(html ?? '')
  const marker = /\bconst\s+applyPayload\s*=\s*/g.exec(page)
  if (!marker) throw new Error('TechMojo detail payload marker disappeared')
  const start = marker.index + marker[0].length
  let depth = 0
  let quoted = false
  let escaped = false
  if (page[start] !== '{') throw new Error('TechMojo invalid detail payload')
  for (let index = start; index < page.length; index += 1) {
    const char = page[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') depth += 1
    else if (char === '}' && --depth === 0) return JSON.parse(page.slice(start, index + 1))
  }
  throw new Error('TechMojo incomplete detail payload')
}

export const createTechMojoSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified TechMojo Solutions careers page changed materially')
    }

    const publicJobsHtml = await fetchText(PUBLIC_COMPANY_BOARD_URL)
    if (!hasPublicJobsPayloadSignal(publicJobsHtml)) {
      throw new Error('The verified TechMojo Solutions 9am public jobs payload changed materially')
    }

    const records = extractPublicJobsPayload(publicJobsHtml)
    const advertisedCount = publicJobsHtml.match(/<p\b[^>]*class=["'][^"']*\bcompany-header-count\b[^"']*["'][^>]*>\s*(\d+)\s+jobs? available\s*<\/p>/i)?.[1]
    if ((advertisedCount != null && Number(advertisedCount) !== records.length)
      || (records.some(record => Object.hasOwn(record, 'loc_country')) && advertisedCount == null)) {
      throw new Error('TechMojo incomplete public company-board count')
    }
    // The company board embeds the complete list; the homepage now shows featured roles only.
    const listedJobs = extractJobsFromRecords(records, now())
    const hydrated = []
    for (const job of listedJobs) {
      const record = records.find(record => record.id === job.jobId)
      if (job.jobDescription) {
        hydrated.push(record)
        continue
      }
      const detail = extractDetailPayload(await fetchText(job.sourceUrl))
      if (detail.id !== record.id || normalizeWhitespace(detail.title) !== job.title
        || !/^TECHMOJO SOLUTIONS$/i.test(normalizeWhitespace(detail.company))
        || String(detail.status).toLowerCase() !== 'open'
        || !stripTags(unwrapQuotedDescription(detail.description))) {
        throw new Error('TechMojo detail identity or employer does not match the company board')
      }
      if (normalizeLocation(detail).country.toLowerCase() !== 'india') throw new Error('TechMojo detail country scope changed')
      hydrated.push({ ...record, ...detail, jobUrlSegment: record.jobUrlSegment, displaySlug: record.displaySlug })
    }
    return extractJobsFromRecords(hydrated, now())
  },
})

export const run = async (options = {}) => createTechMojoSolutionsScraper(options).run(options)

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
