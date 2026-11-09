import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'conviva'
export const COMPANY = 'Conviva'
export const CAREERS_URL = 'https://www.conviva.ai/job-listings/'
export const GREENHOUSE_EMBED_URL = 'https://boards.greenhouse.io/embed/job_board/js?for=conviva'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/conviva/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_JOB_URL = 'https://www.conviva.ai/careers/job/'

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

const hasIndiaMarker = (value) => /(?:^|,\s*)India(?:$|[\s,)(-])/i.test(String(value ?? ''))
const isRemoteLocationWithoutIndia = (value) =>
  /^remote(?:\b|[\s,-])/i.test(String(value ?? '')) && !/\bindia\b/i.test(String(value ?? ''))

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeLocationLabel(office?.location))
    .filter(Boolean)

const looksLikeIndiaLocation = (value, officeLocations = []) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return false
  if (isRemoteLocationWithoutIndia(normalized)) return false

  return Boolean(getValidIndiaCityForJob({ location: normalized, locations: officeLocations }))
}

const extractTaggedFieldValue = (decodedHtml, label) => {
  const match = String(decodedHtml ?? '').match(
    new RegExp(`<strong>\\s*${escapeRegExp(label)}\\s*<\\/strong>\\s*:?\\s*([^<\\n]+)`, 'i'),
  )

  return normalizeWhitespace(match?.[1])
}

const extractEmploymentType = (decodedHtml) => {
  const value = extractTaggedFieldValue(decodedHtml, 'Employment Type')
  if (!value) return null

  return normalizeWhitespace(value.split(',')[0])
}

const extractExperienceRequired = (decodedHtml) =>
  normalizeWhitespace(extractTaggedFieldValue(decodedHtml, 'Experience'))

const inferRemoteStatus = ({ location, officeLocations, decodedDescription, employmentTypeDetail }) => {
  const haystack = [
    location,
    ...officeLocations,
    employmentTypeDetail,
    stripTags(decodedDescription),
  ]
    .filter(Boolean)
    .join(' | ')

  if (/\bhybrid\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return 'On-site'
}

const chooseIndiaLocation = (job = {}) => {
  const primaryLocation = normalizeLocationLabel(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value)) || null

  if (isRemoteLocationWithoutIndia(primaryLocation)) {
    return officeIndiaLocation ? 'Remote, India' : null
  }

  if (
    primaryLocation
    && looksLikeIndiaLocation(primaryLocation, officeLocations)
    && (hasIndiaMarker(primaryLocation) || /,/.test(primaryLocation))
  ) {
    return primaryLocation
  }

  if (officeIndiaLocation) return officeIndiaLocation

  if (primaryLocation && looksLikeIndiaLocation(primaryLocation, officeLocations)) {
    return primaryLocation
  }

  return null
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

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const document = readNativeDocument(page)
  if (document.nodes(node => node.tag === 'title').some(node => normalizeWhitespace(node.raw) === 'Careers | Conviva')
    && document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === 'https://www.conviva.ai/careers').length === 1
    && document.nodes(node => node.tag === 'h1').some(node => document.text(node) === 'We work with the best')
    && document.nodes(node => node.tag === 'section' && node.attrs.id === 'openings').length === 1
    && document.nodes(node => node.tag === 'div' && node.attrs.id === 'grnhse_app').length === 1
    && extractGreenhouseEmbedUrl(page) === GREENHOUSE_EMBED_URL) return true

  return /<title>\s*Careers\s*&amp;\s*Job Listings\s*[-–—]\s*Join the Conviva Team\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.conviva\.ai\/job-listings\/["']/i.test(page)
    && /<h1[^>]*>\s*Choose Innovation\s*<\/h1>/i.test(page)
    && /<div[^>]+class=["'][^"']*job-openings[^"']*["'][^>]*>/i.test(page)
    && /<div id=["']openings["']><\/div>/i.test(page)
    && /<div id=["']app["']><\/div>/i.test(page)
}

export const extractGreenhouseEmbedUrl = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*boards\.greenhouse\.io\/embed\/job_board\/js\?for=[^"']+)["'][^>]*><\/script>/i,
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
    const ghJid = normalizeWhitespace(url.searchParams.get('gh_jid'))

    if (url.protocol === 'https:' && !url.username && !url.password
      && ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(normalizedHost)
      && normalizedPathname === `/conviva/jobs/${canonicalJobId}`) {
      return `https://job-boards.greenhouse.io/conviva/jobs/${canonicalJobId}`
    }

    if (normalizedHost !== 'conviva.ai') return null
    if (normalizedPathname !== `/careers/job/${canonicalJobId}`) return null
    if (ghJid !== canonicalJobId) return null

    const canonicalUrl = new URL(`${FIRST_PARTY_JOB_URL}${canonicalJobId}`)
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
    throw new Error('Conviva Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => {
      const officeLocations = extractOfficeLocations(job)
      const location = chooseIndiaLocation(job)
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const decodedDescription = decodeRepeatedHtmlEntities(job?.content)
      const employmentTypeDetail = extractTaggedFieldValue(decodedDescription, 'Employment Type')
      const employmentType = extractEmploymentType(decodedDescription)
      const experienceRequired = extractExperienceRequired(decodedDescription)
      const remoteStatus = inferRemoteStatus({
        location,
        officeLocations,
        decodedDescription,
        employmentTypeDetail,
      })

      if (companyName && companyName.toLowerCase() !== COMPANY.toLowerCase()) {
        throw new Error('Conviva Greenhouse jobs API no longer maps to the verified company identity')
      }

      if (!location || !sourceUrl || !title) {
        throw new Error('Conviva Greenhouse job payload no longer exposes the verified first-party gh_jid job handoff')
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

export const createConvivaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Conviva careers page no longer matches the verified official Conviva careers surface')
    }

    if (extractGreenhouseEmbedUrl(careersHtml) !== GREENHOUSE_EMBED_URL) {
      throw new Error('Conviva careers page no longer exposes the verified Greenhouse embed')
    }

    const jobs = extractIndiaJobsFromGreenhousePayload(
      await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' }),
      { scrapedAt: now() },
    )

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createConvivaScraper(options).run(options)

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
