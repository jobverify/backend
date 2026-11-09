import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KASEYA_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KASEYA_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const GREENHOUSE_EMBED_URL = 'https://boards.greenhouse.io/embed/job_board/js?for=kaseya'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/kaseya/jobs'

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-CH-UA': '"Not.A/Brand";v="99", "Google Chrome";v="138", "Chromium";v="138"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
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

const normalizeLocationLabel = (value) => normalizeWhitespace(value)

const canonicalizeIndiaLocation = (value) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return null

  if (/^(?:india\s*-\s*remote|remote\s*-\s*india)$/i.test(normalized)) {
    return 'Remote, India'
  }

  return normalized
}

const isRemoteLocationWithoutIndia = (value) =>
  /^remote(?:\b|[\s,-])/i.test(String(value ?? '')) && !/\bindia\b/i.test(String(value ?? ''))

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => canonicalizeIndiaLocation(office?.location || office?.name))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = canonicalizeIndiaLocation(value)
  if (!normalized) return false
  if (isRemoteLocationWithoutIndia(normalized)) return false
  if (/\bindia\b/i.test(normalized)) return true

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = canonicalizeIndiaLocation(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value, officeLocations)) || null

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  return officeIndiaLocation
}

const deriveCity = (location, officeLocations = []) => {
  if (/\bremote\b/i.test(String(location ?? ''))) {
    return 'Remote'
  }

  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = canonicalizeIndiaLocation(location)
    ?.split(',')[0]
    ?.replace(/^IN\s+/i, '')
    ?.trim()

  return normalizeCity(firstToken || location)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [
    location,
    ...officeLocations,
    stripTags(decodedDescription),
  ]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Kaseya \| Open Positions(?: &amp;| &) Job Opportunities\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/www\.kaseya\.com\/careers\/jobs\/"\s*\/?>/i.test(page)
}

export const hasVerifiedGreenhouseBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /href=["']\/careers\/jobs\/id\/\d+\/\?gh_jid=\d+["']/i.test(page)
    && /href=["']https:\/\/my\.greenhouse\.io\/users\/sign_in\?job_board=kaseya(?:&amp;|&)source=job_alert_board["']/i.test(page)
}

export const extractGreenhouseEmbedUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*boards\.greenhouse\.io\/embed\/job_board\/js\?for=[^"']+)["'][^>]*>/i,
  )

  if (!match) return null

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/careers/jobs/id/${canonicalJobId}`
    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (normalizedHost !== COMPANY_DOMAIN) return null
    if (normalizedPathname !== expectedPathname) return null
    if (ghJid && ghJid !== canonicalJobId) return null

    const canonicalUrl = new URL(`https://www.${COMPANY_DOMAIN}/careers/jobs/id/${canonicalJobId}/`)
    canonicalUrl.searchParams.set('gh_jid', canonicalJobId)
    return canonicalUrl.toString()
  } catch {
    return null
  }
}

const matchesVerifiedCompanyIdentity = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return true

  return normalized === OFFICIAL_BRAND_NAME.toLowerCase()
    || normalized === `${OFFICIAL_BRAND_NAME.toLowerCase()} careers`
}

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Kaseya India Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

      if (!matchesVerifiedCompanyIdentity(companyName)) {
        throw new Error('Kaseya India Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Kaseya India Greenhouse jobs payload no longer exposes the verified first-party Kaseya job detail URLs')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        jobId: normalizeWhitespace(job?.id),
        requisitionId: normalizeWhitespace(job?.requisition_id),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: extractMetadataValue(job, 'Employment Type'),
        experienceRequired: extractMetadataValue(job, 'Experience'),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        closingDate: null,
        jobDescription: decodedDescription || null,
        remoteStatus,
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: REQUEST_HEADERS,
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': REQUEST_HEADERS['User-Agent'],
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const createKaseyaIndiaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Kaseya India verified first-party careers page no longer matches the trusted public surface')
    }

    if (!hasVerifiedGreenhouseBoardSignal(careersHtml)) {
      throw new Error('Kaseya India careers page no longer exposes the verified first-party Greenhouse board handoff')
    }

    return extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )
  },
})

export const run = async (options = {}) => createKaseyaIndiaScraper().run(options)

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
