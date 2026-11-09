import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { HARNESS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HARNESS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const JOBS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[â€™â€˜\u2018\u2019]/g, "'")
    .replace(/[â€œâ€\u201c\u201d]/g, '"')
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

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location))
    .filter(Boolean)

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)

  if (primaryLocation && getValidIndiaCityForJob({ location: primaryLocation, locations: officeLocations })) {
    return primaryLocation
  }

  return officeLocations.find(
    (location) => getValidIndiaCityForJob({ location, locations: officeLocations }),
  ) || null
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
  return 'On-site'
}

const hasValidGreenhouseJob = (job) => {
  if (!job || typeof job !== 'object') return false

  const locationName = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)

  return typeof job.title === 'string'
    && job.title.trim().length > 0
    && (typeof job.id === 'string' || Number.isFinite(job.id))
    && typeof job.absolute_url === 'string'
    && job.absolute_url.trim().length > 0
    && typeof job.company_name === 'string'
    && job.company_name.trim().length > 0
    && Boolean(locationName || officeLocations.length)
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  if (
    /<title>\s*Careers at Harness: Open Positions &amp; Job Opportunities\s*<\/title>/i.test(page)
    && /\bhiring\b/i.test(page)
    && /career opportunity at Harness/i.test(page)
    && /View More Positions/i.test(page)
    && /cms\.harness\.io\/js\/greenhouse\.js/i.test(page)
  ) return true

  return /<title>\s*Careers at Harness: Open Positions &amp; Job Opportunities\s*<\/title>/i.test(page)
    && normalized.includes('weâ€™re hiring!')
    && normalized.includes('career opportunity at harness')
    && normalized.includes('view more positions')
    && /cms\.harness\.io\/js\/greenhouse\.js/i.test(page)
}

const hasInternalJobsHandoff = (html) => [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .some((match) => {
    try {
      return new URL(match[1], CAREERS_URL).href === JOBS_URL && /View Open Positions/i.test(stripTags(match[2]) || '')
    } catch { return false }
  })

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  if (
    /<title>[^<]*Careers at Harness[^<]*Join the AI-Native DevOps Team[^<]*<\/title>/i.test(page)
    && normalized.includes('careers at harness')
    && normalized.includes('life at harness')
    && (extractGreenhouseBoardUrl(page) === GREENHOUSE_BOARD_URL || hasInternalJobsHandoff(page))
  ) return true

  return /<title>\s*Careers at Harness(?:\s*(?:—|â€”|-)\s*Join the AI-Native DevOps Team)?\s*<\/title>/i.test(page)
    && normalized.includes('careers at harness')
    && normalized.includes('life at harness')
    && extractGreenhouseBoardUrl(page) === GREENHOUSE_BOARD_URL
}

export const extractGreenhouseBoardUrl = (html) => {
  const match = String(html ?? '').match(/https:\/\/boards\.greenhouse\.io\/harnessinc/i)
  return match?.[0] || null
}

export const normalizeHarnessApplyUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const ghJid = url.searchParams.get('gh_jid')

    if (normalizedHost !== 'harness.io' && normalizedHost !== 'www.harness.io') return null
    if (normalizedPathname !== '/company/jobs/apply') return null
    if (ghJid !== String(canonicalJobId)) return null

    return `https://www.harness.io/company/jobs/apply?gh_jid=${encodeURIComponent(String(canonicalJobId))}`
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
  if (!jobs || !jobs.every(hasValidGreenhouseJob)) {
    throw new Error('Harness Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeHarnessApplyUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const employmentType = extractMetadataValue(job, 'Employment Type')
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Harness Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Harness Greenhouse payload no longer exposes the verified first-party apply URL contract')
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
        experienceRequired: null,
        jobDescription: stripTags(decodedDescription) || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        closingDate: null,
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

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: JOBS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHarnessScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('Harness verified Harness jobs page no longer matches the official first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Harness official careers page no longer exposes the verified Greenhouse board')
    }

    if (!extractGreenhouseBoardUrl(careersHtml)) {
      const integrationScript = await fetchText('https://cms.harness.io/js/greenhouse.js')
      if (!String(integrationScript).includes(buildGreenhouseJobsApiUrl())) {
        throw new Error('Harness public Greenhouse integration no longer confirms the verified jobs API')
      }
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    ).map((job) => ({
      ...job,
      companyCareerPage: JOBS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createHarnessScraper(options).run(options)

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
