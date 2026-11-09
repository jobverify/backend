import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'homeideastechnologies'
export const COMPANY = 'Home Ideas Technologies'
export const HOMEPAGE_URL = 'https://www.homeideastechnologies.com/'
export const CHECKED_ROUTE_URLS = [
  'https://www.homeideastechnologies.com/careers',
  'https://www.homeideastechnologies.com/careers/',
  'https://www.homeideastechnologies.com/career',
  'https://www.homeideastechnologies.com/career/',
  'https://www.homeideastechnologies.com/jobs',
  'https://www.homeideastechnologies.com/jobs/',
  'https://www.homeideastechnologies.com/job',
  'https://www.homeideastechnologies.com/job/',
  'https://www.homeideastechnologies.com/join-us',
  'https://www.homeideastechnologies.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bcareers?\b/i,
  /\bjoin us\b/i,
]

export const extractBundlePath = (html) => {
  const match = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+\.js)["']/i.exec(
    String(html ?? ''),
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Home Ideas Technologies\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']theme-color["'][^>]+content=["']#efd216["']/i.test(rawHtml)
    && /homeideas-bird-20260603/i.test(rawHtml)
    && /<link[^>]+rel=["']manifest["'][^>]+href=["']\/site\.webmanifest\?v=homeideas-bird-20260603["']/i.test(rawHtml)
    && /<div id="root"><\/div>/i.test(rawHtml)
    && normalized === 'Home Ideas Technologies'
    && extractBundlePath(rawHtml) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const routeMatchesVerifiedShell = (html, bundlePath) =>
  hasOfficialHomepageSignal(html)
  && extractBundlePath(html) === bundlePath
  && !hasPublicJobsSignal(html)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHomeIdeasTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Home Ideas Technologies verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Home Ideas Technologies homepage now appears to expose public jobs')
    }

    const bundlePath = extractBundlePath(homepageHtml)

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)

      if (!routeMatchesVerifiedShell(routeHtml, bundlePath)) {
        throw new Error('Home Ideas Technologies checked first-party route changed materially or now exposes public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createHomeIdeasTechnologiesScraper().run(options)

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
