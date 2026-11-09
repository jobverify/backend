import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'talentbattle'
export const COMPANY = 'Talent Battle'
export const HOME_URL = 'https://talentbattle.in/'
export const JOBS_URL = 'https://talentbattle.in/Jobs'
export const CAREERS_URL = 'https://talentbattle.in/careers'
export const CAREER_URL = 'https://talentbattle.in/career'
export const JOIN_US_URL = 'https://talentbattle.in/join-us'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const OFFICIAL_HOMEPAGE_SIGNALS = [
  'talent battle | one-stop platform for placement preparation and upskilling',
  'preparing for placement?',
  'apply to jobs',
  'get off-campus updates',
  'one stop platform for your placement preparation.',
]

const PLACEMENT_BOARD_SHELL_SIGNALS = [
  'job posting',
  'filter jobs',
  'view as',
  'domain',
  'companies',
  'status',
  'apply to jobs',
  'one stop platform for your placement preparation.',
]

const TALENT_BATTLE_HIRING_SIGNAL =
  /\b(?:careers|career|current openings|open positions|jobs?)\s+at\s+talent\s+battle\b|\btalent\s+battle\s+is\s+hiring\b|\bwork\s+with\s+us\s+at\s+talent\s+battle\b|\bjoin\s+talent\s+battle\s+as\b/i

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return OFFICIAL_HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasPlacementBoardShellSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return PLACEMENT_BOARD_SHELL_SIGNALS.every((signal) => normalized.includes(signal))
}

export const isNextNotFoundPage = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('404: This page could not be found')
    && (
      normalized.includes('This page could not be found.')
      || /"errorStatus"\s*:\s*404/.test(page)
    )
}

export const hasTalentBattleHiringSignal = (html) =>
  TALENT_BATTLE_HIRING_SIGNAL.test(normalizeWhitespace(html))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTalentBattleScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOME_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Talent Battle official homepage changed; refusing to assume zero public company jobs')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasPlacementBoardShellSignal(jobsHtml)) {
      throw new Error('Talent Battle placement jobs shell changed; refusing to assume it is still a non-employer board')
    }

    if (hasTalentBattleHiringSignal(jobsHtml)) {
      throw new Error('Talent Battle jobs surface now appears to advertise company hiring')
    }

    const careersRouteUrls = [CAREERS_URL, CAREER_URL, JOIN_US_URL]

    for (const routeUrl of careersRouteUrls) {
      const routeHtml = await fetchText(routeUrl)
      if (!isNextNotFoundPage(routeHtml)) {
        throw new Error(`Talent Battle now exposes a first-party careers route at ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTalentBattleScraper().run(options)

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
