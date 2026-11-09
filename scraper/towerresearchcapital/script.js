import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { TOWER_RESEARCH_CAPITAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = TOWER_RESEARCH_CAPITAL_CATALOG.source
export const COMPANY = TOWER_RESEARCH_CAPITAL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = TOWER_RESEARCH_CAPITAL_CATALOG.officialBrandName
export const CAREERS_URL = TOWER_RESEARCH_CAPITAL_CATALOG.officialCareersLandingUrl
export const ROLES_URL = TOWER_RESEARCH_CAPITAL_CATALOG.companyCareerPage
export const JOB_DETAILS_BASE_URL = TOWER_RESEARCH_CAPITAL_CATALOG.jobDetailsBaseUrl
export const GREENHOUSE_JOBS_API_URL = TOWER_RESEARCH_CAPITAL_CATALOG.greenhouseJobsApiUrl
export const GREENHOUSE_BOARD_EMBED_URL = TOWER_RESEARCH_CAPITAL_CATALOG.greenhouseBoardEmbedUrl
export const PROVIDER_METADATA = TOWER_RESEARCH_CAPITAL_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const GROUPED_LOCATION_LABEL_REGEX = /^(?:\d+\s+locations?|multiple locations|various locations)$/i

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

const extractMetadataValue = (job, fieldName) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (entry) => normalizeWhitespace(entry?.name)?.toLowerCase() === fieldName.toLowerCase(),
  )

  const value = match?.value
  if (Array.isArray(value)) return normalizeWhitespace(value.join(', '))
  return normalizeWhitespace(value)
}

const extractOffices = (job = {}) => (Array.isArray(job?.offices) ? job.offices : [])

const extractOfficeLocations = (job = {}) =>
  extractOffices(job)
    .map((office) => normalizeWhitespace(office?.location))
    .filter(Boolean)

const isGroupedLocationLabel = (value) => GROUPED_LOCATION_LABEL_REGEX.test(normalizeWhitespace(value) || '')

const normalizeLocationKey = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalizeCity(normalized)?.toLowerCase() || normalized.toLowerCase()
}

const findMatchingOffice = (job = {}, primaryLocation) => {
  const normalizedPrimary = normalizeWhitespace(primaryLocation)?.toLowerCase()
  if (!normalizedPrimary) return null

  return extractOffices(job).find((office) => {
    const officeName = normalizeWhitespace(office?.name)?.toLowerCase()
    const officeLocationCity = normalizeWhitespace(office?.location)?.split(',')[0]?.trim().toLowerCase()

    return officeName === normalizedPrimary || officeLocationCity === normalizedPrimary
  }) || null
}

const isDirectIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/(?:^|,\s*)India(?:$|[\s,)(-])/i.test(normalized)) return true

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: [normalized] }))
}

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/(?:^|,\s*)India(?:$|[\s,)(-])/i.test(normalized)) return true

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const isExplicitForeignPrimaryLocation = (job = {}, primaryLocation) => {
  const normalizedPrimary = normalizeWhitespace(primaryLocation)
  if (!normalizedPrimary || isGroupedLocationLabel(normalizedPrimary) || isDirectIndiaLocation(normalizedPrimary)) {
    return false
  }

  const matchingOffice = findMatchingOffice(job, normalizedPrimary)
  if (!matchingOffice) return false

  return !isDirectIndiaLocation(matchingOffice.location || matchingOffice.name)
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => isDirectIndiaLocation(value))
  const countryMetadata = extractMetadataValue(job, 'Country')
  const normalizedCountryMetadata = countryMetadata?.toLowerCase()

  if (isExplicitForeignPrimaryLocation(job, primaryLocation) && normalizedCountryMetadata !== 'india') {
    return null
  }

  if (primaryLocation && isDirectIndiaLocation(primaryLocation)) {
    if (!officeIndiaLocation) return primaryLocation

    const officeIndiaCityKey = normalizeLocationKey(
      normalizeWhitespace(officeIndiaLocation)?.split(',')[0]?.trim(),
    )
    return officeIndiaCityKey === normalizeLocationKey(primaryLocation)
      ? officeIndiaLocation
      : `${primaryLocation}, India`
  }

  if (primaryLocation && !isGroupedLocationLabel(primaryLocation) && officeIndiaLocation) {
    const officeIndiaCityKey = normalizeLocationKey(
      normalizeWhitespace(officeIndiaLocation)?.split(',')[0]?.trim(),
    )
    return officeIndiaCityKey === normalizeLocationKey(primaryLocation)
      ? officeIndiaLocation
      : `${primaryLocation}, India`
  }

  if (
    primaryLocation
    && !isGroupedLocationLabel(primaryLocation)
    && looksLikeIndiaLocation(primaryLocation, officeLocations)
  ) {
    return primaryLocation
  }
  if (officeIndiaLocation) return officeIndiaLocation
  if (normalizedCountryMetadata === 'india') return primaryLocation || 'India'

  return null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity && scopedCity !== 'Remote') return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [location, ...officeLocations, stripTags(decodedDescription)]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersLandingSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Careers - Tower Research Capital\s*<\/title>/i.test(page)
    && text.includes('build your career at tower')
    && text.includes('continuous investment in top trading and engineering talent is our not-so-secret sauce.')
    && text.includes('explore our open roles and move one step closer to reaching your full potential.')
}

export const hasVerifiedRolesPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Roles - Tower Research Capital\s*<\/title>/i.test(page)
    && /Explore open roles across our departments and global offices\./i.test(page)
    && new RegExp(GREENHOUSE_BOARD_EMBED_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const ghJobId = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (normalizedHost !== 'tower-research.com') return null
    if (normalizedPathname !== '/open-positions') return null
    if (ghJobId !== canonicalJobId) return null

    const canonicalUrl = new URL(JOB_DETAILS_BASE_URL)
    canonicalUrl.searchParams.set('gh_jid', canonicalJobId)
    return canonicalUrl.toString()
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
    throw new Error('Tower Research Capital Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Tower Research Capital Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !link || !title) {
        throw new Error('Tower Research Capital Greenhouse payload no longer exposes the verified first-party detail route')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location, officeLocations),
        country: 'India',
        link,
        applyUrl: link,
        sourceUrl: link,
        source: SOURCE,
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        employmentType: null,
        experienceRequired: null,
        jobDescription: stripTags(decodedDescription) || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        remoteStatus,
        scrapedAt,
      }
    })
}

const defaultFetchText = async (url) => {
  const page = await fetchPageWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 20000,
  })

  return page.html
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: ROLES_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTowerResearchCapitalScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersLandingSignal(careersHtml)) {
      throw new Error('Tower Research Capital verified careers landing page no longer matches the official first-party surface')
    }

    const rolesHtml = await fetchText(ROLES_URL)
    if (!hasVerifiedRolesPageSignal(rolesHtml)) {
      throw new Error('Tower Research Capital verified roles page no longer matches the official first-party surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createTowerResearchCapitalScraper(options).run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
