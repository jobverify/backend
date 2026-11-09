import PROVIDER_METADATA from './catalog.js'
export { PROVIDER_METADATA }
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://prolifics.ai/careers'
export const CAREERS_PORTAL_URL = 'https://prolifics.zohorecruit.in/jobs/Careers'
export const CAREERS_API_URL =
  'https://prolifics.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'
export const COMPANY = 'Prolifics Corporation Private Limited'
export const SOURCE = 'prolificscorporationltd'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const findInputTag = (html, id) => new RegExp(
  `<input\\b(?:(?:"[^"]*"|'[^']*'|[^'">])*)\\bid=["']${id}["'](?:(?:"[^"]*"|'[^']*'|[^'">])*)>`,
  'i',
).exec(String(html ?? ''))?.[0] || null

const hasInputWithId = (html, id) => Boolean(findInputTag(html, id))

const extractInputValue = (html, id) => {
  const tag = findInputTag(html, id)
  const match = tag ? /\bvalue=(["'])([\s\S]*?)\1/i.exec(tag) : null

  return match ? decodeHtmlEntities(match[2]) : null
}

const buildJobSlug = (title) => {
  const normalized = normalizeWhitespace(title)
  if (!normalized) return ''
  return encodeURIComponent(normalized.replace(/\s+/g, '-'))
}

const buildJobUrl = ({ id, title, rawUrl }) => {
  const sourceUrl = normalizeWhitespace(rawUrl)
  if (sourceUrl) return sourceUrl
  return `${CAREERS_PORTAL_URL}/${normalizeWhitespace(id) || ''}/${buildJobSlug(title)}?source=CareerSite`
}

const getLocation = (record = {}) => [record.City, record.State, record.Country]
  .map(normalizeWhitespace)
  .filter(Boolean)
  .join(', ') || null

const isIndiaJob = (record = {}) => /^india$/i.test(normalizeWhitespace(record.Country) || '')

const isPublishedRecord = (record = {}) => record.Publish !== false

const isObviousTestRecord = (record = {}) => {
  const city = normalizeWhitespace(record.City)?.toLowerCase() || ''
  const state = normalizeWhitespace(record.State)?.toLowerCase() || ''
  const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)?.toLowerCase() || ''

  return city === 'test'
    || state === 'test'
    || (/\btest jo\b/.test(title) && (city === 'test' || state === 'test' || (!city && !state)))
}

const normalizeRemoteStatus = (record = {}) => {
  if (record.Remote_Job === true) return 'Remote'
  if (record.Remote_Job === false) return 'On-site'
  return null
}

const toRequiredSkills = (value) => {
  if (Array.isArray(value)) return value.map(normalizeWhitespace).filter(Boolean)

  return String(value || '')
    .split(',')
    .map(normalizeWhitespace)
    .filter(Boolean)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  const currentText = normalizeWhitespace(page.replace(/<[^>]+>/g, ' ')) || ''
  if (
    /<title>\s*Prolifics Careers\s*\|\s*Digital Engineering\s*&(?:amp;)?\s*IT Jobs\s*<\/title>/i.test(page)
    && /Discover Who We Are and Why It Matters/i.test(currentText)
    && /PROLIFICS RESOURCES/i.test(currentText)
    && /href=["'][^"']*\/careers\/?["']/i.test(page)
  ) return true

  return /<title>\s*(?:Careers\s*(?:-|–|—|&ndash;|&mdash;|&#8211;|&#8212;)\s*Prolifics US|Prolifics Careers\s*\|\s*Digital Engineering\s*&(?:amp;)?\s*IT Jobs)\s*<\/title>/i.test(page)
    && /site\s*:\s*["']https:\/\/prolifics\.zohorecruit\.in["']/i.test(page)
    && /empty_job_msg\s*:\s*["']No current Openings["']/i.test(page)
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')
  const decodedPage = decodeHtmlEntities(page)

  return /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/prolifics\.zohorecruit\.in\/jobs\/Careers["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Prolifics Corporation Private Limited["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'meta')
    && hasInputWithId(page, 'jobs')
    && /"website":"https:\/\/prolifics\.(?:com|ai)\/"/i.test(decodedPage)
    && /"company_name":"Prolifics Corporation Private Limited"/i.test(decodedPage)
    && /"list_url":"https:\/\/prolifics\.zohorecruit\.in\/jobs\/Careers"/i.test(decodedPage)
}

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter((record) => isPublishedRecord(record) && isIndiaJob(record) && !isObviousTestRecord(record))
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const city = normalizeWhitespace(record.City)
    const state = normalizeWhitespace(record.State)
    const country = normalizeWhitespace(record.Country)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = buildJobUrl({
      id: jobId,
      title,
      rawUrl: record.$url,
    })
    const location = getLocation(record)

    if (!title || !country || !jobId || !sourceUrl || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: toRequiredSkills(record.Required_Skills),
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: normalizeRemoteStatus(record),
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createProlificsCorporationLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Prolifics careers page')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official Prolifics careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Prolifics public jobs API no longer returns the verified success payload')
    }

    const jobs = extractIndiaJobs(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createProlificsCorporationLtdScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Prolifics Corporation Ltd scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
