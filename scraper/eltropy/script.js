import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { ELTROPY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ELTROPY_CATALOG.source
export const COMPANY = ELTROPY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ELTROPY_CATALOG.officialBrandName
export const VERIFIED_ON = ELTROPY_CATALOG.verifiedOn
export const HOMEPAGE_URL = ELTROPY_CATALOG.officialHomepageUrl
export const CAREERS_URL = ELTROPY_CATALOG.officialCareersLandingUrl
export const GREENHOUSE_BOARD_URL = ELTROPY_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = ELTROPY_CATALOG.greenhouseJobsApiUrl
export const PROVIDER_METADATA = ELTROPY_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
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

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeLocationLabel(office?.location))
    .filter(Boolean)

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return false

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeLocationLabel(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value)) || null

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return officeIndiaLocation || primaryLocation
  }

  return officeIndiaLocation
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeLocationLabel(location)?.split(',')[0]?.trim()
  return normalizeCity(firstToken || location)
}

const inferRemoteStatus = ({
  primaryLocation,
  location,
  officeLocations,
  decodedDescription,
  employmentType,
}) => {
  const haystack = [
    primaryLocation,
    location,
    ...officeLocations,
    employmentType,
    stripTags(decodedDescription),
  ]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

const matchesVerifiedCompanyName = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return true

  return /^eltropy(?:\s+inc\.?)?$/i.test(normalized)
}

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || null

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Join a team of People with Purpose\s*<\/title>/i.test(page)
    && /Career Opportunities/i.test(page)
    && /Let['\u2019]s Build from Here/i.test(page)
    && /Explore our open roles for working totally remotely, from the office, or somewhere in between\./i.test(page)
}

export const hasBlockedFirstPartySurfaceSignal = (html = '', { server } = {}) => {
  const page = String(html ?? '')

  const olderChallenge = extractTitle(page) === 'Just a moment...'
    && /\.spinner\s*\{/i.test(page)
    && /border-top:\s*4px solid #3498db/i.test(page)
  const currentCloudflareForbidden = String(server ?? '').toLowerCase() === 'cloudflare'
    && page.trim() === '<html>\n<head>\n<title>Error 403 Forbidden</title>\n</head>\n<body>\n<h1>403 Forbidden</h1>\n</body>\n</html>'

  return olderChallenge || currentCloudflareForbidden
}

export const extractGreenhouseBoardUrl = (html) => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/job-boards\.greenhouse\.io\/eltropyinc\/?)["']/i,
  )

  return match?.[1]?.replace(/\/$/, '') || null
}

export const extractBambooCareersUrl = (html) => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/eltropy\.bamboohr\.com\/careers\/?)["']/i,
  )

  return match?.[1]?.replace(/\/$/, '') || null
}

export const hasOfficialGreenhouseBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return extractTitle(page) === 'Jobs at Eltropy Inc.'
    && /Current Openings/i.test(page)
    && /https:\/\/job-boards\.greenhouse\.io\/eltropyinc\/jobs\/\d+/i.test(page)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/eltropyinc/jobs/${canonicalJobId}`

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Eltropy Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const primaryLocation = normalizeLocationLabel(job?.location?.name)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const employmentType = extractMetadataValue(job, 'Employment Type')
      const experienceRequired = extractMetadataValue(job, 'Experience')
      const remoteStatus = inferRemoteStatus({
        primaryLocation,
        location,
        officeLocations,
        decodedDescription,
        employmentType,
      })

      if (!matchesVerifiedCompanyName(job?.company_name)) {
        throw new Error('Eltropy Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Eltropy Greenhouse payload no longer exposes the verified public Greenhouse job detail URLs')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        employmentType,
        experienceRequired,
        jobDescription: decodedDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(job?.updated_at || job?.first_published),
        remoteStatus,
        scrapedAt,
      }
    })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

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
    server: response.headers.get('server'),
  }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEltropyScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const pageFetcher = fetchPage || (
      fetchText === defaultFetchText
        ? defaultFetchPage
        : async (url) => ({
            status: 200,
            url,
            html: await fetchText(url),
          })
    )

    const homepage = await pageFetcher(HOMEPAGE_URL)
    const careersPage = await pageFetcher(CAREERS_URL)
    const hasReadableFirstPartyCareers =
      homepage.status === 200
      && careersPage.status === 200
      && hasOfficialCareersSignal(careersPage.html)
      && extractGreenhouseBoardUrl(careersPage.html) === GREENHOUSE_BOARD_URL
    const hasBlockedFirstPartySurface =
      homepage.status === 403
      && careersPage.status === 403
      && homepage.url === HOMEPAGE_URL
      && careersPage.url === CAREERS_URL
      && hasBlockedFirstPartySurfaceSignal(homepage.html, { server: homepage.server })
      && hasBlockedFirstPartySurfaceSignal(careersPage.html, { server: careersPage.server })

    if (!hasReadableFirstPartyCareers && !hasBlockedFirstPartySurface) {
      throw new Error('Eltropy verified official careers surface no longer matches the first-party contract')
    }

    const greenhouseBoardPage = await pageFetcher(GREENHOUSE_BOARD_URL)
    if (greenhouseBoardPage.status !== 200 || !hasOfficialGreenhouseBoardSignal(greenhouseBoardPage.html)) {
      throw new Error('Eltropy verified public Greenhouse board no longer matches the trusted jobs surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createEltropyScraper(options).run(options)

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
