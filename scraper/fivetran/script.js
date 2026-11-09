import path from 'node:path'
import { fileURLToPath } from 'node:url'

import FIVETRAN_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FIVETRAN_CATALOG
export const SOURCE = FIVETRAN_CATALOG.source
export const COMPANY = FIVETRAN_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = FIVETRAN_CATALOG.officialBrandName
export const VERIFIED_ON = FIVETRAN_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FIVETRAN_CATALOG.verifiedSurfaceSummary
export const CAREERS_URL = FIVETRAN_CATALOG.officialCareersLandingUrl
export const GREENHOUSE_ALERT_URL = FIVETRAN_CATALOG.greenhouseAlertUrl
export const GREENHOUSE_BOARD_SLUG = FIVETRAN_CATALOG.greenhouseBoardSlug
export const GREENHOUSE_BOARD_URL = FIVETRAN_CATALOG.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = FIVETRAN_CATALOG.greenhouseJobsApiUrl

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

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return null
  }
}

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10)
}

const extractExperienceRequired = (description) => {
  const normalizedDescription = normalizeWhitespace(description)
  if (!normalizedDescription) return null

  const rangeMatch = normalizedDescription.match(/\b(\d+\s*-\s*\d+\s*years?)\s+of\s+experience\b/i)
  if (rangeMatch) return normalizeWhitespace(rangeMatch[1])?.toLowerCase()

  const plusMatch = normalizedDescription.match(/\b(\d+\+\s*years?)\b/i)
  if (plusMatch) return normalizeWhitespace(plusMatch[1])?.toLowerCase()

  return null
}

const inferCountry = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return null

  if (/remote\s*-\s*/i.test(normalizedLocation)) {
    return normalizeWhitespace(normalizedLocation.split(/\s*-\s*/).at(-1))
  }

  const segments = normalizedLocation.split(/\s*[•|]\s*/).map((segment) => normalizeWhitespace(segment)).filter(Boolean)
  const lastSegment = segments.at(-1) || normalizedLocation
  const tokens = lastSegment.split(',').map((token) => normalizeWhitespace(token)).filter(Boolean)
  return tokens.at(-1) || null
}

const deriveCity = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return null
  if (/remote\s*-\s*/i.test(normalizedLocation)) return normalizedLocation

  const primarySegment = normalizedLocation.split(/\s*[•|]\s*/)[0]
  return normalizeWhitespace(primarySegment.split(',')[0])
}

const inferRemoteStatus = ({ location, description }) => {
  const haystack = [location, description].filter(Boolean).join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack) || /#LI-Remote/i.test(haystack)) return 'Remote'
  return 'On-site'
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const uniqueValues = (values) => [...new Set(values.filter(Boolean))]

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

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      Referer: CAREERS_URL,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const buildGreenhouseBoardUrl = (slug = GREENHOUSE_BOARD_SLUG) =>
  `https://job-boards.greenhouse.io/${slug}`

export const buildGreenhouseJobsApiUrl = (slug = GREENHOUSE_BOARD_SLUG) =>
  `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Experience ownership, impact, and recognition at Fivetran \| Careers at Fivetran\s*<\/title>/i.test(page)
    && /Together, we power the data revolution/i.test(page)
    && /Create job alert/i.test(page)
    && /https:\/\/my\.greenhouse\.io\/users\/sign_in\?job_board=[^"'&\s<>]+/i.test(page)
    && /Bengaluru \| India/i.test(page)
    && /Sydney \| Australia/i.test(page)
    && /@fivetran\.com/i.test(page)
}

export const extractGreenhouseBoardSlug = (html) => {
  const match = String(html ?? '').match(
    /https:\/\/my\.greenhouse\.io\/users\/sign_in\?job_board=([^"'&\s<>]+)/i,
  )
  return normalizeWhitespace(match?.[1])
}

export const isVerifiedGreenhouseBoardRedirect = (page = {}) =>
  Number(page.status) === 200
  && normalizeUrl(page.url) === normalizeUrl(CAREERS_URL)
  && hasOfficialCareersSignal(page.html)

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (normalizedHost === 'fivetran.com') {
      if (normalizedPathname !== '/careers/job') return null
      if (ghJid !== canonicalJobId) return null

      const canonicalUrl = new URL('https://www.fivetran.com/careers/job')
      canonicalUrl.searchParams.set('gh_jid', canonicalJobId)
      return canonicalUrl.toString()
    }

    if (!['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(normalizedHost)) return null
    if (normalizedPathname !== `/fivetran/jobs/${canonicalJobId}`) return null

    const canonicalUrl = new URL('https://www.fivetran.com/careers/job')
    canonicalUrl.searchParams.set('gh_jid', canonicalJobId)
    return canonicalUrl.toString()
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
    throw new Error('Fivetran Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs.map((job) => {
    const title = normalizeWhitespace(job?.title)
    const location = normalizeWhitespace(job?.location?.name)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
    const companyName = normalizeWhitespace(job?.company_name)
    const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
    const jobDescription = stripTags(decodedDescription)

    if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
      throw new Error('Fivetran Greenhouse jobs API no longer maps to the verified company identity')
    }

    if (!title || !location || !sourceUrl) {
      throw new Error('Fivetran Greenhouse payload no longer exposes the verified public Greenhouse detail URLs')
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
      postingDate: normalizeDate(job?.updated_at || job?.first_published),
      jobDescription,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: uniqueValues(extractListItems(decodedDescription)),
      remoteStatus: inferRemoteStatus({
        location,
        description: jobDescription,
      }),
      scrapedAt,
    }
  })
}

export const createFivetranScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Fivetran verified Fivetran careers page no longer matches the official first-party surface')
    }

    const greenhouseBoardSlug = extractGreenhouseBoardSlug(careersPage.html)
    if (greenhouseBoardSlug !== GREENHOUSE_BOARD_SLUG) {
      throw new Error('Fivetran verified Greenhouse board slug no longer matches the official first-party careers page handoff')
    }

    const greenhouseBoardPage = await fetchPage(buildGreenhouseBoardUrl(greenhouseBoardSlug))
    if (!isVerifiedGreenhouseBoardRedirect(greenhouseBoardPage)) {
      throw new Error('Fivetran verified Greenhouse board redirect no longer resolves to the official first-party careers page')
    }

    const jobs = extractJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(greenhouseBoardSlug), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createFivetranScraper(options).run(options)

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
