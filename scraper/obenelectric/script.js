import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import OBEN_ELECTRIC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = OBEN_ELECTRIC_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.officialAboutPageUrl
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl

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

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''), HOMEPAGE_URL)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

export const hasOfficialAboutPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const hasVerifiedTitle = /<title>\s*About Us\s*(?:[-|]\s*Oben Electric)?\s*<\/title>/i.test(page)

  return hasVerifiedTitle
    && /Oben Electric/i.test(normalized)
    && /Explore Careers/i.test(page)
    && /https:\/\/careers\.obenelectric\.com\/jobs\/Careers/i.test(page)
}

export const extractOfficialCareersPortalUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/careers\.obenelectric\.com\/jobs\/Careers)["']/i,
  )

  return match?.[1] || null
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Oben Electric\s*<\/title>/i.test(page)
    && /meta property=["']og:url["'] content=["']https:\/\/careers\.obenelectric\.com\/jobs\/Careers["']/i.test(
      page,
    )
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
    && /CareerSite/i.test(page)
    && /Job Openings/i.test(page)
}

const buildLocation = (record = {}) => {
  const cityRaw = normalizeWhitespace(record.City)
  const city = normalizeCity(cityRaw || '')
  const country = normalizeWhitespace(record.Country) || 'India'

  if (city && country) {
    return {
      location: `${cityRaw || city}, ${country}`,
      city,
      country,
    }
  }

  if (country) {
    return {
      location: country,
      city: null,
      country,
    }
  }

  return {
    location: cityRaw || null,
    city: city || null,
    country: null,
  }
}

const buildMinimumQualification = (value) => {
  if (!Array.isArray(value)) return normalizeWhitespace(value)

  const normalized = value
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)

  return normalized.length > 0 ? normalized.join('; ') : null
}

const isIndiaJob = (record = {}) => {
  const country = normalizeWhitespace(record.Country)
  if (!country) return true
  return /india/i.test(country)
}

export const extractIndiaJobs = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .filter((record) => record && typeof record === 'object')
    .filter((record) => isIndiaJob(record))
    .map((record) => {
      const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
      const jobId = normalizeWhitespace(record.id)
      const sourceUrl = normalizeWhitespace(record.$url)
      const department = normalizeWhitespace(record?.Client_Name?.name || record.Department)
      const { location, city, country } = buildLocation(record)

      if (!title || !jobId || !sourceUrl || !location) return null

      return {
        title,
        company: COMPANY,
        department,
        location,
        city,
        country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(record.Job_Type),
        experienceRequired: normalizeWhitespace(record.Work_Experience),
        minimumQualification: buildMinimumQualification(record.Required_Qualification),
        preferredQualification: null,
        requiredSkills: [],
        postingDate: parsePostingDate(record.Date_Opened),
        closingDate: null,
        jobDescription: normalizeWhitespace(record.Job_Description),
        remoteStatus: record.Remote_Job ? 'Remote' : 'On-site',
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
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

export const createObenElectricScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const aboutPageHtml = await fetchText(ABOUT_PAGE_URL)
    if (!hasOfficialAboutPageSignal(aboutPageHtml)) {
      throw new Error('Oben Electric verified official about page no longer matches the trusted first-party careers handoff')
    }

    const careersPortalUrl = extractOfficialCareersPortalUrl(aboutPageHtml)
    if (!sameUrl(careersPortalUrl, CAREERS_PORTAL_URL)) {
      throw new Error('Oben Electric verified careers handoff changed materially')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Oben Electric verified careers portal no longer matches the trusted public surface')
    }

    const payload = await fetchJson(CAREERS_API_URL)
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Oben Electric public jobs API no longer returns the verified success payload')
    }

    const scrapedAt = now()

    return extractIndiaJobs(payload).map((job) => ({
      ...job,
      link: job.applyUrl || job.sourceUrl,
      source: SOURCE,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createObenElectricScraper(options).run(options)

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
