import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const WORK_WITH_US_URL = 'https://www.teachforindia.org/work-with-us'
export const CAREERS_URL = 'https://teachforindia.my.salesforce-sites.com/careers'
export const CAREERS_API_URL = `${CAREERS_URL}/apexremote`
export const APPLICATION_EMAIL = 'careers@teachforindia.org'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const SOURCE = 'teachforindia'
const COMPANY = 'Teach For India'
const DEFAULT_VIEW_ID = '066xx0000000001'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /,\s*India$/i.test(normalized) ? normalized : `${normalized}, India`
}

const buildDetailUrl = (jobId) => `${CAREERS_URL}/job?id=${encodeURIComponent(jobId)}`

const normalizeListing = (record = {}) => {
  const jobId = normalizeWhitespace(record.Id)
  const title = normalizeWhitespace(record.Job_Description_Frontend_Name__c || record.Name)
  const rawLocation = normalizeWhitespace(record.Location__c)
  const location = normalizeLocation(rawLocation)

  if (!jobId || !title || !location) return null

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(record.Vertical__c || record.Department__c || record.Team__c),
    location,
    city: normalizeWhitespace(rawLocation)?.split(',')[0] || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: buildDetailUrl(jobId),
    applyUrl: APPLICATION_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(
      record.Short_Description__c || record.Job_Description__c || record.Description,
    ),
  }
}

const parseRemoteResults = (payload = {}) => {
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => Array.isArray(entry?.returnValue) ? entry.returnValue : [])
  }
  return Array.isArray(payload?.returnValue) ? payload.returnValue : []
}

const extractLabelValue = (label, html) => normalizeWhitespace(
  extractFirst(
    new RegExp(`<strong>\\s*${label}\\s*:?\\s*<\\/strong>\\s*([^<]+)`, 'i'),
    html,
  ),
)

export const hasOfficialLandingSignal = (html) => {
  const page = String(html ?? '')
  return /VIEW STAFF OPENINGS/i.test(page)
    && /teachforindia\.my\.salesforce-sites\.com\/careers/i.test(page)
}

export const hasCareersSurfaceSignal = (html) => {
  const page = String(html ?? '')
  return /Thank you for showing interest in our Staff roles!/i.test(page)
    && /careers@teachforindia\.org/i.test(page)
    && /CURRENTLY HIRING/i.test(page)
}

export const extractCsrfToken = (html) => normalizeWhitespace(
  extractFirst(/"csrf"\s*:\s*"([^"]+)"/i, html)
    || extractFirst(/csrf['"]?\s*[:=]\s*['"]([^'"]+)['"]/i, html),
)

const extractViewId = (html) => normalizeWhitespace(
  extractFirst(/"vid"\s*:\s*"([^"]+)"/i, html)
    || extractFirst(/vid['"]?\s*[:=]\s*['"]([^'"]+)['"]/i, html),
) || DEFAULT_VIEW_ID

export const buildRemotePayload = (csrfToken, viewId = DEFAULT_VIEW_ID) => ([
  {
    action: 'TfiCareersPage_Controller',
    method: 'getAllJobSearchResult',
    data: [],
    type: 'rpc',
    tid: 1,
    ctx: {
      csrf: csrfToken,
      vid: viewId,
      ns: '',
    },
  },
])

export const extractListingsFromRemote = (payload) =>
  parseRemoteResults(payload)
    .map((record) => normalizeListing(record))
    .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html),
  ) || listing.title || null
  const rawLocation = extractLabelValue('Location', html) || listing.city || listing.location
  const location = normalizeLocation(rawLocation) || listing.location || null
  const description = stripTags(
    extractFirst(/<section[^>]*id=['"]jobDescription['"][^>]*>([\s\S]*?)<\/section>/i, html),
  ) || stripTags(
    extractFirst(/<section[^>]*>([\s\S]*?Apply Now[\s\S]*?)<\/section>/i, html),
  ) || listing.jobDescription || null

  return {
    title,
    company: COMPANY,
    department: extractLabelValue('Vertical', html) || listing.department || null,
    location,
    city: normalizeWhitespace(location)?.split(',')[0] || null,
    country: 'India',
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: extractFirst(/href=['"](mailto:[^'"]+)['"]/i, html) || APPLICATION_URL,
    employmentType: null,
    experienceRequired: extractLabelValue('Experience', html) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultPostJson = (url, body) => fetchJsonWithRetry(url, {
  method: 'POST',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTeachForIndiaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    postJson = defaultPostJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const landingHtml = await fetchText(WORK_WITH_US_URL)
    if (!hasOfficialLandingSignal(landingHtml)) {
      throw new Error('Teach For India official careers landing changed; refusing to assume the public openings handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasCareersSurfaceSignal(careersHtml)) {
      throw new Error('Teach For India public careers surface changed; refusing to assume the Salesforce board contract')
    }

    if (/No open positions found matching your filter criteria/i.test(careersHtml)) {
      return []
    }

    const csrfToken = extractCsrfToken(careersHtml)
    const viewId = extractViewId(careersHtml)

    if (!csrfToken) {
      return []
    }

    const listings = extractListingsFromRemote(
      await postJson(CAREERS_API_URL, buildRemotePayload(csrfToken, viewId)),
    )

    const jobs = []
    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createTeachForIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Teach For India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
