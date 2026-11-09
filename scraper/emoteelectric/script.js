import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'emoteelectric'
export const COMPANY = 'E-Mote Electric'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy public jobs surface was discoverable on July 13, 2026; the verified first-party homepage at www.emoteelectric.in was a marketing site and the first-party /careers and /jobs routes returned a stable 404 shell.'
export const HOMEPAGE_URL = 'https://www.emoteelectric.in/'
export const CAREERS_URLS = [
  'https://www.emoteelectric.in/careers',
  'https://www.emoteelectric.in/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_REQUIRED_SIGNALS = [
  'emote electric',
  'surge is coming soon',
  '10+ years of r&d',
  'winner nasscom design award 2018',
  'info@emoteelectric.com',
  '+91 99521 67234',
  'all rights reserved',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/[â€™â€˜]/g, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return HOMEPAGE_REQUIRED_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title>\s*emote electric\s*\|\s*geared electric motorcycle\s*\|\s*india\s*<\/title>/i.test(rawHtml)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (status, html) => {
  const normalized = normalizeText(html)

  return status === 404
    && normalized.includes('404')
    && (normalized.includes('could not be found') || normalized.includes("we can't find this page"))
    && normalized.includes('emote electric')
}

export const createEmoteElectricScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('E-Mote Electric verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('E-Mote Electric homepage now appears to expose a public jobs surface')
    }

    for (const careersUrl of CAREERS_URLS) {
      const careersPage = await fetchPage(careersUrl)

      if (hasPublicJobsSignal(careersPage.html)) {
        throw new Error(`E-Mote Electric careers route ${careersUrl} now appears to expose a public jobs surface`)
      }

      if (!isVerifiedMissingCareersRoute(careersPage.status, careersPage.html)) {
        throw new Error(`E-Mote Electric verified missing careers route changed materially: ${careersUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEmoteElectricScraper().run(options)

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
