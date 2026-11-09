import path from 'node:path'
import { fileURLToPath } from 'node:url'

import GROUPON_CATALOG from './catalog.js'
import {createNativeGrouponScraper} from './nativeRun.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GROUPON_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.officialCareersLandingUrl
export const BOARD_URL = PROVIDER_METADATA.officialJobsBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const GREENHOUSE_JOB_BASE_URL = PROVIDER_METADATA.greenhouseJobBaseUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizeVisibleText = (value) => stripTags(value)?.toLowerCase() || ''

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const isoPrefixMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefixMatch) {
    return isoPrefixMatch[1]
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

const normalizeLocationLabel = (value) => normalizeWhitespace(value)

const deriveCity = (location) => {
  // An untyped legacy location label does not publish a separate city field.
  return null
}

const inferCountry = (location) => {
  const normalized = normalizeLocationLabel(location)
  if (!normalized) return null
  if (/\b(?:worldwide|global|anywhere|multiple locations)\b/i.test(normalized)) return null
  const countries=normalized.split(';').map(value=>value.trim().match(/(?:^|,\s*|\s+-\s+)(India|United States)$/i)?.[1]?.toLowerCase())
  if(countries.some(value=>!value)||new Set(countries).size!==1)return null
  return countries[0]==='india'?'India':'United States'
}

const extractExperienceRequired = (description) => {
  const normalizedDescription = normalizeWhitespace(description)
  if (!normalizedDescription) return null

  const plusMatch = normalizedDescription.match(/\b(\d+\+\s*years?)\b/i)
  if (plusMatch) {
    return normalizeWhitespace(plusMatch[1])?.toLowerCase() || null
  }

  const rangeMatch = normalizedDescription.match(/\b(\d+\s*-\s*\d+\s*years?)\b/i)
  if (rangeMatch) {
    return normalizeWhitespace(rangeMatch[1])?.toLowerCase() || null
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const extractOfficialBoardUrl = (html = '') => {
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (normalizeVisibleText(match[2]) === 'apply now and join the groupon team!') {
      return toAbsoluteUrl(match[1], CAREERS_URL)
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return hasCurrentCareersSignal(page)
    || (/<title>\s*Why Groupon\s*<\/title>/i.test(page)
    && text.includes('our mission')
    && text.includes('our teams')
    && text.includes('bangalore and chennai')
    && text.includes('apply now and join the groupon team!')
    && extractOfficialBoardUrl(page) === BOARD_URL)
}

export const hasCurrentCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Groupon Careers\s*<\/title>/i.test(page)
    && /<meta\s+name=["']description["']\s+content=["']Join Groupon[^"']*explore open roles[^"']*meet our teams/i.test(page)
    && /<script\s+type=["']module["'][^>]+src=["']\/assets\/index-[A-Za-z0-9_-]+\.js["']/i.test(page)
    && /<div\s+id=["']root["']\s*><\/div>/i.test(page)
}

export const extractVisibleJobUrls = (html = '') => {
  const matches = String(html ?? '').matchAll(
    /https:\/\/job-boards\.eu\.greenhouse\.io\/groupon\/jobs\/(\d+)/gi,
  )

  const urls = []
  const seen = new Set()

  for (const match of matches) {
    const jobId = normalizeWhitespace(match[1])
    if (!jobId) continue

    const normalized = `${GREENHOUSE_JOB_BASE_URL}/${jobId}`
    if (seen.has(normalized)) continue

    seen.add(normalized)
    urls.push(normalized)
  }

  return urls
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(String(value ?? ''))
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/groupon/jobs/${canonicalJobId}`

    if (normalizedHost !== 'job-boards.eu.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_JOB_BASE_URL}/${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Groupon Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs.map((job) => {
    const title = normalizeWhitespace(job?.title)
    const location = normalizeLocationLabel(job?.location?.name)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
    const companyName = normalizeWhitespace(job?.company_name)
    const jobDescription = stripTags(decodeRepeatedHtmlEntities(job?.content))

    if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
      throw new Error('Groupon Greenhouse jobs API no longer maps to the verified company identity')
    }

    if (!title || !sourceUrl) {
      throw new Error('Groupon Greenhouse payload no longer exposes the verified public Greenhouse detail URLs')
    }

    return {
      title,
      company: COMPANY,
      location,
      city: deriveCity(location),
      country: inferCountry(location),
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: job?.id ?? null,
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: extractExperienceRequired(jobDescription),
      postingDate: typeof job?.first_published==='string'&&Number.isFinite(Date.parse(job.first_published))?job.first_published:null,
      closingDate: null,
      jobDescription,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      scrapedAt,
    }
  })
}

export const createGrouponScraper = options => createNativeGrouponScraper(options)
export const run = async (options = {}) => createGrouponScraper(options).run(options)

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
