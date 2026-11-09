import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'stations'
export const COMPANY = 'Station-S'
export const HOMEPAGE_URL = 'https://station-s.com/'
export const CAREERS_URL = 'https://station-s.com/careers.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /freshteam/i,
  /darwinbox/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const fetchWithTimeout = async (url, options, consumeResponse) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  timeout.unref?.()

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    return consumeResponse(response)
  } finally {
    clearTimeout(timeout)
  }
}

const defaultFetchText = async (url) => {
  return fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }, async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`)
    }

    return response.text()
  })
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('station-s')
    && (
      normalized.includes('the startup studio')
      || normalized.includes('t h e s t a r t u p s t u d i o')
    )
    && normalized.includes("let's get your venture started in sri city")
    && normalized.includes('sri city, ap, india')
    && /careers\.php/i.test(String(html ?? ''))
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersShellSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return /station-s/i.test(normalized)
    && /join our team/i.test(normalized)
    && /building the future of operations technology/i.test(normalized)
    && /all categories/i.test(normalized)
    && /job title category experience location/i.test(normalized)
    && !hasPublicJobsSignal(html)
    && !/job_details?\.php/i.test(String(html ?? ''))
  }

export const createStationSScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Station-S verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Station-S homepage now appears to expose a public jobs surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('Station-S careers shell changed materially or now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createStationSScraper().run(options)

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
