import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://sampigesemi.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN =
  /<title>\s*Sampige Semiconductors\s*-\s*India'?s Silicon,\s*for the World\s*<\/title>/i
const OFFICIAL_HERO_PATTERN = /India'?s Silicon,\s*for the World/i
const OFFICIAL_BRAND_PATTERN = /Sampige Semiconductors is a fabless semiconductor company/i
const RECRUITING_CTA_PATTERN =
  /engineer exploring an opportunity to join our talented team/i
const CONTACT_EMAIL_PATTERN = /mailto:info@sampigesemi\.com|info@sampigesemi\.com/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|myworkdayjobs|\/jobs\/[a-z0-9-]+|\/careers\/[a-z0-9-]+/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/[–—]/g, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&rsquo;|&#39;|&apos;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return (
    OFFICIAL_TITLE_PATTERN.test(page)
      || normalized.includes("sampige semiconductors - india's silicon, for the world")
  )
    && OFFICIAL_HERO_PATTERN.test(page)
    && OFFICIAL_BRAND_PATTERN.test(page)
    && RECRUITING_CTA_PATTERN.test(page)
    && CONTACT_EMAIL_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const extractSearchResults = () => []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'sampigesemiconductors',
  timeoutMs: 15000,
})

export const createSampigeSemiconductorsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error(
        'Sampige Semiconductors homepage no longer matches the verified official recruiting surface',
      )
    }

    if (hasPublicJobBoardSignal(html)) {
      throw new Error('Sampige Semiconductors homepage now appears to expose a public job board')
    }

    return extractSearchResults(html)
  },
})

export const run = async (options = {}) => createSampigeSemiconductorsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'sampigesemiconductors')
  }
}
