import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zeropointroboticsprivatelimited'
export const COMPANY = 'Zeropoint Robotics Private Limited'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy first-party careers surface was discoverable on July 13, 2026; the verified Zeropoint Robotics first-party homepage and careers-like routes all redirected to the same HugeDomains parked page for zeropointrobotics.com.'
export const PARKED_TARGET_URL =
  'https://www.hugedomains.com/domain_profile.cfm?d=zeropointrobotics.com'
export const CHECKED_ROUTE_URLS = [
  'http://zeropointrobotics.com/',
  'http://www.zeropointrobotics.com/',
  'http://zeropointrobotics.com/careers',
  'http://www.zeropointrobotics.com/careers',
  'http://zeropointrobotics.com/jobs',
  'http://www.zeropointrobotics.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isVerifiedParkedTargetUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.hostname.toLowerCase() === 'www.hugedomains.com'
      && url.pathname === '/domain_profile.cfm'
      && (url.searchParams.get('d') || '').toLowerCase() === 'zeropointrobotics.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedParkedPageSignal = ({ status, url, html } = {}) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return status === 200
    && isVerifiedParkedTargetUrl(url)
    && /<title>\s*ZeropointRobotics\.com is for sale \| HugeDomains\s*<\/title>/i.test(rawHtml)
    && normalized.includes('zeropointrobotics.com is for sale')
    && normalized.includes('buy now')
    && normalized.includes('hugedomains')
    && !hasPublicJobsSignal(rawHtml)
}

export const createZeropointRoboticsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const page = await fetchPage(routeUrl)

      if (hasPublicJobsSignal(page?.html)) {
        throw new Error(`Zeropoint Robotics Private Limited route now appears to expose public jobs: ${routeUrl}`)
      }

      if (!hasVerifiedParkedPageSignal(page)) {
        throw new Error(`Zeropoint Robotics Private Limited verified parked-domain route changed materially: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createZeropointRoboticsScraper().run(options)

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
