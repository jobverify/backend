import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

import SETU_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SETU_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const CURRENT_OPENINGS_CSV_URL = PROVIDER_METADATA.currentOpeningsCsvUrl
export const CATEGORY_DESCRIPTIONS_CSV_URL = PROVIDER_METADATA.categoryDescriptionsCsvUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[’‘]/g, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/[“”]/g, '"')
  .replace(/&#169;/gi, '(c)')
  .replace(/Ã¢â€ â€”/g, '->')
  .replace(/Ã‚Â©/g, '(c)')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeUrl = (value) => String(value ?? '').trim()

const extractMetaContent = (html = '', key = '') => {
  const escapedKey = String(key ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escapedKey) return null

  const match = String(html ?? '').match(
    new RegExp(
      `<meta\\b[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
      'i',
    ),
  )

  return normalizeWhitespace(match?.[1])
}

const normalizeTurbohireDetailDescription = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/([a-z0-9])([A-Z][a-z])/g, '$1 $2')
    .replace(/\b(About Setu|Importance of the role|What we do:|What will you do at Setu\?|Who is the right fit for this role\?|Why Setu\?|To know more - Click on View full description)\b/g, ' $1 ')
    .replace(/\b(Setu India’s)\b/g, 'Setu. India’s')
    .replace(/\b(role)([A-Z])/g, '$1. $2')
    .replace(/\b(experience)(About Setu)\b/gi, '$1. $2'),
)

const extractTurbohireExperienceFromText = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const patterns = [
    /\b(\d{1,2}\s*-\s*\d{1,2})\s*years?\s+of\s+experience\b/i,
    /\bexperience\s*[:\-]?\s*(\d{1,2}\s*-\s*\d{1,2})\s*years?\b/i,
    /\b(\d{1,2}\s*\+)\s*years?(?:\s+of\s+experience)?\b/i,
    /\b(\d{1,2})\s*years?\s+of\s+experience\b/i,
  ]

  for (const pattern of patterns) {
    const matchedValue = normalized.match(pattern)?.[1]
    if (!matchedValue) continue

    const years = normalizeWhitespace(
      matchedValue
        .replace(/\s*-\s*/g, '-')
        .replace(/\s*\+\s*/g, '+'),
    )

    if (!years) continue
    return /\+$/.test(years) ? `${years} years` : `${years} years`
  }

  return null
}

const inferExperienceFromDescription = (value) => {
  const normalized = normalizeTurbohireDetailDescription(value)
  if (!normalized) return null

  const explicitYears = extractTurbohireExperienceFromText(normalized)
  if (explicitYears) return explicitYears

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const isUnavailableTurbohireDetailError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    if (Number(current?.status) === 404 || Number(current?.status) === 410) {
      return true
    }

    if (/HTTP (404|410)\b/i.test(normalizeWhitespace(current?.message) || '')) {
      return true
    }

    current = current?.cause
  }

  return false
}

export const extractTurbohireDetailDescription = (html = '') => (
  normalizeTurbohireDetailDescription(
    extractMetaContent(html, 'og:description')
    || extractMetaContent(html, 'description')
    || null,
  )
)

export const enrichSetuJobFromDetailPage = (job, detailHtml = '') => {
  const detailDescription = extractTurbohireDetailDescription(detailHtml)
  const experienceRequired = inferExperienceFromDescription(detailDescription)

  return {
    ...job,
    jobDescription: detailDescription || job.jobDescription || null,
    experienceRequired: experienceRequired || job.experienceRequired || null,
    publicExperienceChecked: Boolean(detailDescription || job.jobDescription),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/csv,text/plain;q=0.8,*/*;q=0.7',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const title = (extractTitle(page) || '').toLowerCase()
  const markup = page.toLowerCase()

  const hasCanonicalCareersRoute = /<link\b[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/setu\.co\/careers\/?["']/i.test(page)
  const hasCurrentFramerSurface = title.includes('careers at setu')
    && hasCanonicalCareersRoute
    && markup.includes('help us build the financial infrastructure india runs on')
    && markup.includes('open roles')
    && markup.includes('every role links straight through to our application portal')

  const hasLegacyCsvSurface = title.includes('careers at setu')
    && markup.includes("come tackle india's toughest fintech problems")
    && markup.includes("overhauling our country's dated fintech architecture")
    && markup.includes('current openings')
    && markup.includes('brokentusk technologies pvt. ltd')

  return hasCurrentFramerSurface || hasLegacyCsvSurface
}

export const hasPlaceholderOpeningsSignal = (html = '') =>
  /Fetching open roles/i.test(String(html ?? ''))

const parseCsvLine = (line) => {
  const columns = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      columns.push(current)
      current = ''
    } else {
      current += char
    }
  }

  columns.push(current)
  return columns.map((value) => normalizeWhitespace(value) || '')
}

const parseCsvTable = (csvText = '') => {
  const lines = String(csvText ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
    }
  }

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const columns = parseCsvLine(line)

    return headers.reduce((record, header, index) => {
      record[header] = columns[index] || ''
      return record
    }, {})
  })

  return {
    headers,
    rows,
  }
}

const hasHeaders = (headers, expectedHeaders) =>
  headers.length === expectedHeaders.length
  && headers.every((header, index) => header === expectedHeaders[index])

const extractTurbohireToken = (value) =>
  normalizeUrl(value).match(/\/get\/([^/?#]+)/i)?.[1] || null

const isTurbohireApplyUrl = (value) =>
  /^https:\/\/pinelabsgroup\.turbohire\.co\/get\/[^/?#]+$/i.test(normalizeUrl(value))

export const extractCurrentCareersJobs = (html = '') => {
  const page = String(html ?? '')
  const jobs = []
  const seenJobIds = new Set()

  for (const match of page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const applyUrl = normalizeUrl(match[1])
    const body = match[2]
    if (!/turbohire\.co\/get\//i.test(applyUrl) && !(/<h[1-6]\b/i.test(body) && /\bApply\b/i.test(normalizeWhitespace(body) || ''))) continue
    const title = normalizeWhitespace(body.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
    const department = normalizeWhitespace(body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const jobId = extractTurbohireToken(applyUrl)

    if (!title || !jobId || !isTurbohireApplyUrl(applyUrl)) throw new Error('Setu incomplete listing: malformed role card')
    if (seenJobIds.has(jobId)) {
      if (jobs.find(job => job.jobId === jobId)?.title !== title) throw new Error('Setu incomplete listing: conflicting duplicate role')
      continue
    }

    seenJobIds.add(jobId)
    jobs.push({
      jobId,
      title,
      department,
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: applyUrl,
      applyUrl,
      jobDescription: null,
    })
  }

  return jobs
}

export const hasCurrentOpeningsCsvSignal = (csvText = '') => {
  const { headers, rows } = parseCsvTable(csvText)

  return hasHeaders(headers, ['Role', 'Description', 'Link', 'Category', 'Sub-category'])
    && rows.length > 0
    && rows.some((row) =>
      normalizeWhitespace(row.Role)
      && normalizeWhitespace(row.Category)
      && isTurbohireApplyUrl(row.Link),
    )
}

export const hasCategoryDescriptionsCsvSignal = (csvText = '') => {
  const { headers, rows } = parseCsvTable(csvText)
  const categories = new Set(rows.map((row) => normalizeWhitespace(row.Category)).filter(Boolean))

  return hasHeaders(headers, ['Category', 'Description'])
    && categories.has('Engineering')
    && categories.has('Payments')
}

const buildCategoryDescriptionMap = (csvText = '') => {
  const { rows } = parseCsvTable(csvText)

  return rows.reduce((map, row) => {
    const category = normalizeWhitespace(row.Category)
    const description = normalizeWhitespace(row.Description)

    if (category && description) {
      map.set(category, description)
    }

    return map
  }, new Map())
}

export const extractJobsFromCsv = (currentOpeningsCsv = '', categoryDescriptionsCsv = '') => {
  const { rows } = parseCsvTable(currentOpeningsCsv)
  const descriptionsByCategory = buildCategoryDescriptionMap(categoryDescriptionsCsv)
  const jobs = []
  const seenJobIds = new Set()

  for (const row of rows) {
    const title = normalizeWhitespace(row.Role)
    const applyUrl = normalizeUrl(row.Link)
    const jobId = extractTurbohireToken(applyUrl) || slugify(title)
    const category = normalizeWhitespace(row.Category)
    const subCategory = normalizeWhitespace(row['Sub-category'])
    const jobDescription = (
      descriptionsByCategory.get(subCategory)
      || descriptionsByCategory.get(category)
      || null
    )

    if (!title || !applyUrl || !jobId || !isTurbohireApplyUrl(applyUrl)) throw new Error('Setu incomplete CSV inventory: malformed role')
    if (seenJobIds.has(jobId)) continue

    seenJobIds.add(jobId)
    jobs.push({
      jobId,
      title,
      department: category || subCategory || null,
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: applyUrl,
      applyUrl,
      jobDescription,
    })
  }

  return jobs
}

export const createSetuScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const read = async (url) => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const careersHtml = await read(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Setu careers page changed materially')
    }

    let extractedJobs
    if (hasPlaceholderOpeningsSignal(careersHtml)) {
      const currentOpeningsCsv = await read(CURRENT_OPENINGS_CSV_URL)
      if (!hasCurrentOpeningsCsvSignal(currentOpeningsCsv)) {
        throw new Error('The verified Setu current openings CSV no longer matches the trusted public surface')
      }

      const categoryDescriptionsCsv = await read(CATEGORY_DESCRIPTIONS_CSV_URL)
      if (!hasCategoryDescriptionsCsvSignal(categoryDescriptionsCsv)) {
        throw new Error('The verified Setu category descriptions CSV no longer matches the trusted public surface')
      }

      extractedJobs = extractJobsFromCsv(currentOpeningsCsv, categoryDescriptionsCsv)
    } else {
      extractedJobs = extractCurrentCareersJobs(careersHtml)
    }

    if (extractedJobs.length === 0) {
      throw new Error('The verified Setu careers page did not expose any public jobs')
    }

    const limitedJobs = Number.isInteger(maxJobs) && maxJobs > 0 ? extractedJobs.slice(0, maxJobs) : extractedJobs
    const baseJobs = limitedJobs.map((job) => ({
      title: job.title,
      company: COMPANY_NAME,
      department: job.department,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: null,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      ...(limitedJobs.length < extractedJobs.length ? { sourceListingComplete: false } : {}),
    }))

    const jobs = []
    for (const job of baseJobs) {
      try {
        const detailHtml = await read(job.sourceUrl)
        jobs.push(enrichSetuJobFromDetailPage(job, detailHtml))
      } catch (error) {
        signal?.throwIfAborted()
        if (isUnavailableTurbohireDetailError(error)) {
          jobs.push({
            ...job,
            publicExperienceChecked: true,
          })
          continue
        }

        jobs.push(job)
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createSetuScraper(options).run(options)

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
