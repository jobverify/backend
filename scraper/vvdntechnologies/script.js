import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.vvdntech.com/careers/'
export const CURRENT_OPENINGS_URL = 'https://www.vvdntech.com/careers/new-openings'
export const APPLY_URL = 'https://www.vvdntech.com/careers/application-form?candidate_source=lateral_open_applied'
export const SMARTRECRUITERS_POSTINGS_API_URL = 'https://api.smartrecruiters.com/v1/companies/VVDNTechnologies/postings?limit=100'
export const SOURCE = 'vvdntechnologies'
export const COMPANY = 'VVDN Technologies'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /(?:#\s*)?Careers/i.test(page)
    && /Come Join the Club of Innovation/i.test(page)
    && /Where would you like to begin your journey with VVDN\?/i.test(page)
    && /Current Openings/i.test(normalized)
}

export const extractCurrentOpeningsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Current Openings\s*<\/a>/gi)) {
    try {
      return new URL(match[1], CAREERS_URL).toString()
    } catch {
      continue
    }
  }

  return null
}

const PUBLIC_JOB_LINK_PATTERN =
  /<a[^>]+href=["'][^"']*(?:\/careers\/jobs\/|\/job\/|\/jobs\/|jobs\.smartrecruiters\.com)[^"']*["'][^>]*>\s*[^<]{1,160}\s*<\/a>/i

export const hasZeroJobsApplyOnlySignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /Find Jobs/i.test(page)
    && /Unable to find the job you are looking for\?/i.test(normalized)
    && /Apply here/i.test(page)
    && new RegExp(escapeRegex(APPLY_URL), 'i').test(page)
    && !PUBLIC_JOB_LINK_PATTERN.test(page)
}

export const hasNoSmartRecruitersPostingsSignal = (payload = {}) =>
  Number(payload?.totalFound) === 0
  && Array.isArray(payload?.content)
  && payload.content.length === 0

const buildSmartRecruitersJobUrl = (id) => {
  const jobId = normalizeWhitespace(id)
  return jobId ? `https://jobs.smartrecruiters.com/VVDNTechnologies/${jobId}` : null
}

const isIndiaPosting = (posting = {}) => {
  const country = normalizeWhitespace(posting?.location?.country)
  const locationText = [
    posting?.location?.city,
    posting?.location?.region,
    posting?.location?.country,
  ].map(normalizeWhitespace).filter(Boolean).join(' ')

  return /^in$/i.test(country)
    || /\bIndia\b|\bBangalore\b|\bBengaluru\b|\bHyderabad\b|\bChennai\b|\bManesar\b|\bGurugram\b|\bGurgaon\b|\bNoida\b/i.test(locationText)
}

const buildLocation = (posting = {}) => {
  const city = normalizeWhitespace(posting?.location?.city)
  const region = normalizeWhitespace(posting?.location?.region)
  const parts = [city, region, 'India'].filter(Boolean)
  return parts.length ? parts.join(', ') : 'India'
}

export const extractIndiaJobsFromSmartRecruitersPayload = (
  payload = {},
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const postings = Array.isArray(payload?.content) ? payload.content : null
  if (!postings) {
    throw new Error('VVDN SmartRecruiters postings API response no longer matches the expected payload')
  }

  return postings
    .filter(isIndiaPosting)
    .map((posting) => {
      const title = normalizeWhitespace(posting?.name)
      const jobId = normalizeWhitespace(posting?.id)
      const sourceUrl = buildSmartRecruitersJobUrl(jobId)

      if (!title || !jobId || !sourceUrl) return null

      const location = buildLocation(posting)
      return {
        title,
        company: COMPANY,
        location,
        city: normalizeWhitespace(posting?.location?.city),
        country: 'India',
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId,
        requisitionId: normalizeWhitespace(posting?.refNumber),
        department: normalizeWhitespace(posting?.department?.label),
        employmentType: normalizeWhitespace(posting?.typeOfEmployment?.label),
        experienceRequired: null,
        jobDescription: normalizeWhitespace(posting?.jobAd?.sections?.jobDescription?.text),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(posting?.releasedDate),
        remoteStatus: posting?.location?.remote ? 'Remote' : 'On-site',
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

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CURRENT_OPENINGS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createVvdnTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('VVDN Technologies careers page no longer matches the verified official public surface')
    }

    const currentOpeningsUrl = extractCurrentOpeningsUrl(careersHtml)
    if (currentOpeningsUrl !== CURRENT_OPENINGS_URL) {
      throw new Error('VVDN Technologies careers page no longer links to the verified official current openings surface')
    }

    const currentOpeningsHtml = await fetchText(CURRENT_OPENINGS_URL)
    if (!hasZeroJobsApplyOnlySignal(currentOpeningsHtml)) {
      throw new Error('VVDN Technologies public current openings surface now exposes jobs or changed shape')
    }

    const payload = await fetchJson(SMARTRECRUITERS_POSTINGS_API_URL, { method: 'GET' })
    return hasNoSmartRecruitersPostingsSignal(payload)
      ? []
      : extractIndiaJobsFromSmartRecruitersPayload(payload, { scrapedAt: now() })
  },
})

export const run = async (options = {}) => createVvdnTechnologiesScraper().run(options)

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
