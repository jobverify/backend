import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'jkfennerindialtd'
export const COMPANY = 'J.K.Fenner India Ltd'
export const HOMEPAGE_URL = 'https://jkfenner.com/'
export const CAREERS_URL = 'https://jkfenner.com/career-list/'
export const JOB_OPENINGS_URL = 'https://jkfenner.com/job-openings/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<(li|p|tr|td)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const slugify = (value) =>
  normalizeWhitespace(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null

const extractFirst = (html, pattern) => {
  const match = pattern.exec(String(html ?? ''))
  return match ? normalizeWhitespace(match[1]) : null
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractTableRows = (html) =>
  [...String(html ?? '').matchAll(
    /<tr>\s*<td class="grade_select"><strong>([\s\S]*?)<\/strong><\/td>\s*<td>\s*<ul>([\s\S]*?)<\/ul>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="apply_btn"><a[^>]+href="([^"]+)"[^>]*>Apply<\/a><\/td>\s*<\/tr>/gi,
  )].map((match) => ({
    title: stripTags(match[1]),
    locations: extractListItems(match[2]),
    experienceRequired: stripTags(match[3]),
    ageRequirement: stripTags(match[4]),
    minimumQualification: stripTags(match[5]),
    jobRole: stripTags(match[6]),
    jobDescription: stripTags(match[7]),
    applyUrl: normalizeWhitespace(match[8]),
  }))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*JK Fenner\s*<\/title>/i.test(rawHtml)
    && /href="https:\/\/jkfenner\.com\/career-list\/"/i.test(rawHtml)
    && /Redefining Motion Over 70 years\.\.\./i.test(normalized)
    && /Leading manufacturer of/i.test(normalized)
    && /POWER TRANSMISSION BELTS/i.test(rawHtml)
    && /CUSTOMER FIRST/i.test(rawHtml)
}

export const hasCareerListSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Career List \| JK Fenner\s*<\/title>/i.test(rawHtml)
    && /Open Positions/i.test(normalized)
    && /<th>\s*Position\s*<\/th>/i.test(rawHtml)
    && /<th>\s*Location\s*<\/th>/i.test(rawHtml)
    && /<th>\s*Experience\s*<\/th>/i.test(rawHtml)
    && /<th>\s*Age\s*<\/th>/i.test(rawHtml)
    && /<th>\s*Qualification\s*<\/th>/i.test(rawHtml)
    && /<th>\s*Job Role\s*<\/th>/i.test(rawHtml)
    && /<th>\s*Description\s*<\/th>/i.test(rawHtml)
    && /href=["'][^"']*\/job-openings\/?["']/i.test(rawHtml)
}

export const extractOpenPositions = (html) => {
  if (!hasCareerListSignal(html)) {
    throw new Error('J.K.Fenner India Ltd verified careers table no longer matches the known public surface')
  }

  const rows = extractTableRows(html)

  if (rows.length !== 8) {
    throw new Error('J.K.Fenner India Ltd verified careers table no longer matches the known public surface')
  }

  return rows.map((row) => {
    if (!row.title || !row.experienceRequired || !row.minimumQualification || !row.jobRole || !row.jobDescription) {
      throw new Error('J.K.Fenner India Ltd verified careers table no longer matches the known public surface')
    }

    const location = row.locations.length > 0 ? `${row.locations.join(', ')}, India` : 'India'

    return {
      title: row.title,
      location,
      city: row.locations.length === 1 ? row.locations[0] : null,
      state: null,
      jobId: `${SOURCE}-${slugify(`${row.title} ${row.locations.join(' ')}`)}`,
      requisitionId: `${SOURCE}-${slugify(`${row.title} ${row.locations.join(' ')}`)}`,
      employmentType: 'Full-time',
      experienceRequired: row.experienceRequired,
      minimumQualification: row.minimumQualification,
      preferredQualification: null,
      department: row.jobRole,
      jobDescription: row.jobDescription,
      sourceUrl: CAREERS_URL,
      applyUrl: row.applyUrl || JOB_OPENINGS_URL,
      link: row.applyUrl || JOB_OPENINGS_URL,
    }
  })
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const createJkFennerIndiaLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('J.K.Fenner India Ltd verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractOpenPositions(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      company: COMPANY,
      country: 'India',
      source: SOURCE,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createJkFennerIndiaLtdScraper().run(options)

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
