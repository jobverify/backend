import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { HEADOUT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HEADOUT_CATALOG.source
export const COMPANY = HEADOUT_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = HEADOUT_CATALOG.officialBrandName
export const CAREERS_URL = HEADOUT_CATALOG.companyCareerPage
export const GREENHOUSE_BOARD_SLUGS = HEADOUT_CATALOG.greenhouseBoardSlugs
export const VERIFIED_ON = HEADOUT_CATALOG.verifiedOn
export const PROVIDER_METADATA = HEADOUT_CATALOG

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
    .map((office) => normalizeWhitespace(office?.location || office?.name))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false

  if (/(?:^|[\s,(;])India(?:$|[\s),;-])/i.test(normalized)) return true

  return Boolean(
    getValidIndiaCityForJob({
      location: normalized,
      locations: officeLocations,
    }),
  )
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value, officeLocations))

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  if (officeIndiaLocation) return officeIndiaLocation

  return null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })

  if (scopedCity) return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /\bremote\b/i.test(firstToken) || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({
  location,
  officeLocations,
  workplaceType,
  decodedDescription,
}) => {
  if (workplaceType) {
    if (/hybrid/i.test(workplaceType)) return 'Hybrid'
    if (/remote/i.test(workplaceType)) return 'Remote'
    if (/on-site|onsite/i.test(workplaceType)) return 'On-site'
  }

  const haystack = [location, ...officeLocations, stripTags(decodedDescription)]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = (boardSlug) =>
  `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Headout/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.headout\.com\/careers\/["']/i.test(page)
    && /Search open positions/i.test(page)
    && /All locations/i.test(page)
    && /All teams/i.test(page)
}

const isVerifiedLoaderAssetUrl = (value) => {
  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPath = url.pathname.replace(/\/+$/, '')

    return (
      (
        normalizedHost === 'headout.com'
        && normalizedPath.startsWith('/brand-pages/_next/static/chunks/')
      )
      || (
        normalizedHost === 'assets.headout.com'
        && normalizedPath.startsWith('/hobrandpages/_next/static/chunks/')
      )
    )
      && normalizedPath.endsWith('.js')
  } catch {
    return false
  }
}

export const extractCandidateLoaderScriptUrls = (html) => {
  const page = String(html ?? '')
  const matches = Array.from(
    page.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi),
  )

  return Array.from(
    new Set(
      matches
        .map((match) => match[1])
        .map((href) => {
          try {
            return new URL(href, CAREERS_URL).toString()
          } catch {
            return null
          }
        })
        .filter((url) => isVerifiedLoaderAssetUrl(url)),
    ),
  )
}

export const hasVerifiedOpenRolesLoaderSignal = (scriptText = '') => {
  const normalized = String(scriptText ?? '')

  return normalized.includes('boards-api.greenhouse.io')
    && normalized.includes('headoutcareers')
    && normalized.includes('headoutreferrals')
    && normalized.includes('render_as')
}

const normalizeGreenhouseJobUrl = (value, boardSlug, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/${boardSlug}/jobs/${canonicalJobId}`

    if (!['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(normalizedHost)) return null
    if (normalizedPathname !== expectedPathname) return null

    return `https://boards.greenhouse.io${expectedPathname}`
  } catch {
    return null
  }
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    boardSlug,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Headout Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, boardSlug, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const employmentType = extractMetadataValue(job, 'Employment Type')
      const workplaceType = extractMetadataValue(job, 'Workplace Type')
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        workplaceType,
        decodedDescription,
      })

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('Headout Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Headout Greenhouse payload no longer exposes the verified public job detail URLs')
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
        jobDescription: decodedDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
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
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHeadoutScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Headout careers page no longer matches the verified first-party surface')
    }

    const candidateLoaderUrls = extractCandidateLoaderScriptUrls(careersHtml)
    let verifiedLoaderFound = false

    for (const loaderUrl of candidateLoaderUrls) {
      const loaderText = await fetchText(loaderUrl)
      if (hasVerifiedOpenRolesLoaderSignal(loaderText)) {
        verifiedLoaderFound = true
        break
      }
    }

    if (!verifiedLoaderFound) {
      throw new Error('Headout open-roles loader no longer matches the verified Greenhouse contract')
    }

    const jobs = []

    for (const boardSlug of GREENHOUSE_BOARD_SLUGS) {
      const boardJobs = extractIndiaJobsFromGreenhousePayload(
        await fetchJson(buildGreenhouseJobsApiUrl(boardSlug), { method: 'GET' }),
        {
          boardSlug,
          scrapedAt: now(),
        },
      )
      jobs.push(...boardJobs)
    }

    const dedupedJobs = Array.from(
      new Map(jobs.map((job) => [job.sourceUrl, job])).values(),
    )

    return Number.isFinite(maxJobs) ? dedupedJobs.slice(0, maxJobs) : dedupedJobs
  },
})

export const run = async (options = {}) => createHeadoutScraper(options).run(options)

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
