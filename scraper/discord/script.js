import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import DISCORD_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const extractCareersScriptUrl = html => {
  const document = readNativeDocument(html)
  const urls = document.nodes(node => node.tag === 'script' && node.attrs.src).flatMap(node => {
    try {
      const url = new URL(node.attrs.src, CAREERS_URL)
      return url.origin === 'https://discord.com' && /^\/webflow-scripts\/careers(?:New2025|\d{6})\.js$/.test(url.pathname)
        && !url.search && !url.hash ? [url.href] : []
    } catch { return [] }
  })
  return new Set(urls).size === 1 ? urls[0] : null
}

export const PROVIDER_METADATA = DISCORD_CATALOG
export const SOURCE = DISCORD_CATALOG.source
export const COMPANY = DISCORD_CATALOG.companyName
export const CAREERS_URL = DISCORD_CATALOG.companyCareerPage
export const JOBS_REDIRECT_URL = DISCORD_CATALOG.officialJobsRedirectUrl
export const JOB_DETAILS_BASE_URL = DISCORD_CATALOG.firstPartyJobDetailsBaseUrl
export const CAREERS_SCRIPT_URL = DISCORD_CATALOG.careersScriptUrl
export const GREENHOUSE_BOARD_IDS = [...DISCORD_CATALOG.greenhouseBoardIds]
export const GREENHOUSE_JOBS_API_BASE_URL = 'https://api.greenhouse.io/v1/boards'
export const DISPLAY_DEPARTMENT_OVERRIDE_ID = 96196709002

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

const toComparableText = (value) => String(value ?? '').toLowerCase()

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeWhitespace(office?.location || office?.name))
    .filter(Boolean)

const extractDepartmentOverride = (job = {}) => {
  const match = (Array.isArray(job?.metadata) ? job.metadata : []).find((entry) => (
    Number(entry?.id) === DISPLAY_DEPARTMENT_OVERRIDE_ID
      || normalizeWhitespace(entry?.name)?.toLowerCase() === 'careers site department'
  ))

  if (!match) return null

  if (Array.isArray(match.value)) {
    return normalizeWhitespace(match.value.join(', '))
  }

  return normalizeWhitespace(match.value)
}

const extractCountryFromOfficeLocations = (officeLocations = []) => {
  for (const location of officeLocations) {
    if (!location) continue
    if (/\bremote\b/i.test(location)) continue

    if (/United States|U\.S\./i.test(location)) return 'United States'
    if (/The Netherlands/i.test(location)) return 'The Netherlands'

    const parts = location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
    const lastPart = parts.at(-1)
    if (lastPart && !/^(?:CA|NY|WA|TX|MA|DC)$/i.test(lastPart)) {
      return lastPart
    }
  }

  return null
}

const inferCountry = (location, officeLocations = []) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return extractCountryFromOfficeLocations(officeLocations)

  if (/United States|U\.S\./i.test(normalizedLocation)) return 'United States'
  if (/The Netherlands/i.test(normalizedLocation)) return 'The Netherlands'

  const officeCountry = extractCountryFromOfficeLocations(officeLocations)
  if (officeCountry) return officeCountry

  if (!normalizedLocation.includes(',')) {
    if (!/\bremote\b/i.test(normalizedLocation) && !/\bor\b/i.test(normalizedLocation)) {
      return normalizedLocation
    }

    return null
  }

  const lastPart = normalizeWhitespace(normalizedLocation.split(',').at(-1))
  if (!lastPart) return null
  if (/United States|U\.S\./i.test(lastPart)) return 'United States'
  if (/The Netherlands/i.test(lastPart)) return 'The Netherlands'
  return lastPart
}

const deriveCity = (location) => {
  const normalizedLocation = normalizeWhitespace(location)
  if (!normalizedLocation) return null
  if (/^(Australia|The Netherlands|Singapore)$/i.test(normalizedLocation)) return null

  const withoutTrailingRemote = normalizedLocation.replace(/\s*\(.*?\)\s*$/g, '').trim()
  const preferredSegment = normalizeWhitespace(withoutTrailingRemote.split(/\s+or\s+/i)[0])
  if (!preferredSegment) return null

  const city = normalizeWhitespace(preferredSegment.split(',')[0])
  if (!city || /^Remote$/i.test(city)) return null
  return city
}

const inferRemoteStatus = ({ location, officeLocations, description }) => {
  const haystack = [location, ...officeLocations, description].filter(Boolean).join(' | ')

  if (/\bhybrid\b/i.test(haystack) || /\b\d+\s+day per week\b/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/\bon[\s-]?site\b/i.test(haystack)) return 'On-site'
  return null
}

const extractExperienceRequired = (description) => {
  const match = normalizeWhitespace(description)?.match(/\b\d+\+?\s*years?\b/i)
  return match ? normalizeWhitespace(match[0])?.toLowerCase() : null
}

const extractBoardIdFromAbsoluteUrl = (absoluteUrl) => {
  try {
    const url = new URL(String(absoluteUrl ?? ''))
    if (url.hostname.replace(/^www\./i, '').toLowerCase() !== 'job-boards.greenhouse.io') return null

    const [, boardId] = url.pathname.split('/')
    return normalizeWhitespace(boardId)?.toLowerCase() || null
  } catch {
    return null
  }
}

export const buildGreenhouseJobsApiUrl = (boardId) =>
  `${GREENHOUSE_JOBS_API_BASE_URL}/${boardId}/jobs?content=true`

export const buildDiscordJobDetailUrl = (jobId) =>
  `${JOB_DETAILS_BASE_URL}${encodeURIComponent(String(jobId ?? '').trim())}`

export const buildGreenhouseApplyUrl = (absoluteUrl) => {
  try {
    const url = new URL(String(absoluteUrl ?? ''))
    url.searchParams.set('gh_src', 'DiscordJobs')
    return url.toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Jobs and Career Opportunities at Discord\s*<\/title>/i.test(page)
    && /Work at Discord/i.test(page)
    && /See All Jobs/i.test(page)
    && Boolean(extractCareersScriptUrl(page))
}

export const hasVerifiedCareersScriptSignal = (scriptContent) => {
  const script = String(scriptContent ?? '')

  return /DISCORD_JOB_BOARDS\s*=\s*\["discord","discordinternational","internationaleor"\]/i.test(script)
    && /https:\/\/api\.greenhouse\.io\/v1\/boards\/\$\{[A-Za-z_][A-Za-z0-9_]*\}\/jobs\?content=true/i.test(script)
    && /setAttribute\(['"]href['"],\s*`\/jobs\/\$\{?[A-Za-z0-9_.]+\}?`\)/i.test(script)
}

export const extractJobsFromGreenhousePayload = (
  payload,
  {
    boardId,
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Discord Greenhouse jobs payload no longer exposes the expected jobs array')
  }

  return jobs.map((job) => {
    const normalizedBoardId = normalizeWhitespace(boardId)?.toLowerCase()
    const absoluteUrlBoardId = extractBoardIdFromAbsoluteUrl(job?.absolute_url)
    const title = normalizeWhitespace(job?.title)
    const jobId = normalizeWhitespace(job?.id)
    const location = normalizeWhitespace(job?.location?.name)
    const officeLocations = extractOfficeLocations(job)
    const department = extractDepartmentOverride(job)
      || normalizeWhitespace(job?.departments?.[0]?.name)
    const description = stripTags(decodeRepeatedHtmlEntities(job?.content))
    const sourceUrl = buildDiscordJobDetailUrl(jobId)
    const applyUrl = buildGreenhouseApplyUrl(job?.absolute_url)

    if (
      !normalizedBoardId
      || !title
      || !jobId
      || !location
      || !applyUrl
      || absoluteUrlBoardId !== normalizedBoardId
    ) {
      throw new Error('Discord Greenhouse jobs payload no longer matches the verified board contract')
    }

    const country = inferCountry(location, officeLocations)

    return {
      title,
      company: COMPANY,
      department,
      location,
      city: deriveCity(location),
      country,
      sourceUrl,
      applyUrl,
      link: applyUrl,
      source: SOURCE,
      boardId: normalizedBoardId,
      jobId,
      requisitionId: normalizeWhitespace(job?.requisition_id),
      employmentType: null,
      experienceRequired: extractExperienceRequired(description),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
      closingDate: normalizeWhitespace(job?.application_deadline),
      remoteStatus: inferRemoteStatus({
        location,
        officeLocations,
        description,
      }),
      jobDescription: description,
      scrapedAt,
    }
  })
}

export const createDiscordScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Discord verified Discord careers page no longer matches the official first-party surface')
    }

    const careersScript = await fetchText(extractCareersScriptUrl(careersHtml))
    if (!hasVerifiedCareersScriptSignal(careersScript)) {
      throw new Error('Discord verified Discord careers script no longer matches the official first-party surface')
    }

    const scrapedAt = now()
    const aggregatedJobs = []

    for (const boardId of GREENHOUSE_BOARD_IDS) {
      const boardJobs = extractJobsFromGreenhousePayload(
        await fetchJson(buildGreenhouseJobsApiUrl(boardId), { method: 'GET' }),
        {
          boardId,
          scrapedAt,
        },
      )

      aggregatedJobs.push(...boardJobs)
    }

    return Number.isFinite(maxJobs) ? aggregatedJobs.slice(0, maxJobs) : aggregatedJobs
  },
})

export const run = async (options = {}) => createDiscordScraper(options).run(options)

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
