import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOBROKERS_CATALOG } from './catalog.js'
export const PROVIDER_METADATA = NOBROKERS_CATALOG

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'nobrokers'
export const COMPANY = 'NoBroker'
export const HOMEPAGE_URL = 'https://www.nobroker.in/'
export const CAREERS_URL = 'https://www.nobroker.in/careers'
export const JOB_FEED_URL = 'https://no-broker-cbaa4.firebaseio.com/jobOpeningSheet.json'

const TRUSTED_BUNDLE_HOST = 'assets.nobroker.in'
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
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value ?? ''))

const isTrustedBundleUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname === TRUSTED_BUNDLE_HOST && /\.js$/i.test(url.pathname)
  } catch {
    return false
  }
}

const toDateOnly = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { location: null, city: null, country: null }

  if (/remote/i.test(normalized) && /india/i.test(normalized)) {
    return {
      location: normalized,
      city: null,
      country: 'India',
    }
  }

  const parts = normalized
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 0) {
    return { location: normalized, city: null, country: null }
  }

  if (parts.length === 1) {
    return { location: normalized, city: parts[0], country: null }
  }

  return {
    location: normalized,
    city: parts[0],
    country: parts.at(-1),
  }
}

const buildDepartment = (team, subTeam) => {
  const values = [normalizeWhitespace(team), normalizeWhitespace(subTeam)].filter(Boolean)
  return [...new Set(values)].join(' - ') || null
}

const isTrustedJobRecord = (record) =>
  record != null
  && typeof record === 'object'
  && normalizeWhitespace(record.Role)
  && normalizeWhitespace(record.Location)
  && normalizeWhitespace(record.Link)
  && record.Id != null
  && normalizeWhitespace(record.Team)
  && normalizeWhitespace(record.SubTeam)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /NoBroker/i.test(page)
    && /href="\/careers"/i.test(page)
    && /NoBroker Technologies Solutions Pvt\. Ltd\./i.test(page)
}

export const extractBundleUrlsFromHtml = (html) => {
  const page = String(html ?? '')
  const matches = page.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+\.js)\1[^>]*><\/script>/gi)
  const urls = []

  for (const match of matches) {
    const candidate = match[2]

    try {
      const resolved = new URL(candidate, CAREERS_URL).href
      if (isTrustedBundleUrl(resolved)) {
        urls.push(resolved)
      }
    } catch {
      // Ignore malformed script URLs and fail closed later if no trusted bundles remain.
    }
  }

  return [...new Set(urls)]
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /rel="canonical"\s+href="https:\/\/www\.nobroker\.in\/careers"/i.test(page)
    && /Careers at NoBroker/i.test(page)
    && /Jobs Listing/i.test(page)
    && /See all opportunities/i.test(page)
    && extractBundleUrlsFromHtml(page).length > 0
}

export const hasJobsFeedBundleSignal = (bundleText) => {
  const code = String(bundleText ?? '')

  return /jobOpeningSheet/.test(code)
    && /initializeApp/.test(code)
    && /database\(\)\.ref/.test(code)
}

export const hasJobsFeedConfigSignal = (bundleText) => {
  const code = String(bundleText ?? '')

  return /(?:firebaseAuthDomain|authDomain)["']?\s*:\s*["']no-broker-cbaa4\.firebaseapp\.com["']/i.test(code)
    && /(?:firebaseDatabaseURL|databaseURL)["']?\s*:\s*["']https:\/\/no-broker-cbaa4\.firebaseio\.com["']/i.test(code)
}

export const hasVerifiedBundleSignals = (bundleTexts = []) =>
  Array.isArray(bundleTexts)
  && bundleTexts.some((bundleText) => hasJobsFeedBundleSignal(bundleText))
  && bundleTexts.some((bundleText) => hasJobsFeedConfigSignal(bundleText))

export const hasVerifiedJobFeedPayload = (payload) =>
  Array.isArray(payload) && payload.filter((record) => record != null).every(isTrustedJobRecord)

export const extractJobsFromFeed = (payload) => {
  if (!Array.isArray(payload)) return []

  return payload
    .filter((record) => record != null)
    .map((record) => {
      if (!isTrustedJobRecord(record)) return null

      const title = normalizeWhitespace(record.Role)
      const link = normalizeWhitespace(record.Link)
      const location = parseLocation(record.Location)

      if (!title || !link || location.country !== 'India') return null

      const jobId = normalizeWhitespace(record.Id)

      return {
        title,
        company: COMPANY,
        department: buildDepartment(record.Team, record.SubTeam),
        location: location.location,
        city: location.city,
        country: location.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: link,
        applyUrl: link,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toDateOnly(record.PostedOn || record.PostingDate),
        closingDate: toDateOnly(record.ClosingDate),
        jobDescription: null,
        publicExperienceChecked: true,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: isAbsoluteHttpUrl(url) && /\.js$/i.test(new URL(url).pathname)
      ? '*/*'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNobrokersScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('NoBroker homepage no longer matches the verified official homepage surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('NoBroker careers page no longer matches the verified official careers surface')
    }

    const bundleUrls = extractBundleUrlsFromHtml(careersHtml)
    const bundleTexts = await Promise.all(bundleUrls.map((url) => fetchText(url)))

    if (!hasVerifiedBundleSignals(bundleTexts)) {
      throw new Error(
        'NoBroker careers client bundles no longer expose the verified public Firebase jobs feed',
      )
    }

    const payload = await fetchJson(JOB_FEED_URL)
    if (!hasVerifiedJobFeedPayload(payload)) {
      throw new Error('NoBroker public Firebase jobs feed changed materially')
    }

    const jobs = extractJobsFromFeed(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createNobrokersScraper(options).run(options)

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
