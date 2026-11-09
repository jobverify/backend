import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bytexl'
export const COMPANY = 'byteXL'
export const HOMEPAGE_URL = 'https://bytexl.com/'
export const CAREERS_PAGE_URL = 'https://bytexl.com/careers'
export const APPLICATION_EMAIL = 'careers@bytexl.in'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`
export const VERIFIED_ON = '2026-08-13'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Thursday, August 13, 2026 that https://bytexl.com/ is the live official byteXL homepage titled "byteXL: Industry-Aligned Skilling for Modern AI Careers", that the homepage still advertises the first-party careers route at https://bytexl.com/careers, and that https://bytexl.com/careers currently returns an official 404 Not Found page with no public job listings exposed.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toPageText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildJobUrl = (href) => new URL(String(href ?? '').trim(), HOMEPAGE_URL).href

const toJobId = (sourceUrl) => {
  try {
    const pathname = new URL(sourceUrl).pathname
    return pathname
      .replace(/^\/+/, '')
      .replace(/\.php$/i, '')
      .replace(/^careers-/i, '')
      .toLowerCase()
  } catch {
    return null
  }
}

const extractInlineField = (html, label) => normalizeWhitespace(
  String(html ?? '').match(
    new RegExp(`<span[^>]*>\\s*<b>\\s*${escapeRegex(label)}\\s*:\\s*<\\/b>\\s*<\\/span>\\s*([^<]+)`, 'i'),
  )?.[1],
)

const extractPlainTextField = (html, label) => normalizeWhitespace(
  String(html ?? '').match(
    new RegExp(`\\b${escapeRegex(label)}\\s*:\\s*([^<]+)`, 'i'),
  )?.[1],
)

const extractFieldValue = (html, label) =>
  extractInlineField(html, label) || extractPlainTextField(html, label)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/,\s*India$/i.test(normalized)) {
    return normalized
  }

  if (/[-/,\s]*India$/i.test(normalized)) {
    return normalized.replace(/\s*-\s*India$/i, ', India')
  }

  return `${normalized}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  if (/^(?:Across India|Campus Onsite)\b/i.test(normalized)) {
    return null
  }

  return normalizeCity(normalized)
}

const splitExperienceAndEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      experienceRequired: null,
      employmentType: null,
    }
  }

  const parts = normalized
    .split('|')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return {
    experienceRequired: parts[0] || null,
    employmentType: parts[1] || null,
  }
}

const extractJobDescription = (html) => {
  const sections = [...String(html ?? '').matchAll(/<section class="py-5(?: bg-grey)?">([\s\S]*?)<\/section>/gi)]
    .map((match) => match[1] || '')
    .filter((section) => !/APPLY NOW/i.test(section))
    .map((section) => stripHtml(section))
    .filter(Boolean)

  return normalizeWhitespace(sections.join(' '))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = toPageText(page) || ''

  return /<title>\s*byteXL:\s*Industry-Aligned Skilling for Modern AI Careers\s*<\/title>/i.test(page)
    && /href=["']\/careers["']/i.test(page)
    && text.includes('byteXL')
    && text.includes('CareerXL')
}

export const isVerifiedMissingCareersRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const text = toPageText(page) || ''

  return status === 404
    && /<title>\s*Not Found\s*<\/title>/i.test(page)
    && /HTTP Status:\s*404\s*\(not found\)/i.test(text)
}

export const extractOpenings = (html) =>
  [...String(html ?? '').matchAll(
    /<div class="careerBox">[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div class="details">[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<a[^>]*href="([^"]+)"/gi,
  )]
    .map((match) => {
      const title = stripHtml(match[1])
      const summary = stripHtml(match[2])
      const href = normalizeWhitespace(match[3])

      if (!title || !href) return null

      return {
        title,
        summary,
        sourceUrl: buildJobUrl(href),
      }
    })
    .filter(Boolean)

export const extractJobDetail = (html, sourceUrl) => {
  const title = stripHtml(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || null
  const rawLocation = extractFieldValue(html, 'Location')
  const location = normalizeLocation(rawLocation)
  const city = deriveCity(rawLocation)
  const { experienceRequired, employmentType } = splitExperienceAndEmploymentType(
    extractFieldValue(html, 'Experience'),
  )
  const applyUrl = String(html ?? '').match(/href=["'](mailto:[^"']+)["']/i)?.[1] || APPLICATION_URL

  return {
    title,
    company: COMPANY,
    location,
    city,
    country: 'India',
    jobId: toJobId(sourceUrl),
    requisitionId: toJobId(sourceUrl),
    sourceUrl,
    applyUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: extractJobDescription(html),
    remoteStatus: 'On-site',
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

export const createBytexlScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchText = defaultFetchText } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('The verified homepage for byteXL no longer matches the official company surface')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (isVerifiedMissingCareersRoute(careersPage)) {
      return []
    }

    if (careersPage.status !== 200) {
      throw new Error(`HTTP ${careersPage.status} for ${CAREERS_PAGE_URL}`)
    }

    const openings = extractOpenings(careersPage.html)
    const selectedOpenings = Number.isInteger(maxJobs) && maxJobs > 0
      ? openings.slice(0, maxJobs)
      : openings

    const jobs = []

    for (const opening of selectedOpenings) {
      const detailHtml = await fetchText(opening.sourceUrl)
      const detail = extractJobDetail(detailHtml, opening.sourceUrl)

      jobs.push({
        ...detail,
        title: detail.title || opening.title,
        jobDescription: detail.jobDescription || opening.summary,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = async () => createBytexlScraper().run()

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
