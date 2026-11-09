import { createNativeRouteScraper, NATIVE_ROUTE_PROFILES } from '../../scraper-support/native-sources/declaredGreenhouseRoutes/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { LYFT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = LYFT_CATALOG.source
export const COMPANY = LYFT_CATALOG.companyName
export const CAREERS_URL = LYFT_CATALOG.companyCareerPage
export const GREENHOUSE_JOBS_API_URL = LYFT_CATALOG.greenhouseJobsApiUrl
export const PROVIDER_METADATA = LYFT_CATALOG

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

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

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

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/(?:^|,\s*)India(?:$|[\s,)(-])/i.test(normalized)) return true

  return Boolean(getValidIndiaCityForJob({
    location: normalized,
    locations: officeLocations,
  }))
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeWhitespace(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  return officeLocations.find((location) => looksLikeIndiaLocation(location, officeLocations)) || null
}

const deriveCity = (location, officeLocations = []) => {
  const scopedCity = getValidIndiaCityForJob({
    location,
    locations: officeLocations,
  })
  if (scopedCity) return scopedCity

  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return normalizeCity(firstToken)
}

const inferRemoteStatus = ({ location, officeLocations, decodedDescription }) => {
  const haystack = [location, ...officeLocations, decodedDescription]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  return 'On-site'
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasVerifiedCareersShellSignal = (html) => {
  const page = String(html ?? '')
  const title = extractTitle(page) || ''

  return title === 'Lyft Careers'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.lyft\.com\/careers["']/i.test(page)
    && /WORKING AT LYFT/i.test(page)
    && /Search job openings/i.test(page)
    && /See open jobs/i.test(page)
    && /"searchType":"Careers"/i.test(page)
    && /"referenceId":"openings"/i.test(page)
}

export const normalizeCareerPuckJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(String(value ?? ''))
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (hostname !== 'app.careerpuck.com') return null
    if (pathname !== `/job-board/lyft/job/${canonicalJobId}`) return null

    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))
    if (ghJid !== canonicalJobId) return null

    return `https://app.careerpuck.com/job-board/lyft/job/${canonicalJobId}?gh_jid=${canonicalJobId}`
  } catch {
    return null
  }
}

const assertVerifiedGreenhousePayload = (payload) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Lyft Greenhouse jobs API response no longer matches the expected payload')
  }

  for (const job of jobs) {
    const companyName = normalizeWhitespace(job?.company_name)
    const title = normalizeWhitespace(job?.title)
    const canonicalJobUrl = normalizeCareerPuckJobUrl(job?.absolute_url, job?.id)

    if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
      throw new Error('Lyft Greenhouse payload no longer matches the verified company identity')
    }

    if (!title || !canonicalJobUrl) {
      throw new Error('Lyft Greenhouse payload no longer matches the verified CareerPuck detail URL contract')
    }
  }

  return jobs
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = assertVerifiedGreenhousePayload(payload)

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeCareerPuckJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
      })

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
        employmentType: null,
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

export const createLyftScraper = (options = {}) => createNativeRouteScraper(NATIVE_ROUTE_PROFILES.lyft, options)

export const run = async (options = {}) => createLyftScraper(options).run(options)

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
