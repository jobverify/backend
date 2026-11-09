import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import TEKFRIDAY_PROCESSING_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TEKFRIDAY_PROCESSING_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_PORTAL_URL = 'https://tekfriday.zohorecruit.in/jobs/Careers'
export const CAREERS_API_URL =
  'https://tekfriday.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite&extra_fields=%5B%22Work_Experience%22,%22Job_Description%22,%22City%22,%22State%22%5D'

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
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const appendQueryParam = (url, fragment) => (url.includes('?') ? `${url}&${fragment}` : `${url}?${fragment}`)

const buildApplyUrl = (url) => {
  const normalized = normalizeWhitespace(url)
  if (!normalized) return null
  if (/\$apply=true/i.test(normalized)) return normalized
  return appendQueryParam(normalized, '$apply=true')
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

const normalizeExperienceValue = (value) => normalizeWhitespace(value)
  ?.replace(/\s*-\s*/g, '-')
  .replace(/\s*\+\s*/g, '+')
  .replace(/(\d)\s*-\s*(\d)/g, '$1-$2')
  || null

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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Tekfriday\s*::\s*Home\s*<\/title>/i.test(page)
    && /href=["'][^"']*careers\.html["']/i.test(page)
    && text.includes('Services')
    && text.includes('Portfolio Management')
    && text.includes('Because no two businesses are alike')
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Tekfriday\s*::\s*Careers\s*<\/title>/i.test(page)
    && text.includes('Open Positions')
    && text.includes('If you are passionate about Finance and Technology')
    && /rec_embed_js\.load/i.test(page)
    && /https:\/\/tekfriday\.zohorecruit\.in/i.test(page)
    && /empty_job_msg\s*:\s*['"]No current Openings['"]/i.test(page)
}

export const hasOfficialPortalSignal = (html = '') => {
  const page = String(html ?? '')

  return /meta property=["']og:url["'][^>]*https:\/\/tekfriday\.zohorecruit\.in\/jobs\/Careers/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

const isIndiaJob = (record = {}) => /india/i.test(normalizeWhitespace(record.Country) || '')

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const applyUrl = buildApplyUrl(sourceUrl)
      const { location, city, state, country } = normalizeLocation(record)
      const jobDescription = normalizeWhitespace(record.Job_Description)
      const directExperience = normalizeExperienceValue(record.Work_Experience)
      const descriptionExperience = inferExperienceFromDescription(jobDescription)

      if (!title || !jobId || !sourceUrl || !applyUrl || !location || !country) return null

      return {
        title,
        company: COMPANY,
        location,
        city,
        state,
        country,
        sourceUrl,
        applyUrl,
        requisitionId: jobId,
        jobId,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: directExperience || descriptionExperience || null,
        postingDate: normalizeWhitespace(record.Date_Opened),
        closingDate: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        jobDescription,
        remoteStatus: 'On-site',
        publicExperienceChecked: Boolean(jobDescription),
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const run = async ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => {
  const homepageHtml = await fetchText(HOMEPAGE_URL)
  if (!hasOfficialHomepageSignal(homepageHtml)) {
    throw new Error('The verified TekFriday Processing Solutions homepage changed materially')
  }

  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('The verified TekFriday Processing Solutions careers surface changed materially')
  }

  const portalHtml = await fetchText(CAREERS_PORTAL_URL)
  if (!hasOfficialPortalSignal(portalHtml)) {
    throw new Error('The verified TekFriday Processing Solutions careers portal changed materially')
  }

  const payload = await fetchJson(CAREERS_API_URL)
  if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
    throw new Error('The verified TekFriday Processing Solutions public jobs API no longer returns the trusted success payload')
  }

  const jobs = extractIndiaJobs(payload)
  if (jobs.length === 0) {
    throw new Error('The verified TekFriday Processing Solutions public jobs API no longer exposes trusted India openings')
  }

  return jobs.map((job) => ({
    ...job,
    link: job.applyUrl,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    scrapedAt: now(),
  }))
}

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
