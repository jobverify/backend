import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { JUMIO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = JUMIO_CATALOG.source
export const COMPANY = JUMIO_CATALOG.companyName
export const CAREERS_URL = JUMIO_CATALOG.companyCareerPage
export const JOBS_API_URL = JUMIO_CATALOG.jobsApiUrl
export const GREENHOUSE_BOARD_URL = JUMIO_CATALOG.greenhouseBoardUrl
export const PROVIDER_METADATA = JUMIO_CATALOG

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

const normalizeArray = (value) =>
  (Array.isArray(value) ? value : [value])
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)

const extractVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<section\b[^>]*>/gi, '\n')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const isUnavailableGreenhouseDetailPage = (html = '') => {
  const visibleText = extractVisibleText(html)?.toLowerCase() || ''

  return visibleText.includes('current openings at jumio')
    && visibleText.includes('create a job alert')
    && !visibleText.includes('apply for this job')
}

const extractGreenhouseDetailDescription = (html = '') => {
  if (isUnavailableGreenhouseDetailPage(html)) {
    return null
  }

  const visibleText = extractVisibleText(html)
  if (!visibleText) return null

  const beforeApply = visibleText.split(/apply for this job/i)[0]?.trim() || ''
  if (!beforeApply) return null

  return normalizeWhitespace(
    beforeApply
      .replace(/^Back to jobs\s*/i, '')
      .replace(/\bApply\b\s*/i, '')
      .trim(),
  )
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const enrichJumioJobFromDetailPage = (job, detailHtml = '') => {
  const unavailableDetail = isUnavailableGreenhouseDetailPage(detailHtml)
  const jobDescription = extractGreenhouseDetailDescription(detailHtml) || job.jobDescription || null
  const experienceRequired = inferExperienceFromDescription(jobDescription)

  return {
    ...job,
    jobDescription,
    experienceRequired: experienceRequired || job.experienceRequired || null,
    publicExperienceChecked: unavailableDetail || Boolean(jobDescription),
  }
}

const getWorkplaceTypeValue = (job = {}) => {
  const entry = (Array.isArray(job?.metadata) ? job.metadata : []).find(
    (item) => normalizeWhitespace(item?.name)?.toLowerCase() === 'workplace types',
  )

  return normalizeArray(entry?.value)
}

const inferRemoteStatus = (job = {}) => {
  const location = normalizeWhitespace(job?.location?.name)
  if (/\bremote\b/i.test(location || '')) return 'Remote'
  if (/\bhybrid\b/i.test(location || '')) return 'Hybrid'

  const workplaceTypes = getWorkplaceTypeValue(job).map((value) => value.toLowerCase())
  if (workplaceTypes.length === 1) {
    if (workplaceTypes[0] === 'remote') return 'Remote'
    if (workplaceTypes[0] === 'hybrid') return 'Hybrid'
    if (workplaceTypes[0] === 'onsite' || workplaceTypes[0] === 'on-site') return 'On-site'
  }

  if (workplaceTypes.includes('hybrid')) return 'Hybrid'
  if (workplaceTypes.includes('remote')) return 'Remote'
  return 'On-site'
}

export const hasOfficialJobListingsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Open Job Opportunities in the Identity Verification Industry \| Jumio\s*<\/title>/i
    .test(page)
    && /class=["'][^"']*job-listings[^"']*["']/i.test(page)
    && /wrapper-jobs/i.test(page)
    && /Filter by Office/i.test(page)
    && /wp-json\/jobs\//i.test(page)
}

export const extractJobsApiBaseUrl = (html) => {
  const match = String(html ?? '').match(/"rest"\s*:\s*\{\s*"job"\s*:\s*"([^"]+)"/i)
  return match?.[1] ? normalizeWhitespace(match[1]) : null
}

const buildJobsFilterApiUrl = (baseUrl) => `${String(baseUrl ?? '').replace(/\/+$/, '')}/filter`

const collectDepartmentJobs = (node, currentDepartment = null, collected = []) => {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectDepartmentJobs(item, currentDepartment, collected)
    }
    return collected
  }

  if (!node || typeof node !== 'object') return collected

  const nextDepartment = normalizeWhitespace(node?.name) || currentDepartment
  if (Array.isArray(node.jobs)) {
    for (const job of node.jobs) {
      collected.push({ department: nextDepartment, job })
    }
  }

  for (const value of Object.values(node)) {
    collectDepartmentJobs(value, nextDepartment, collected)
  }

  return collected
}

const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPathname = url.pathname.replace(/\/+$/, '')
    const expectedPathname = `/jumio/jobs/${canonicalJobId}`

    if (normalizedHost !== 'job-boards.greenhouse.io') return null
    if (normalizedPathname !== expectedPathname) return null

    return `${GREENHOUSE_BOARD_URL}/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

export const extractJumioIndiaJobsFromPayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const departmentTree = payload?.departments
  if (!departmentTree || typeof departmentTree !== 'object') {
    throw new Error('Jumio first-party jobs payload no longer matches the verified department tree')
  }

  return collectDepartmentJobs(departmentTree)
    .map(({ department, job }) => {
      const location = normalizeWhitespace(job?.location?.name)
      const city = getValidIndiaCityForJob({ location })
      const hasExplicitIndiaMarker = /(?:^|[\s,(])India(?:$|[\s,)(-])/i.test(location || '')

      if (!city || (!hasExplicitIndiaMarker && city === 'Remote')) return null

      const title = normalizeWhitespace(job?.title)
      const link = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)

      if (!title || !location || !link) {
        throw new Error('Jumio first-party jobs payload no longer exposes the verified India Greenhouse detail fields')
      }

      return {
        title,
        company: COMPANY,
        location,
        city,
        country: 'India',
        link,
        applyUrl: `${link}#application`,
        sourceUrl: link,
        source: SOURCE,
        jobId: job?.id ?? null,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department,
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.updated_at || job?.first_published),
        remoteStatus: inferRemoteStatus(job),
        scrapedAt,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJumioScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobListingsHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialJobListingsSignal(jobListingsHtml)) {
      throw new Error('Jumio verified official job listings surface changed materially')
    }

    const jobsApiBaseUrl = extractJobsApiBaseUrl(jobListingsHtml)
    if (buildJobsFilterApiUrl(jobsApiBaseUrl) !== JOBS_API_URL) {
      throw new Error('Jumio verified official job listings surface no longer exposes the expected first-party jobs API')
    }

    const jobs = extractJumioIndiaJobsFromPayload(await fetchJson(JOBS_API_URL), {
      scrapedAt: now(),
    })

    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return Promise.all(selectedJobs.map(async (job) => {
      try {
        return enrichJumioJobFromDetailPage(job, await fetchText(job.sourceUrl))
      } catch {
        return job
      }
    }))
  },
})

export const run = async (options = {}) => createJumioScraper(options).run(options)

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
