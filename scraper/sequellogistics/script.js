import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sequellogistics'
export const COMPANY = 'Sequel Logistics'
export const COMPANY_DOMAIN = 'sequelglobal.com'
export const CAREERS_URL = 'https://www.sequelglobal.com/career.html'
export const LATERAL_HIRING_URL = 'https://www.sequelglobal.com/lateral-staff'
export const FIELD_STAFF_URL = 'https://www.sequelglobal.com/field-staff'
export const FRESHER_URL = 'https://www.sequelglobal.com/fresher'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Encoding': 'identity',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const isSequelGlobalHost = (url) => {
  try {
    return /(?:^|\.)sequelglobal\.com$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

const isCertificateVerificationFailure = (error) => {
  const message = String(error?.message || '')
  const causeMessage = String(error?.cause?.message || '')
  const combined = `${message}\n${causeMessage}`

  return /unable to verify the first certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE|self[- ]signed certificate|certificate/i.test(combined)
}

const fetchTextResponse = async (
  url,
  {
    fetchImpl = fetch,
    timeoutMs = 15000,
    headers = DEFAULT_HEADERS,
  } = {},
) => {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers,
    signal: createTimeoutSignal(timeoutMs),
  })

  return response.text()
}

const insecureFetchText = (
  url,
  {
    timeoutMs = 15000,
    headers = DEFAULT_HEADERS,
    maxRedirects = 5,
  } = {},
) => new Promise((resolve, reject) => {
  if (maxRedirects < 0) {
    reject(new Error(`Too many redirects while fetching ${url}`))
    return
  }

  const request = https.request(url, {
    method: 'GET',
    headers,
    rejectUnauthorized: true,
  }, (response) => {
    const statusCode = Number(response.statusCode || 0)
    const location = response.headers.location

    if (statusCode >= 300 && statusCode < 400 && location) {
      response.resume()
      const redirectedUrl = new URL(location, url).toString()
      resolve(insecureFetchText(redirectedUrl, {
        timeoutMs,
        headers,
        maxRedirects: maxRedirects - 1,
      }))
      return
    }

    let body = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      body += chunk
    })
    response.on('end', () => resolve(body))
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error(`Request timed out after ${timeoutMs}ms`))
  })
  request.on('error', reject)
  request.end()
})

export const defaultFetchText = async (
  url,
  {
    fetchImpl = fetch,
    insecureFetchTextImpl = insecureFetchText,
    timeoutMs = 15000,
  } = {},
) => {
  try {
    return await fetchTextResponse(url, {
      fetchImpl,
      timeoutMs,
    })
  } catch (error) {
    if (!isSequelGlobalHost(url) || !isCertificateVerificationFailure(error)) {
      throw error
    }

    return insecureFetchTextImpl(url, {
      timeoutMs,
      headers: DEFAULT_HEADERS,
    })
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Sequel Global\s*<\/title>/i.test(page)
    && normalized.includes('Careers')
    && normalized.includes('Current Openings')
    && /href=["']field-staff["']/i.test(page)
    && /href=["']lateral-staff["']/i.test(page)
    && /href=["']fresher["']/i.test(page)
  }

export const hasOfficialLateralHiringSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Sequel Global\s*<\/title>/i.test(page)
    && normalized.includes('Be part of a growth journey.')
    && normalized.includes('Lateral Hiring')
    && /class=["'][^"']*\bhiring-box-bg\b/i.test(page)
    && /Published Date:/i.test(page)
    && /Location:/i.test(page)
    && /Apply/i.test(page)
  }

const parsePublishedDate = (value) => {
  const normalized = normalizeText(value)
  const match = normalized?.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const buildJobDescription = ({ title, department, location, postingDate }) => {
  const lines = [title]

  if (department) lines.push(`Department: ${department}`)
  if (location) lines.push(`Location: ${location}`)
  if (postingDate) lines.push(`Published Date: ${postingDate}`)

  return lines.join('\n')
}

export const extractLateralJobs = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?Published Date:\s*([^<]+)<\/td>[\s\S]*?Department:\s*([^<]+)<\/td>[\s\S]*?Location:\s*([^<]+)<\/td>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>\s*Apply\s*<\/a>/gi,
  )) {
    const title = normalizeText(match[1])
    const postingDate = parsePublishedDate(match[2])
    const department = normalizeText(match[3])
    const location = normalizeText(match[4])
    const jobId = slugify(title)

    if (!title || !location || !jobId) continue

    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city: location,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: LATERAL_HIRING_URL,
      applyUrl: LATERAL_HIRING_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: buildJobDescription({
        title,
        department,
        location,
        postingDate: normalizeText(match[2]),
      }),
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

export const createSequelLogisticsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Sequel Logistics verified careers landing page no longer matches the trusted first-party surface')
    }

    const lateralHtml = await fetchText(LATERAL_HIRING_URL)
    if (!hasOfficialLateralHiringSignal(lateralHtml)) {
      throw new Error('Sequel Logistics verified lateral openings page no longer matches the trusted first-party surface')
    }

    const jobs = extractLateralJobs(lateralHtml)
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        source: SOURCE,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-site',
        publicExperienceChecked: true,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))

    if (jobs.length === 0) {
      throw new Error('Sequel Logistics verified lateral openings page no longer exposes public job cards')
    }

    return jobs
  },
})

export const run = async (options = {}) => createSequelLogisticsScraper().run(options)

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
