import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'ihubrobotics'
export const COMPANY = 'iHUB Robotics'
export const CAREERS_URL = 'https://www.ihubrobotics.com/careers'
export const CAREERS_API_URL =
  'https://gwoqjnxfcovagwmpiwob.supabase.co/rest/v1/job_positions?select=*&is_active=eq.true&order=created_at.desc'
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BUNDLE_REQUIRED_SIGNALS = [
  'https://gwoqjnxfcovagwmpiwob.supabase.co',
  'job_positions',
  '/careers',
  "We're Hiring",
  'Open Positions',
  'Join Our Talent Network',
]

const INDIA_LOCATION_PATTERNS = [
  /\bindia\b/i,
  /\bkochi\b/i,
  /\bdelhi\b/i,
  /\bncr\b/i,
  /\bbangalore\b/i,
  /\bbengaluru\b/i,
  /\bchennai\b/i,
]

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/contract/.test(normalized)) return 'Contract'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null

  const parts = location
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 2 && /^india$/i.test(parts[0]) && !/^india$/i.test(parts[1])) {
    return `${parts[1]}, India`
  }

  return parts.join(', ') || location
}

const getCountryFromLocation = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null
  if (/uae/i.test(normalized)) return 'UAE'
  if (INDIA_LOCATION_PATTERNS.some((pattern) => pattern.test(normalized))) return 'India'
  return null
}

const getCityFromLocation = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null
  return normalizeWhitespace(normalized.split(',')[0])
}

const isIndiaLocation = (location) => getCountryFromLocation(location) === 'India'

export const hasOfficialCareersShell = (html) => {
  const page = String(html ?? '')

  return /<title>\s*iHub Robotics\s+—\s+India's Leading Humanoid Robot Company\s*<\/title>/i.test(page)
    && /meta\s+property=["']og:site_name["']\s+content=["']iHub Robotics["']/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
    && /gptengineer\.js/i.test(page)
    && extractBundleAssetPath(page) !== null
}

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const extractSupabaseAnonKey = (bundleText) => {
  const match = String(bundleText ?? '').match(
    /eyJ[a-zA-Z0-9._-]+/,
  )

  return match?.[0] ?? null
}

export const hasVerifiedCareersBundle = (bundleText) => {
  const text = String(bundleText ?? '')
  return BUNDLE_REQUIRED_SIGNALS.every((signal) => text.includes(signal))
    && extractSupabaseAnonKey(text) !== null
}

export const buildApiHeaders = (apiKey) => ({
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  apikey: apiKey,
  Authorization: `Bearer ${apiKey}`,
})

export const extractJobs = (payload) => (Array.isArray(payload) ? payload : [])
  .filter((record) => record?.is_active === true)
  .filter((record) => isIndiaLocation(record?.location))
  .map((record) => {
    const title = normalizeWhitespace(record?.title)
    const department = normalizeWhitespace(record?.department)
    const location = normalizeLocation(record?.location)
    const city = getCityFromLocation(location)
    const country = getCountryFromLocation(location)
    const jobId = normalizeWhitespace(record?.id)

    if (!title || !location || !country || !jobId) return null

    return {
      title,
      company: COMPANY,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl: `${CAREERS_URL}#open-positions`,
      applyUrl: `${CAREERS_URL}#open-positions`,
      employmentType: normalizeEmploymentType(record?.type),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: Array.isArray(record?.requirements)
        ? record.requirements.map(normalizeWhitespace).filter(Boolean)
        : [],
      postingDate: normalizeWhitespace(record?.created_at),
      closingDate: null,
      jobDescription: normalizeWhitespace(record?.description),
      publicExperienceChecked: true,
      remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: /\/assets\/index-.*\.js$/i.test(url)
        ? 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createIhubRoboticsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersShell = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersShell(careersShell)) {
      throw new Error('iHUB Robotics verified official careers shell no longer matches the known public surface')
    }

    const bundleAssetPath = extractBundleAssetPath(careersShell)
    if (!bundleAssetPath) {
      throw new Error('iHUB Robotics careers shell no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, CAREERS_URL).toString()
    const bundleText = await fetchText(bundleUrl)

    if (!hasVerifiedCareersBundle(bundleText)) {
      throw new Error('iHUB Robotics client bundle changed materially or no longer exposes the public jobs contract')
    }

    const apiKey = extractSupabaseAnonKey(bundleText)
    const payload = await fetchJson(CAREERS_API_URL, {
      headers: buildApiHeaders(apiKey),
    })

    if (!Array.isArray(payload)) {
      throw new Error('iHUB Robotics public jobs API no longer returns the verified payload')
    }

    const jobs = extractJobs(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createIhubRoboticsScraper().run(options)

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
