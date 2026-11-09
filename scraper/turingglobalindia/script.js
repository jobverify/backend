import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'turingglobalindia'
export const COMPANY = 'Turing Global India Private Limited'
export const CAREERS_URL = 'https://careers.turing.com/'
export const OPEN_ROLES_URL = 'https://careers.turing.com/roles'
export const ZERO_OPEN_ROLES_MESSAGE = 'Sorry! There are no jobs for this category :('

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_LANDING_SIGNALS = [
  'Great people. Real impact.',
  'At Turing, our mission is to accelerate superintelligence to drive real economic progress',
  'Turing Talent Network',
]

const OPEN_ROLES_SIGNALS = [
  'Back to Careers page',
  'Live Openings',
  'Team',
  'Location',
]

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

export const extractOpenRolesUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl === OPEN_ROLES_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialCareersLandingSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return CAREERS_LANDING_SIGNALS.every((signal) => normalized.includes(signal))
    && extractOpenRolesUrl(html) === OPEN_ROLES_URL
}

export const hasOfficialOpenRolesSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return OPEN_ROLES_SIGNALS.every((signal) => normalized.includes(signal))
}

export const extractOpenRolesCount = (html) => {
  const match = normalizeWhitespace(html).match(/\b(\d+)\s+Open Roles\b/i)
  return match ? Number.parseInt(match[1], 10) : null
}

export const hasZeroOpenRolesSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return hasOfficialOpenRolesSignal(normalized)
    && extractOpenRolesCount(normalized) === 0
    && normalized.includes(ZERO_OPEN_ROLES_MESSAGE)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTuringGlobalIndiaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersLandingHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Turing careers landing no longer matches the verified official careers landing')
    }

    const openRolesHtml = await fetchText(OPEN_ROLES_URL)

    if (!hasOfficialOpenRolesSignal(openRolesHtml)) {
      throw new Error('Turing open-roles page no longer matches the verified official public surface')
    }

    const openRolesCount = extractOpenRolesCount(openRolesHtml)
    if (openRolesCount == null) {
      throw new Error('Turing open-roles page no longer exposes a verifiable public role count')
    }

    if (openRolesCount > 0) {
      throw new Error('Turing open-roles page now exposes public openings and needs a structured scraper')
    }

    if (!hasZeroOpenRolesSignal(openRolesHtml)) {
      throw new Error('Turing open-roles page no longer matches the verified zero-open-roles state')
    }

    return []
  },
})

export const run = async (options = {}) => createTuringGlobalIndiaScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
