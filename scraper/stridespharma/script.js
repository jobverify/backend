import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { STRIDES_PHARMA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = STRIDES_PHARMA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const PORTAL_JOBS_SERVICE_URL = PROVIDER_METADATA.portalJobServiceUrl
export const PORTAL_COMPANY_TOKEN = PROVIDER_METADATA.portalCompanyToken
export const LISTING_KEY = PROVIDER_METADATA.listingKey
export const DETAIL_KEY = PROVIDER_METADATA.detailKey
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntitiesOnce = (value) => String(value ?? '')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&amp;/gi, '&')

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 4; index += 1) {
    const next = decodeHtmlEntitiesOnce(decoded)
    if (next === decoded) break
    decoded = next
  }

  return decoded
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTagValue = (block, tagName) => {
  const match = String(block ?? '').match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))
  return normalizeWhitespace(decodeHtmlEntities(match?.[1] ?? ''))
}

const extractTableBlocks = (xml, tagName) =>
  [...String(xml ?? '').matchAll(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'gi'))]
    .map((match) => match[1])

const normalizeCity = (value) => {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  const unique = parts.filter((part, index) => parts.indexOf(part) === index)
  return unique[0] ?? null
}

const toLocationLabel = (locationCity) => {
  const city = normalizeCity(locationCity)
  return city ? `${city}, India` : 'India'
}

const extractMinimumQualificationFromDescription = (descriptionHtml) =>
  decodeHtmlEntities(String(descriptionHtml ?? ''))
    .match(/\bQualification:\s*([^<\n]+)/i)?.[1]?.trim() ?? null

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page)

  return /<title>\s*Careers\s*\|\s*Join the Strides Team\s*<\/title>/i.test(page)
    && normalized?.includes('Join Us and Grow with Strides')
    && /href=["']https:\/\/portal\.arcolab\.com\/careerportal\/["']/i.test(page)
    && normalized?.includes('View current openings')
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = stripTags(page)

  return (
    /<title>\s*Career Portal\s*<\/title>/i.test(page)
    && normalized?.includes('Build your future with Us')
    && /Welcome to the Careers Centre for strides\s*\./i.test(normalized || '')
    && /Strides Pharma Science Limited\b/i.test(page)
    && /company\s*:\s*"Strides"/i.test(page)
    && (/ServiceHandler\.svc/i.test(page) || /js\/Communicator\.js/i.test(page))
  )
  // The portal script references Communicator.js, which in turn pins ServiceHandler.svc.
}

export const extractPortalServiceUrl = (
  html = '',
  portalUrl = OFFICIAL_CAREERS_HANDOFF_URL,
) => {
  const page = String(html ?? '')
  if (!/js\/Communicator\.js/i.test(page)) return null

  return new URL('ServiceHandler.svc/GenericMethod', portalUrl).toString()
}

const buildXmlTag = (key, value) => `<${key}>${String(value ?? '')}</${key}>`

export const buildServiceRequestBody = ({ key, params = {} } = {}) => {
  const paramXml = Object.entries(params)
    .map(([paramKey, paramValue]) => buildXmlTag(paramKey, paramValue))
    .join('')
  const xml = `<data><ctrl><kv>${key}</kv><bh>V</bh></ctrl><data><param>${paramXml}</param></data></data>`

  return JSON.stringify({ Inputparams: xml })
}

export const buildApplyUrl = (jobId) =>
  new URL(`main.aspx?loc=${encodeURIComponent(jobId)}&type=direct`, OFFICIAL_CAREERS_HANDOFF_URL).toString()

export const extractListings = (xml = '') =>
  extractTableBlocks(xml, 'Table6')
    .map((block) => ({
      jobId: extractTagValue(block, 'JobId'),
      title: extractTagValue(block, 'title'),
      designation: extractTagValue(block, 'designation'),
      department: extractTagValue(block, 'department'),
      experience: extractTagValue(block, 'experience'),
      employmentType: extractTagValue(block, 'employee_type'),
      totalPositions: extractTagValue(block, 'total_positions'),
      locationCity: extractTagValue(block, 'location_city'),
      companyToken: extractTagValue(block, 'company'),
    }))
    .filter((job) => normalizeWhitespace(job.companyToken) === PORTAL_COMPANY_TOKEN)
    .map((job) => ({
      ...job,
      locationLabel: toLocationLabel(job.locationCity),
    }))
    .filter((job) => job.jobId && job.title)

export const extractJobDetail = (xml = '') => {
  const block = extractTableBlocks(xml, 'Table')[0]
  if (!block) return null

  const descriptionHtml = extractTagValue(block, 'description')
  const jobDescription = stripTags(descriptionHtml)

  return {
    jobId: extractTagValue(block, 'JobId'),
    officialCompanyName: extractTagValue(block, 'company'),
    title: extractTagValue(block, 'title'),
    designation: extractTagValue(block, 'designation'),
    department: extractTagValue(block, 'department'),
    employmentType: extractTagValue(block, 'employee_type') || extractTagValue(block, 'employee_type1'),
    experience: extractTagValue(block, 'experience'),
    locationCity: extractTagValue(block, 'location_city'),
    minimumQualification: extractMinimumQualificationFromDescription(descriptionHtml),
    jobDescription,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'stridespharma-html',
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers ?? {}),
  },
  label: 'stridespharma-json',
  timeoutMs: 15000,
})

const mapJob = (listing, detail) => {
  const city = normalizeCity(detail?.locationCity ?? listing.locationCity)

  return {
    title: detail?.title ?? listing.title,
    company: COMPANY_NAME,
    department: detail?.department ?? listing.department,
    location: toLocationLabel(detail?.locationCity ?? listing.locationCity),
    city,
    country: 'India',
    jobId: listing.jobId,
    requisitionId: listing.jobId,
    sourceUrl: OFFICIAL_CAREERS_HANDOFF_URL,
    applyUrl: buildApplyUrl(listing.jobId),
    employmentType: detail?.employmentType ?? listing.employmentType,
    experienceRequired: detail?.experience ?? listing.experience,
    minimumQualification: detail?.minimumQualification ?? null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: detail?.jobDescription ?? null,
  }
}

export const createStridesPharmaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText: rawFetchText = defaultFetchText,
    fetchJson: rawFetchJson = defaultFetchJson,
    signal,
    now = () => new Date().toISOString(),
  } = {}) {
    const fetchText = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const value = await rawFetchText(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const fetchJson = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const value = await rawFetchJson(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Strides Pharma verified first-party careers page changed materially')
    }

    const portalHtml = await fetchText(OFFICIAL_CAREERS_HANDOFF_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Strides Pharma verified career portal changed materially')
    }

    const serviceUrl = extractPortalServiceUrl(portalHtml, OFFICIAL_CAREERS_HANDOFF_URL)
    if (serviceUrl !== PORTAL_JOBS_SERVICE_URL) {
      throw new Error('Strides Pharma verified career portal service URL changed materially')
    }

    const listingResponse = await fetchJson(PORTAL_JOBS_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: buildServiceRequestBody({
        key: LISTING_KEY,
        params: {
          company: PORTAL_COMPANY_TOKEN,
        },
      }),
    })

    const listings = extractListings(listingResponse?.d?.Returnvalues)
    if (listings.length === 0) {
      throw new Error('Strides Pharma verified portal service returned no current Strides jobs')
    }

    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = await Promise.all(selectedListings.map(async (listing) => {
      const detailResponse = await fetchJson(PORTAL_JOBS_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: buildServiceRequestBody({
          key: DETAIL_KEY,
          params: {
            JobId: listing.jobId,
          },
        }),
      })

      const detail = extractJobDetail(detailResponse?.d?.Returnvalues)
      const mappedJob = mapJob(listing, detail)

      return {
        ...mappedJob,
        source: SOURCE,
        link: mappedJob.applyUrl || mappedJob.sourceUrl,
        scrapedAt: now(),
      }
    }))

    return jobs
  },
})

export const run = async (options = {}) => createStridesPharmaScraper(options).run(options)

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
