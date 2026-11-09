import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'globalpayex'
export const COMPANY = 'Global PayEX'
export const HOMEPAGE_URL = 'https://globalpayex.com/'
export const CAREERS_HANDOFF_URL = 'https://globalpayex.com/careers/#jobs'
export const CAREERS_ROUTE_URL = 'https://globalpayex.com/careers/'
export const CAREERS_SLUG_API_URL = 'https://globalpayex.com/wp-json/wp/v2/pages?slug=careers&per_page=20'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])
const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob listings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview detail\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
  /\/job\/[a-z0-9-]+/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  const input = String(value ?? '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return input.replace(/\/$/, '')
  }
}

const defaultFetchPage = async (url, { manualRedirect = false } = {}) => {
  const response = await fetch(url, {
    redirect: manualRedirect ? 'manual' : 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /GlobalPayEX\s*-\s*AI Powered AP and AR Automation Software/i.test(rawHtml)
    && /Global PayEX/i.test(rawHtml)
    && /AI-Driven AP and AR Automation Software/i.test(normalized)
    && /Present,\s*Collect,\s*Pay,\s*Reconcile\.\s*Instantly\./i.test(normalized)
}

export const hasVerifiedCareersHandoff = (html) =>
  new RegExp(`href=["']${CAREERS_HANDOFF_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i')
    .test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedBrokenCareersRoute = (page = {}) => {
  const status = Number(page?.status)
  const location = normalizeComparableUrl(page?.headers?.location)
  const finalUrl = normalizeComparableUrl(page?.url)
  const homepageUrl = normalizeComparableUrl(HOMEPAGE_URL)

  if (REDIRECT_STATUS_CODES.has(status) && location === homepageUrl) {
    return true
  }

  return status === 200
    && finalUrl === homepageUrl
    && hasOfficialHomepageSignal(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const isAbsentCareersSlugPayload = (payload) =>
  Array.isArray(payload) && payload.length === 0

export const createGlobalPayexScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Global PayEX verified official homepage no longer matches the known public surface')
    }

    if (!hasVerifiedCareersHandoff(homepage.html)) {
      throw new Error('Global PayEX homepage no longer links to the verified broken careers handoff')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Global PayEX homepage now appears to expose a public jobs surface')
    }

    const careersRoute = await fetchPage(CAREERS_ROUTE_URL, { manualRedirect: true })
    if (!isVerifiedBrokenCareersRoute(careersRoute)) {
      if (hasPublicJobsSignal(careersRoute.html)) {
        throw new Error('Global PayEX careers route changed materially or now exposes public jobs')
      }

      throw new Error('Global PayEX careers route no longer matches the verified broken first-party handoff')
    }

    const careersSlugPayload = await fetchJson(CAREERS_SLUG_API_URL)
    if (!isAbsentCareersSlugPayload(careersSlugPayload)) {
      throw new Error('Global PayEX careers slug API no longer matches the verified absent-page state')
    }

    return []
  },
})

export const run = async (options = {}) => createGlobalPayexScraper().run(options)

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
