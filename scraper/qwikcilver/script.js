import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'qwikcilver'
export const COMPANY = 'Qwikcilver'
export const VERIFIED_SURFACE_URL = 'https://www.pinelabs.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_BOARD_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '-')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&#x27;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? '')
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

export const hasVerifiedParentCareersSurface = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const title = extractTitle(rawHtml)

  return title === 'Careers at Pine Labs - Join Our Fintech Innovation Team'
    && rawHtml.includes(
      'Explore exciting career opportunities at Pine Labs. Be part of a dynamic fintech company driving innovation in digital payments and merchant solutions.',
    )
    && /href=["']https:\/\/www\.pinelabs\.com\/careers["']/i.test(rawHtml)
    && rawHtml.includes('Pine Labs Logo')
    && rawHtml.includes('/contact-sales')
    && normalized.includes('Careers at Pine Labs')
    && /Join our fintech innovation team\.?/i.test(normalized)
}

export const hasQwikcilverJobsSignal = (html) =>
  /\bQwikcilver\b/i.test(String(html ?? ''))

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOB_BOARD_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createQwikcilverScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const verifiedSurface = await fetchPage(VERIFIED_SURFACE_URL)

    if (verifiedSurface.status !== 200 || !hasVerifiedParentCareersSurface(verifiedSurface.html)) {
      throw new Error('Qwikcilver verified Pine Labs careers surface no longer matches the known first-party page')
    }

    if (hasQwikcilverJobsSignal(verifiedSurface.html)) {
      throw new Error('Qwikcilver now appears on the verified Pine Labs careers surface')
    }

    if (hasPublicJobBoardSignal(verifiedSurface.html)) {
      throw new Error('Qwikcilver verified parent careers surface now exposes a public job board signal')
    }

    return []
  },
})

export const run = async (options = {}) => createQwikcilverScraper().run(options)

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
