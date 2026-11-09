import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mindteck'
export const COMPANY = 'Mindteck'
export const HOMEPAGE_URL = 'https://www.mindteck.com/'
export const CAREERS_URL = 'https://careers.mindteck.com/'
export const JOB_SEARCH_URL = 'https://careers.mindteck.com/job-search'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('mindteck | ai, iot & product engineering solutions')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('step into a world of opportunities')
    && normalized.includes('discover career opportunities that match your ambitions at mindteck')
    && normalized.includes('explore open positions')
}

export const extractJobSearchUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl === JOB_SEARCH_URL) {
      return absoluteUrl
    }
  }

  return null
}

const extractPotentialJobLinks = (html) => {
  const links = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], JOB_SEARCH_URL)
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    if (/\/job-search\/[^/?#]+/i.test(absoluteUrl) || /\b(job|jobs|opening|openings|position|positions)\b/i.test(absoluteUrl)) {
      seen.add(absoluteUrl)
      links.push(absoluteUrl)
    }
  }

  return links
}

export const hasZeroJobsShellSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('global engineering and technology solutions company')
    && normalized.includes('delivering knowledge that matters')
    && normalized.includes('all rights reserved')
    && extractPotentialJobLinks(html).length === 0
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMindteckScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Mindteck homepage no longer matches the verified official careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Mindteck careers page no longer matches the verified official public careers handoff')
    }

    const jobSearchUrl = extractJobSearchUrl(careersHtml)
    if (jobSearchUrl !== JOB_SEARCH_URL) {
      throw new Error('Mindteck careers page no longer links to the verified public job-search route')
    }

    const jobSearchHtml = await fetchText(jobSearchUrl)
    if (hasZeroJobsShellSignal(jobSearchHtml)) {
      return []
    }

    if (extractPotentialJobLinks(jobSearchHtml).length > 0) {
      throw new Error('Mindteck public job-search surface now exposes jobs')
    }

    throw new Error('Mindteck public job-search surface no longer matches the verified zero-jobs shell')
  },
})

export const run = async (options = {}) => createMindteckScraper().run(options)

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
