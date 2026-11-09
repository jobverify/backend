import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FALABELLA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FALABELLA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_ENTRY_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_HOME_URL = PROVIDER_METADATA.officialCareersHomeUrl
export const VERIFIED_BUNDLE_URL = PROVIDER_METADATA.verifiedBundleUrl
export const PUBLIC_JOBS_API_URL = PROVIDER_METADATA.publicJobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\r/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const htmlToText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/?(?:p|div|section|article|li|ul|ol|h[1-6]|strong|em|span)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(decodeHtmlEntities(value))
  return normalized || null
}

const normalizeUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    return `${parsed.origin}${pathname}${parsed.search}`
  } catch {
    return String(value ?? '').replace(/\/+$/, '')
  }
}

const buildAbsoluteUrl = (value, baseUrl = CAREERS_HOME_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const uniqueValues = (values = []) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const normalized = normalizeOptionalValue(value)
    const key = normalized?.toLowerCase()
    if (!normalized || seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

const splitTextLines = (value) => htmlToText(value)
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line.replace(/^[\s•*-]+/, '')))
  .filter(Boolean)

const buildLocation = (record = {}) => uniqueValues([
  record.city,
  record.state,
  record.country,
]).join(', ') || null

const buildEmploymentType = (record = {}) => uniqueValues([
  record.jobtype,
  record.contracttype,
]).join(' | ') || null

const buildMinimumQualification = (record = {}) => {
  const lines = splitTextLines(record.education)
  return lines.length > 0 ? lines.join(' ') : null
}

const buildJobDescription = (record = {}) => {
  const description = normalizeOptionalValue(htmlToText(record.description))
  const requirements = splitTextLines(record.requirements)
  const process = normalizeOptionalValue(htmlToText(record.process))
  const parts = [
    description,
    requirements.length > 0 ? `Requirements: ${requirements.join('; ')}` : null,
    process ? `Process: ${process}` : null,
  ].filter(Boolean)

  return parts.join(' ') || null
}

const normalizePostingDate = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString()
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Falabella scraper')
  }

  return parsed.toISOString()
}

export const extractBundleUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<script\b[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return buildAbsoluteUrl(match?.[1], CAREERS_HOME_URL)
}

export const hasVerifiedCareersEntrySignal = (page = {}) => {
  const html = String(page?.html ?? '')
  return Number(page?.status) === 200
    && normalizeUrl(getFinalUrl(page, CAREERS_ENTRY_URL)) === normalizeUrl(CAREERS_HOME_URL)
    && /<title[^>]*>\s*Trabaja en Falabella\s*[–-]\s*Empleos en el Grupo Falabella\s*[–-]\s*Muévete\s*<\/title>/i.test(html)
}

export const hasVerifiedCareersShellSignal = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)
  const bundleUrl = extractBundleUrl(html)

  return Number(page?.status) === 200
    && normalizeUrl(getFinalUrl(page, CAREERS_HOME_URL)) === normalizeUrl(CAREERS_HOME_URL)
    && /<title[^>]*>\s*Trabaja en Falabella\s*[–-]\s*Empleos en el Grupo Falabella\s*[–-]\s*Muévete\s*<\/title>/i.test(html)
    && normalized.includes('Vive el Desafío Falabella')
    && bundleUrl?.includes('/assets/index-')
}

export const buildOffersApiUrl = (urlBff, publicType) =>
  urlBff && publicType
    ? `${String(urlBff).replace(/\/+$/, '')}/bff-sgdt-job-offer/api/ofertalaboral/type/${publicType}`
    : null

export const buildOfferDetailApiUrl = (urlBff, publicType, offerId) =>
  urlBff && publicType && offerId
    ? `${String(urlBff).replace(/\/+$/, '')}/bff-sgdt-job-offer/api/ofertalaboral/${publicType}/${encodeURIComponent(String(offerId))}`
    : null

export const extractPublicApiConfig = (bundleJs = '') => {
  const rawBundle = String(bundleJs ?? '')
  const token = rawBundle.match(/this\.token\s*=\s*["']([^"']+)["']/)?.[1] ?? null
  const urlBff = rawBundle.match(/this\.url_bff\s*=\s*["']([^"']+)["']/)?.[1] ?? null
  const publicTypes = [...rawBundle.matchAll(/new\s+[A-Za-z_$][\w$]*\(["']([^"']+)["']\)/g)]
    .map((match) => match[1])
  const publicType = publicTypes.find((value) => /^external$/i.test(value)) ?? null
  const sampleOfferInfoUrl =
    rawBundle.match(/https:\/\/falabella\.airavirtual\.com\/offer_info\/[^"'`\s]+/)?.[0] ?? null
  const hasListEndpoint =
    rawBundle.includes('/bff-sgdt-job-offer/api/ofertalaboral/type/${this.type}')
  const hasDetailEndpoint =
    /\/bff-sgdt-job-offer\/api\/ofertalaboral\/\$\{this\.type\}\/\$\{[a-z]\}/.test(rawBundle)

  if (!token || !urlBff || !publicType || !hasListEndpoint || !hasDetailEndpoint) {
    return null
  }

  return {
    token,
    urlBff,
    publicType,
    publicJobsApiUrl: buildOffersApiUrl(urlBff, publicType),
    sampleOfferInfoUrl,
  }
}

export const isValidPublicApplyUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    return parsed.hostname.toLowerCase() === 'falabella.airavirtual.com'
      && /^\/(?:postula|offer_info)\/[a-z0-9]+/i.test(parsed.pathname)
  } catch {
    return false
  }
}

const hasOfferRecordShape = (record = {}) =>
  record
  && typeof record === 'object'
  && normalizeOptionalValue(record.offer_id)
  && normalizeOptionalValue(record.title)
  && isValidPublicApplyUrl(record.url)
  && normalizeOptionalValue(record.company || record.requisition_company)
  && normalizeOptionalValue(record.country)
  && normalizeOptionalValue(record.type) === 'falabella_jobs'
  && normalizePostingDate(record.date)

export const hasOfferRecordsShape = (payload = []) =>
  Array.isArray(payload)
  && payload.length > 0
  && payload.every((record) => hasOfferRecordShape(record))

export const mapOffer = (record = {}) => {
  const sourceUrl = normalizeUrl(record.url)
  const applyUrl = normalizeUrl(record.url)

  return {
    title: normalizeOptionalValue(record.title),
    company: normalizeOptionalValue(record.requisition_company || record.company) || COMPANY_NAME,
    department: normalizeOptionalValue(record.area),
    location: buildLocation(record),
    city: normalizeOptionalValue(record.city),
    state: normalizeOptionalValue(record.state),
    country: normalizeOptionalValue(record.country) || PROVIDER_METADATA.countryFilter,
    jobId: String(record.offer_id ?? ''),
    requisitionId: normalizeOptionalValue(record.referencenumber) || String(record.offer_id ?? ''),
    sourceUrl,
    applyUrl,
    employmentType: buildEmploymentType(record),
    experienceRequired: null,
    minimumQualification: buildMinimumQualification(record),
    preferredQualification: null,
    requiredSkills: splitTextLines(record.requirements),
    postingDate: normalizePostingDate(record.date),
    closingDate: null,
    jobDescription: buildJobDescription(record),
  }
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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/javascript,application/javascript,text/plain;q=0.9,*/*;q=0.8',
  },
  label: 'falabella bundle',
  timeoutMs: 30000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    ...(options.headers || {}),
  },
  label: 'falabella jobs api',
  timeoutMs: 90000,
})

export const createFalabellaScraper = ({
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const fetchPage = options.fetchPage || defaultFetchPage
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson

    const careersEntryPage = await fetchPage(CAREERS_ENTRY_URL)
    if (!hasVerifiedCareersEntrySignal(careersEntryPage)) {
      throw new Error('Falabella verified careers entry no longer matches the public redirect surface')
    }

    const careersHomePage = await fetchPage(CAREERS_HOME_URL)
    if (!hasVerifiedCareersShellSignal(careersHomePage)) {
      throw new Error('Falabella verified careers shell no longer matches the public surface')
    }

    const bundleUrl = extractBundleUrl(careersHomePage.html)
    if (!bundleUrl) {
      throw new Error('Falabella verified careers shell no longer exposes the public bundle')
    }

    const bundleJs = await fetchText(bundleUrl)
    const apiConfig = extractPublicApiConfig(bundleJs)
    if (!apiConfig || apiConfig.publicJobsApiUrl !== PUBLIC_JOBS_API_URL) {
      throw new Error('Falabella verified public bundle contract no longer matches the careers API surface')
    }

    const offersPayload = await fetchJson(apiConfig.publicJobsApiUrl, {
      headers: {
        authorization: apiConfig.token,
      },
    })

    if (!hasOfferRecordsShape(offersPayload)) {
      throw new Error('Falabella verified jobs api no longer matches the public surface')
    }

    const scrapedAt = normalizeScrapedAt((options.now || now)())
    return offersPayload.map((record) => {
      const job = mapOffer(record)
      return {
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      }
    })
  },
})

export const run = async (options = {}) => createFalabellaScraper().run(options)

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
