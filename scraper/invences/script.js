import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'invences'
export const COMPANY = 'Invences Inc.'
export const HOMEPAGE_URL = 'https://invences.com/'
export const CAREERS_URL = 'https://invences.com/career'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const unique = (values) => [...new Set(values.filter(Boolean))]

const extractTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const extractHref = (html) => String(html ?? '').match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || null

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const extractOfficialCareersUrl = (html = '') => {
  for (const match of String(html).matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[2], HOMEPAGE_URL)
      const text = stripTags(match[3])
      if (url.origin !== new URL(HOMEPAGE_URL).origin) continue
      if (!/^\/careers?\/?$/i.test(url.pathname) && !/^careers?$/i.test(text)) continue
      url.hash = ''
      return url.toString().replace(/\/$/, '')
    } catch {
      // Ignore malformed links while looking for a verified same-origin handoff.
    }
  }

  return null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractCityState = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { city: null, state: null }

  const parts = normalized
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      city: parts[0] || null,
      state: parts[1] || null,
    }
  }

  return {
    city: null,
    state: null,
  }
}

const extractJobsTable = (html) => {
  const page = String(html ?? '')
  const tables = [...page.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]

  return tables.find((match) => {
    const normalized = stripTags(match[0])
    return /Job-details-table/i.test(match[0])
      && /Position/i.test(normalized)
      && /Location/i.test(normalized)
      && /Type/i.test(normalized)
      && /Posted On/i.test(normalized)
  })?.[0] || null
}

const extractRows = (tableHtml) => [...String(tableHtml ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => cell[1]))
  .filter((cells) => cells.length >= 4)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  const hasKnownTitle = /<title>\s*Invences\s*-\s*Technology\s+Solutions\s*<\/title>/i.test(page)
    || /<title>\s*Connectivity\s*(?:&|&amp;)\s*Data Center Infrastructure\s*\|\s*Invences\s*<\/title>/i.test(page)
  const hasKnownNavigation = /\bAbout\b/i.test(text) && /\bCapabilities\b/i.test(text)
    || /\bSolutions\b/i.test(text) && /\bServices\b/i.test(text) && /\bProducts\b/i.test(text) && /\bIndustries\b/i.test(text)

  return hasKnownTitle
    && /info@invences\.com/i.test(page)
    && /\bInvences\b/i.test(text)
    && hasKnownNavigation
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  return /<title>\s*Invences\s*-\s*Career\s*<\/title>/i.test(page)
    && /Currently\s*hiring/i.test(text)
    && /Position\s+Location\s+Type\s+Posted\s+On/i.test(text)
    && /info@invences\.com/i.test(text)
    && /Job-details-table/i.test(page)
}

export const extractJobs = (html) => {
  const tableHtml = extractJobsTable(html)
  if (!tableHtml) return []

  return extractRows(tableHtml)
    .map((cells) => {
      const titleCellHtml = cells[0]
      const title = stripTags(titleCellHtml)
      const sourceUrl = toAbsoluteUrl(extractHref(titleCellHtml))
      const location = stripTags(cells[1])
      const employmentType = stripTags(cells[2])
      const postingDate = stripTags(cells[3])

      if (!title || !sourceUrl || !location || !employmentType || !postingDate) return null

      const { city, state } = extractCityState(location)
      const jobKey = slugify(new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) || title)
      const jobId = `${SOURCE}-${jobKey}`

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city,
        state,
        country: 'United States',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate,
        closingDate: null,
        jobDescription: `Official ${COMPANY} opening for ${title} in ${location}.`,
      }
    })
    .filter(Boolean)
}

export const filterIndiaJobs = (jobs = []) =>
  jobs.filter((job) => /india/i.test(unique([job.location, job.city, job.state, job.country]).join(' ')))

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  signal,
  timeoutMs: 15000,
})

export const createInvencesScraper = () => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    const fetchOfficialPage = async (url) => {
      signal?.throwIfAborted()
      try {
        const html = await fetchText(url, { signal })
        signal?.throwIfAborted()
        return html
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }

    const homepageHtml = await fetchOfficialPage(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Invences homepage no longer matches the verified official public surface')
    }

    const careersUrl = extractOfficialCareersUrl(homepageHtml)
    if (!careersUrl) return []

    const careersHtml = await fetchOfficialPage(careersUrl)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Invences verified careers surface no longer matches the expected table contract')
    }

    const jobs = extractJobs(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Invences verified careers surface no longer exposes the expected job table')
    }

    return filterIndiaJobs(jobs).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createInvencesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Invences scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
