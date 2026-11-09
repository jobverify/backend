import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'newrocket'
export const COMPANY = 'NewRocket'
export const HOMEPAGE_URL = 'https://www.newrocket.com/'
export const CAREERS_URL = 'https://www.newrocket.com/careers'
export const APPLY_NOW_URL = 'https://www.newrocket.com/apply-now'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/highmetric/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeLocationLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()
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

  return current
    .replace(/\u00a0/g, ' ')
    .trim()
}

const looksLikeIndiaLocation = (value) => {
  const normalized = normalizeLocationLabel(value)
  if (!normalized) return false

  if (/^remote(?:\b|[\s,-])/i.test(normalized) && !/\bindia\b/i.test(normalized)) {
    return false
  }

  return Boolean(getValidIndiaCityForJob({ location: normalized }))
}

const extractOfficeLocations = (job = {}) =>
  (Array.isArray(job?.offices) ? job.offices : [])
    .map((office) => normalizeLocationLabel(office?.location))
    .filter(Boolean)

const inferRemoteStatus = (...values) => {
  const normalized = values
    .flat()
    .map((value) => normalizeLocationLabel(value))
    .filter(Boolean)
    .join(' | ')

  if (!normalized) return 'On-site'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  if (/remote/i.test(normalized)) return 'Remote'
  return 'On-site'
}

const chooseIndiaLocation = (job = {}) => {
  const rawLocation = normalizeLocationLabel(job?.location?.name)
  const officeLocations = extractOfficeLocations(job)
  const officeIndiaLocation = officeLocations.find((value) => looksLikeIndiaLocation(value)) || null
  const remoteStatus = inferRemoteStatus(rawLocation, officeLocations)

  if (remoteStatus === 'Remote') {
    if (looksLikeIndiaLocation(rawLocation)) return rawLocation
    if (officeIndiaLocation) return 'Remote, India'
  }

  if (remoteStatus === 'Hybrid' && looksLikeIndiaLocation(rawLocation)) {
    return rawLocation
  }

  if (officeIndiaLocation) return officeIndiaLocation
  if (looksLikeIndiaLocation(rawLocation)) return rawLocation

  return null
}

const deriveCity = (location, remoteStatus) => {
  const normalized = normalizeLocationLabel(location)
  if (!normalized) return null
  if (remoteStatus === 'Remote') return 'Remote'

  const firstSegment = normalized.split(',')[0]?.trim()
  return normalizeCity(firstSegment || normalized)
}

const deriveCountry = (location) => (looksLikeIndiaLocation(location) ? 'India' : null)

const isIndiaJob = (job = {}) => {
  const candidateLocations = [
    normalizeLocationLabel(job?.location?.name),
    ...extractOfficeLocations(job),
  ].filter(Boolean)

  return candidateLocations.some((value) => looksLikeIndiaLocation(value))
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /NewRocket\s*\|\s*(?:Anthropic and )?ServiceNow Partner\s*\|\s*(?:AI workflows that customers trust|Go Beyond Workflows)/i.test(page)
    && /Trusted AI/i.test(page)
    && /Go Beyond Workflows/i.test(page)
}

export const hasHomepageCareersLink = (html) =>
  /href=["'][^"']*(?:https?:\/\/www\.newrocket\.com)?\/careers(?:[/"'#?][^"']*)?["']/i.test(
    String(html ?? ''),
  )

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /A Destination for Talent/i.test(page)
    && /Careers at newrocket/i.test(page)
    && /People Matter\. Employees Matter\. You Matter\./i.test(page)
}

export const hasCareersApplyNowLink = (html) =>
  /href=["'][^"']*(?:https?:\/\/www\.newrocket\.com)?\/apply-now(?:[/"'#?][^"']*)?["']/i.test(
    String(html ?? ''),
  )

export const hasOfficialApplyNowSignal = (html) => {
  const page = String(html ?? '')

  return /APPLY AT NEWROCKET/i.test(page)
    && /A Destination for Talent/i.test(page)
    && /OPEN ROLES/i.test(page)
}

export const hasGreenhouseJobsFeedSignal = (html) =>
  String(html ?? '').includes(buildGreenhouseJobsApiUrl())

export const hasGreenhouseJobDetailHandoff = (html) =>
  String(html ?? '').includes('https://www.newrocket.com/careers/job?gh_jid=')

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  let canonicalId = normalizeWhitespace(jobId)

  if (!canonicalId) {
    try {
      canonicalId = normalizeWhitespace(new URL(value).searchParams.get('gh_jid'))
    } catch {
      canonicalId = null
    }
  }

  if (!canonicalId) return null

  const url = new URL('/careers/job', HOMEPAGE_URL)
  url.searchParams.set('gh_jid', canonicalId)
  return url.toString()
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => isIndiaJob(job))
    .map((job) => {
      const location = chooseIndiaLocation(job)
      const remoteStatus = inferRemoteStatus(job?.location?.name, extractOfficeLocations(job))
      const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)
      const title = normalizeWhitespace(job?.title)

      if (!location || !sourceUrl || !title) return null

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location, remoteStatus),
        country: deriveCountry(location) || 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        employmentType: null,
        experienceRequired: null,
        jobDescription: decodeRepeatedHtmlEntities(job?.content),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at),
        remoteStatus,
        scrapedAt,
      }
    })
    .filter(Boolean)

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
    Referer: APPLY_NOW_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNewRocketScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('NewRocket homepage no longer matches the verified official site')
    }

    if (!hasHomepageCareersLink(homepageHtml)) {
      throw new Error('NewRocket homepage no longer links to the verified official careers page')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NewRocket careers page no longer matches the verified official careers surface')
    }

    if (!hasCareersApplyNowLink(careersHtml)) {
      throw new Error('NewRocket careers page no longer links to the verified apply-now jobs surface')
    }

    if (!hasGreenhouseJobsFeedSignal(careersHtml)) {
      throw new Error('NewRocket careers page no longer exposes the verified public Greenhouse jobs API')
    }

    if (!hasGreenhouseJobDetailHandoff(careersHtml)) {
      throw new Error('NewRocket careers page no longer exposes the verified gh_jid job detail handoff')
    }

    const applyNowHtml = await fetchText(APPLY_NOW_URL)
    if (!hasOfficialApplyNowSignal(applyNowHtml)) {
      throw new Error('NewRocket apply-now page no longer matches the verified official jobs surface')
    }

    if (!hasGreenhouseJobsFeedSignal(applyNowHtml)) {
      throw new Error('NewRocket apply-now page no longer exposes the verified public Greenhouse jobs API')
    }

    if (!hasGreenhouseJobDetailHandoff(applyNowHtml)) {
      throw new Error('NewRocket apply-now page no longer exposes the verified gh_jid job detail handoff')
    }

    const payload = await fetchJson(buildGreenhouseJobsApiUrl(), { method: 'GET' })
    const jobs = extractIndiaJobsFromGreenhousePayload(payload)

    return Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createNewRocketScraper(options).run(options)

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
