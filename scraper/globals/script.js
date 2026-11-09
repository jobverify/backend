import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.globalsinc.com/'
export const CAREERS_PAGE_URL = 'https://www.globalsinc.com/careers/'
export const CURRENT_OPENINGS_PAGE_URL = 'https://www.globalsinc.com/careers/current-openings/'
export const CURRENT_OPENINGS_API_URL =
  'https://globals.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'

const COMPANY = 'Globals'
const SOURCE = 'globals'
const DETAIL_HOST = 'globals.zohorecruit.in'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
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

const normalizeLocation = (record = {}) => {
  const city = normalizeWhitespace(record.City)
  const state = normalizeWhitespace(record.State)
  const country = normalizeWhitespace(record.Country)
  const location = [city, state, country].filter(Boolean).join(', ') || null

  return { location, city, state, country }
}

const isPublishedRecord = (record = {}) => record.Publish !== false

const isUnlockedRecord = (record = {}) => record.Is_Locked !== true && record.Locked !== true

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Home Page\s*(?:-|&#8212;|\u2014)\s*Globals Corporate Website\s*<\/title>/i.test(page)
    && /meta\s+property=["']og:url["']\s+content=["']https:\/\/www\.globalsinc\.com\/["']/i.test(page)
    && /meta\s+property=["']og:site_name["']\s+content=["']Globals Corporate Website["']/i.test(page)
    && /Certified Great Place to Work/i.test(page)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*(?:-|&#8212;|\u2014)\s*Globals Corporate Website\s*<\/title>/i.test(page)
    && /meta\s+property=["']og:url["']\s+content=["']https:\/\/www\.globalsinc\.com\/careers\/["']/i.test(page)
    && /https:\/\/globalsinc\.com\/careers\/jobs\//i.test(page)
    && /https:\/\/globalsinc\.com\/careers\/current-openings\//i.test(page)
    && /careers\[at\]globalsinc\[dot\]com/i.test(page)
}

export const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Current Openings\s*(?:-|&#8212;|\u2014)\s*Globals Corporate Website\s*<\/title>/i.test(page)
    && /meta\s+property=["']og:url["']\s+content=["']https:\/\/www\.globalsinc\.com\/careers\/current-openings\/["']/i.test(page)
    && /id=["']rec_job_listing_div["']/i.test(page)
    && /site:"https:\/\/globals\.zohorecruit\.in"/i.test(page)
    && /source:"CareerSite"/i.test(page)
    && /empty_job_msg:"No current Openings"/i.test(page)
}

const isSameDetailHost = (value) => {
  try {
    return new URL(value).hostname === DETAIL_HOST
  } catch {
    return false
  }
}

export const hasVerifiedJobDetailPage = (page = {}, job = {}) => {
  if (Number(page.status) !== 200) {
    return false
  }

  if (!isSameDetailHost(page.url || job.sourceUrl)) {
    return false
  }

  const html = String(page.html ?? '')
  const normalizedHtml = normalizeWhitespace(html)?.toLowerCase() || ''
  const title = normalizeWhitespace(job.title)?.toLowerCase() || ''

  return normalizedHtml.includes('globals')
    && normalizedHtml.includes(title)
    && !/position filled|joblist has been removed|sign in to your zoho account/i.test(html)
}

export const extractPublishedJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isPublishedRecord(record) && isUnlockedRecord(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const department = normalizeWhitespace(record.Department || record.Industry)
      const { location, city, state, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department,
        location,
        city,
        state,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience || record.Experience),
        minimumQualification: normalizeWhitespace(record.Minimum_Qualification),
        preferredQualification: normalizeWhitespace(record.Preferred_Qualification),
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: normalizeWhitespace(record.Target_Date_to_Fill),
        jobDescription: normalizeWhitespace(record.Job_Description),
      }
    })
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const html = await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  return { status: 200, url, html }
}

const defaultFetchJson = (url) =>
  fetchJsonWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const createGlobalsScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Globals homepage no longer matches the verified official public site')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Globals careers page no longer matches the verified official public jobs surface')
    }

    const openingsPage = await fetchPage(CURRENT_OPENINGS_PAGE_URL)
    if (openingsPage.status !== 200 || !hasOfficialCurrentOpeningsSignal(openingsPage.html)) {
      throw new Error('Globals current openings page no longer matches the verified official public jobs surface')
    }

    const payload = await fetchJson(CURRENT_OPENINGS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Globals public jobs API no longer returns the verified success payload')
    }

    const jobs = extractPublishedJobs(payload)

    if (jobs.length > 0) {
      const detailPage = await fetchPage(jobs[0].sourceUrl)
      if (!hasVerifiedJobDetailPage(detailPage, jobs[0])) {
        throw new Error('Globals job detail pages no longer match the verified public jobs surface')
      }
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createGlobalsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Globals scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
