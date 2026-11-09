import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://global.foodhub.com/'
export const CAREERS_PAGE_URL = 'https://foodhubcareers.com/'
export const CAREERS_PORTAL_URL = 'https://jobs.foodhubcareers.com/jobs/Careers'
export const CAREERS_API_URL =
  'https://jobs.foodhubcareers.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite'

const COMPANY = 'Foodhub'
const SOURCE = 'foodhub'
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
  const fallbackLocation = normalizeWhitespace(
    record.Job_Location || record.Location || record.Job_Locations || record.Office_Location,
  )

  if (record.Remote_Job || /remote/i.test(fallbackLocation || '')) {
    return {
      location: 'Remote',
      city: null,
      state: null,
      country: null,
    }
  }

  const location = [city, state, country].filter(Boolean).join(', ') || fallbackLocation || null
  return { location, city, state, country }
}

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const isSamePortalHost = (value) => {
  try {
    return new URL(value || CAREERS_PORTAL_URL).hostname === 'jobs.foodhubcareers.com'
  } catch {
    return false
  }
}

const isPublishedRecord = (record = {}) => record.Publish !== false

const isUnlockedRecord = (record = {}) => {
  if (record.Locked === true) return false
  const status = normalizeWhitespace(
    record.Job_Opening_Status || record.Status || record.Job_Status || record.Record_Status,
  )?.toLowerCase()
  return status !== 'locked'
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Foodhub\b[\s\S]*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/global\.foodhub\.com\/["']/i.test(page)
    && /meta property=["']og:site_name["'] content=["']Foodhub["']/i.test(page)
    && /href=["']https:\/\/foodhubcareers\.com\/?["']/i.test(page)
    && normalized.includes('foodhub - order eat enjoy')
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Foodhub Careers \| Work With Us, We Are Fun, Innovative & Successful\s*<\/title>/i.test(page)
    && normalized.includes('work with us')
    && normalized.includes('apply for jobs')
    && normalized.includes('view all openings')
    && normalized.includes('why foodhub?')
    && normalized.includes('testimonials')
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Jobs at Foodhub\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/jobs\.foodhubcareers\.com\/jobs\/Careers["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

export const hasVerifiedJobDetailPage = (page = {}, job = {}) => {
  if (!isSamePortalHost(page.url || job.sourceUrl)) {
    return false
  }

  if (Number(page.status) !== 200) {
    return false
  }

  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const title = normalizeWhitespace(job.title)?.toLowerCase() || ''

  return normalized.includes('foodhub')
    && normalized.includes(title)
    && !/oops! it seems that the joblist has been removed\./i.test(html)
}

export const extractPublishedJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isPublishedRecord(record) && isUnlockedRecord(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const { location, city, state, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(record.Department),
        location,
        city,
        state,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Experience || record.Required_Experience),
        minimumQualification: normalizeWhitespace(record.Minimum_Qualification),
        preferredQualification: normalizeWhitespace(record.Preferred_Qualification),
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: normalizeWhitespace(record.Target_Date_to_Fill),
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job || /remote/i.test(location || '') ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
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

export const createFoodhubScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Response is not the verified official Foodhub homepage')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Response is not the verified official Foodhub careers page')
    }

    const portalPage = await fetchPage(CAREERS_PORTAL_URL)
    if (portalPage.status !== 200 || !hasOfficialPortalSignal(portalPage.html)) {
      throw new Error('Response is not the verified official Foodhub careers portal')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Foodhub public jobs API no longer returns the verified success payload')
    }

    const jobs = extractPublishedJobs(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    if (selectedJobs.length > 0) {
      const detailPage = await fetchPage(selectedJobs[0].sourceUrl)
      if (!hasVerifiedJobDetailPage(detailPage, selectedJobs[0])) {
        throw new Error('Foodhub job detail pages no longer match the verified public jobs surface')
      }
    }

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createFoodhubScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Foodhub scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
