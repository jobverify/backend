import { readCurrentSakarInventory } from './currentCareers.js'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const HOMEPAGE_URL = 'https://www.sakarrobotics.com/'
export const CAREERS_PAGE_URL = 'https://www.sakarrobotics.com/careers'
export const CAREERS_PORTAL_URL = 'https://sakarrobotics.zohorecruit.in/jobs/Careers'
export const CAREERS_API_URL =
  'https://sakarrobotics.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite&extra_fields=%5B%22Work_Experience%22,%22Job_Description%22,%22Date_Opened%22%5D'

const COMPANY = 'Sakar Robotics'
const SOURCE = 'sakarrobotics'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const hasCurrentOfficialAppShell = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Sakar Robotics\s*<\/title>/i.test(page)
    && /name=["']description["'][^>]+Sakar builds general-purpose robots that perceive, decide, and act/i.test(page)
    && /property=["']og:url["'][^>]+https:\/\/www\.sakarrobotics\.com\//i.test(page)
    && /src=["']\/build\/seo\.js\?v=\d+["']/i.test(page)
    && /src=["']\/build\/pages\/company\.js\?v=\d+["']/i.test(page)
    && /src=["']\/build\/app\.js\?v=\d+["']/i.test(page)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return hasCurrentOfficialAppShell(page) || (
    /<title>\s*Sakar Robotics:\s*Intelligent Automation\s*<\/title>/i.test(page)
    && /href=["'](?:https:\/\/www\.sakarrobotics\.com)?\/careers["']/i.test(page)
    && /https:\/\/sakarrobotics\.zohorecruit\.in\/jobs\/Careers/i.test(page)
    && /Unified Autonomous Robotics Platform/i.test(page)
    && /Build the Future with Us/i.test(page)
  )
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return hasCurrentOfficialAppShell(page) || (
    /<title>\s*Sakar Robotics:\s*Intelligent Automation\s*<\/title>/i.test(page)
    && /Join a multidisciplinary team engineering autonomous systems/i.test(page)
    && /View Open Roles/i.test(page)
    && /https:\/\/sakarrobotics\.zohorecruit\.in\/jobs\/Careers/i.test(page)
  )
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Sakar Robotics\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/sakarrobotics\.zohorecruit\.in\/jobs\/Careers["']/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

const isPublishedRecord = (record = {}) => record.Publish !== false

const normalizeRemoteStatus = (value) => {
  if (value === true) return 'Remote'
  if (value === false) return 'On-site'
  return null
}

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isPublishedRecord(record) && isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const department = normalizeWhitespace(record.Department || record.Industry)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const { location, city, state, country } = normalizeLocation(record)

      if (!title || !jobId || !sourceUrl || !location || !country) return null

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
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(String(record.Job_Description || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')),
        publicExperienceChecked: Boolean(
          normalizeWhitespace(record.Work_Experience) || normalizeWhitespace(record.Job_Description),
        ),
        remoteStatus: normalizeRemoteStatus(record.Remote_Job),
      }
    })
    .filter(Boolean)

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createSakarRoboticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const readText = async url => { signal?.throwIfAborted(); const value = await fetchText(url, { signal }); signal?.throwIfAborted(); return value }
    const readJson = async url => { signal?.throwIfAborted(); const value = await fetchJson(url, { signal }); signal?.throwIfAborted(); return value }
    const homepageHtml = await readText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified official Sakar Robotics homepage')
    }

    if (hasCurrentOfficialAppShell(homepageHtml)) {
      const payload = await readCurrentSakarInventory({ html: homepageHtml, readText, readJson })
      const jobs = extractIndiaJobs(payload)
      const selected = Number.isInteger(maxJobs) && maxJobs > 0 ? jobs.slice(0,maxJobs) : jobs
      return selected.map(job => ({ ...job, source: SOURCE, link: job.applyUrl || job.sourceUrl, scrapedAt: now(), ...(selected.length < jobs.length ? {sourceListingComplete:false} : {}) }))
    }

    const careersPageHtml = await readText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Sakar Robotics careers page')
    }

    const portalHtml = await readText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official Sakar Robotics careers portal')
    }

    const payload = await readJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Sakar Robotics public jobs API no longer returns the verified success payload')
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

export const run = async (options = {}) => createSakarRoboticsScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Sakar Robotics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
