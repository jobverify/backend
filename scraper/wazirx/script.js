import path from 'node:path'
import { parseJobsDeclaration } from '../../scraper-support/utils/remoteScriptData.js'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wazirx'
export const COMPANY = 'WazirX'
export const CAREERS_URL = 'https://careers.wazirx.com/'
export const JOBS_SCRIPT_URL = new URL('js/jobs.js', CAREERS_URL).toString()

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html)

  return /<title[^>]*>\s*WazirX Careers(?:\s*[—-]\s*Trade Your Future)?\s*<\/title>/i.test(page)
    && /WazirX is Hiring/i.test(page)
    && /Order Book/i.test(page)
    && /Open Roles/i.test(page)
    && /Apply via Email/i.test(page)
    && /careers@wazirx\.com/i.test(page)
}

export const extractJobsScriptUrl = (html = '') => {
  const scriptPath = String(html).match(/<script[^>]+src=["']([^"']*js\/jobs\.js[^"']*)["']/i)?.[1]
  if (!scriptPath) return null

  try {
    return new URL(scriptPath, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const toHostStringArray = (items) => Array.from(items || [], (item) => normalizeWhitespace(item)).filter(Boolean)

const extractExperienceRequirement = (requirements = []) => {
  for (const requirement of requirements) {
    const normalized = normalizeWhitespace(requirement)
    if (/\b\d+\+?\s*(?:-|–|to)?\s*\d*\+?\s*years?\b/i.test(normalized || '')) {
      return normalized
    }
  }

  return null
}

export const extractJobsFromJobsScript = (scriptText = '') => {
  const script = String(scriptText ?? '')
  if (!/const\s+JOB_DATA\s*=\s*\{/i.test(script)) return []

  let jobData
  try {
    jobData = parseJobsDeclaration(script)
  } catch (error) {
    throw new Error('verified WazirX careers requisition blocks no longer match the known public page', { cause: error })
  }
  if (!jobData || typeof jobData !== 'object') return []

  return Object.entries(jobData).flatMap(([jobId, job]) => {
    const title = normalizeWhitespace(job?.title)
    const department = normalizeWhitespace(job?.dept)
    const location = normalizeWhitespace(job?.location)
    const employmentType = normalizeWhitespace(job?.type)
    const code = normalizeWhitespace(job?.code)
    const codeMatch = code?.match(/^(.+?)\s*·\s*(REQ-\d{3})$/)
    const requisitionId = codeMatch?.[2] || (/^REQ-\d{3}$/i.test(jobId) ? jobId : null)
    const teamCode = codeMatch?.[1] || null

    if (!title || !department || !location || !employmentType || !requisitionId || !teamCode) {
      return []
    }

    return [{
      title,
      jobId: requisitionId,
      requisitionId,
      teamCode,
      department,
      location,
      employmentType,
      overview: normalizeWhitespace(job?.overview),
      responsibilities: Array.isArray(job?.responsibilities) ? toHostStringArray(job.responsibilities) : [],
      requirements: Array.isArray(job?.requirements) ? toHostStringArray(job.requirements) : [],
      niceToHave: Array.isArray(job?.niceToHave) ? toHostStringArray(job.niceToHave) : [],
    }]
  })
}

const inferRemoteStatus = (location) => (/remote/i.test(location) ? 'Remote' : 'On-site')

const normalizeLocationCity = (location) => {
  if (/remote/i.test(location)) return 'Remote'
  return normalizeCity(location) || location
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    Accept: 'text/html,application/xhtml+xml',
    'User-Agent': USER_AGENT,
  },
  label: 'wazirx-careers-page',
  timeoutMs: 20000,
})

export const createWazirXScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('verified WazirX careers surface no longer matches the known public page')
    }

    const jobsScriptUrl = extractJobsScriptUrl(careersHtml)
    if (!jobsScriptUrl) {
      throw new Error('verified WazirX careers surface no longer exposes the first-party jobs script')
    }

    const jobs = extractJobsFromJobsScript(await fetchText(jobsScriptUrl))
    if (jobs.length === 0) {
      throw new Error('verified WazirX careers requisition blocks no longer match the known public page')
    }

    const scrapedAt = now()

    return jobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      location: job.location,
      city: normalizeLocationCity(job.location),
      country: 'India',
      link: CAREERS_URL,
      applyUrl: CAREERS_URL,
      sourceUrl: CAREERS_URL,
      source: SOURCE,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      department: job.department,
      employmentType: job.employmentType,
      experienceRequired: extractExperienceRequirement(job.requirements),
      jobDescription: job.overview,
      minimumQualification: job.requirements.join('\n') || null,
      preferredQualification: job.niceToHave.join('\n') || null,
      requiredSkills: job.responsibilities,
      postingDate: null,
      remoteStatus: inferRemoteStatus(job.location),
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createWazirXScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
