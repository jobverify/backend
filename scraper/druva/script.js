import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { DRUVA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = DRUVA_CATALOG.source
export const COMPANY = DRUVA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = DRUVA_CATALOG.officialBrandName
export const VERIFIED_ON = DRUVA_CATALOG.verifiedOn
export const CAREERS_REDIRECT_URL = DRUVA_CATALOG.careersRedirectUrl
export const CAREERS_URL = DRUVA_CATALOG.companyCareerPage
export const JOB_DETAILS_BASE_URL = DRUVA_CATALOG.jobDetailsBaseUrl
export const GREENHOUSE_JOBS_API_URL = DRUVA_CATALOG.greenhouseJobsApiUrl
export const PROVIDER_METADATA = DRUVA_CATALOG

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

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return normalized

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location))
    .filter(Boolean)

const extractPrimaryDepartment = (job = {}) =>
  normalizeWhitespace(job?.departments?.[0]?.name)

const chooseIndiaLocation = (job = {}) => {
  const location = normalizeWhitespace(job?.location?.name)
  if (location && /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(location)) {
    return location
  }

  return extractOfficeLocations(job).find((value) => /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(value)) || null
}

const deriveDepartment = (job = {}) => {
  const primaryDepartment = extractPrimaryDepartment(job)
  if (!primaryDepartment) return null
  if (/^(hybrid|remote|on-site|onsite)$/i.test(primaryDepartment)) return null
  return primaryDepartment
}

const inferRemoteStatus = (job = {}) => {
  const primaryDepartment = extractPrimaryDepartment(job)
  const haystack = [
    primaryDepartment,
    normalizeWhitespace(job?.location?.name),
    ...extractOfficeLocations(job),
    stripTags(decodeRepeatedHtmlEntities(job?.content)),
  ]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return null
}

const deriveCity = (location) => {
  const primaryToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!primaryToken || /^india$/i.test(primaryToken)) return null
  return normalizeCity(primaryToken)
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers \| Druva\s*<\/title>/i.test(page)
    && /Where Innovation/i.test(page)
    && /See all our open positions/i.test(page)
    && /#job-search-area/i.test(page)
    && /boards-api\.greenhouse\.io\/v1\/boards\/druva\/jobs/i.test(page)
    && /about\/careers\/jobs\/7679725002\?gh_jid=7679725002/i.test(page)
}

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (normalizedHost !== 'druva.com') return null
    if (normalizedPathname !== `/why-druva/explore/careers/jobs/${canonicalJobId}`) return null
    if (ghJid !== canonicalJobId) return null

    return `https://www.druva.com/why-druva/explore/careers/jobs/${canonicalJobId}/?gh_jid=${canonicalJobId}`
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
    throw new Error('Druva Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const location = chooseIndiaLocation(job)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Druva Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!title || !location || !link) {
        throw new Error('Druva Greenhouse payload no longer exposes the verified first-party job detail route')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location),
        country: 'India',
        link,
        applyUrl: link,
        sourceUrl: link,
        source: SOURCE,
        jobId: normalizeWhitespace(job?.id),
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: deriveDepartment(job),
        employmentType: null,
        experienceRequired: null,
        jobDescription: decodedDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(job?.updated_at || job?.first_published),
        remoteStatus: inferRemoteStatus(job),
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
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDruvaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Druva verified Druva careers page no longer matches the official first-party surface')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createDruvaScraper(options).run(options)

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
