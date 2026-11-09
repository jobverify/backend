import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'volvoericsson'
export const COMPANY = 'Volvo-Ericsson'
export const VOLVO_CAREERS_URL = 'https://www.volvogroup.com/en/careers.html'
export const VOLVO_JOBS_URL = 'https://jobs.volvogroup.com/'
export const ERICSSON_CAREERS_URL = 'https://jobs.ericsson.com/careers'
export const OFFICIAL_CAREER_URLS = [
  VOLVO_CAREERS_URL,
  ERICSSON_CAREERS_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VOLVO_SIGNAL_PATTERNS = [
  /<title>\s*Volvo Group careers\s*\|\s*Volvo Group\s*<\/title>/i,
  /\bGo to job portal\b/i,
  /Would you like to work at Volvo Group\?/i,
  /Explore current job openings\./i,
]

const ERICSSON_SIGNAL_PATTERNS = [
  /<title>\s*Careers at Ericsson\s*<\/title>/i,
  /"domain"\s*:\s*"ericsson\.com"/i,
  /"company_name"\s*:\s*"Ericsson"/i,
  /\/careers\/join\?domain=ericsson\.com/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const hasVolvoCareersSignal = (html) => VOLVO_SIGNAL_PATTERNS.every((pattern) => (
  pattern.test(String(html ?? ''))
))

const normalizeVolvoJobsUrl = (value) => {
  try {
    const url = new URL(value)
    if (url.origin !== 'https://jobs.volvogroup.com') {
      return url.toString()
    }

    if (/^\/(?:en\/?)?$/.test(url.pathname) || url.pathname === '/') {
      return 'https://jobs.volvogroup.com/'
    }

    return url.toString()
  } catch {
    return null
  }
}

export const extractVolvoJobsUrl = (html) => {
  const match = String(html ?? '').match(/href="([^"]*jobs\.volvogroup\.com[^"]*)"/i)
  if (!match) return null

  try {
    return normalizeVolvoJobsUrl(new URL(match[1], VOLVO_CAREERS_URL).toString())
  } catch {
    return null
  }
}

export const hasEricssonCareersSignal = (html) => ERICSSON_SIGNAL_PATTERNS.every((pattern) => (
  pattern.test(normalizeWhitespace(html))
))

const volvoSurfaceMentionsEricsson = (html) => /jobs\.ericsson\.com|Careers at Ericsson|"company_name"\s*:\s*"Ericsson"/i
  .test(normalizeWhitespace(html))

const ericssonSurfaceMentionsVolvo = (html) => /jobs\.volvogroup\.com|Volvo Group careers|Would you like to work at Volvo Group\?/i
  .test(normalizeWhitespace(html))

export const hasDistinctOfficialCareerSurfaces = ({ volvoCareersHtml, ericssonCareersHtml }) => (
  hasVolvoCareersSignal(volvoCareersHtml)
  && extractVolvoJobsUrl(volvoCareersHtml) === VOLVO_JOBS_URL
  && hasEricssonCareersSignal(ericssonCareersHtml)
  && !volvoSurfaceMentionsEricsson(volvoCareersHtml)
  && !ericssonSurfaceMentionsVolvo(ericssonCareersHtml)
)

export const createVolvoEricssonScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const volvoCareersHtml = await fetchText(VOLVO_CAREERS_URL)
    if (!hasVolvoCareersSignal(volvoCareersHtml) || extractVolvoJobsUrl(volvoCareersHtml) !== VOLVO_JOBS_URL) {
      throw new Error('The verified Volvo Group careers surface no longer matches the known public handoff')
    }

    const ericssonCareersHtml = await fetchText(ERICSSON_CAREERS_URL)
    if (!hasEricssonCareersSignal(ericssonCareersHtml)) {
      throw new Error('The verified Ericsson careers surface no longer matches the known public portal')
    }

    if (!hasDistinctOfficialCareerSurfaces({ volvoCareersHtml, ericssonCareersHtml })) {
      throw new Error('The Volvo-Ericsson source no longer matches the verified distinct-company sentinel')
    }

    return []
  },
})

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: VOLVO_CAREERS_URL,
    alternateCareerPages: [ERICSSON_CAREERS_URL],
    adapter: 'script',
    atsPlatform: 'official-company-sites-no-standalone-volvo-ericsson-surface',
    countryFilter: 'India',
  },
})

export const run = async (options = {}) => createVolvoEricssonScraper().run(options)

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
