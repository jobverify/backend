import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nxtsyncpvtltd'
export const COMPANY = 'Nxtsync Pvt Ltd'
export const HOMEPAGE_URL = 'https://nxtsync.in/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://nxtsync.in/careers',
  'https://nxtsync.in/career',
  'https://nxtsync.in/jobs',
  'https://nxtsync.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bwe are hiring\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'nxtsync.in' || hostname === 'www.nxtsync.in'
  } catch {
    return false
  }
}

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
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const markup = page.toLowerCase()

  return normalized.toLowerCase().includes('nxtsync - courses & internships')
    && /\+91\s*63026\s*55033/i.test(normalized)
    && markup.includes('https://lms.nxtsync.in/')
    && markup.includes('https://linkedin.com/company/nxtsync')
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl.href)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) =>
  isFirstPartyUrl(page.url || HOMEPAGE_URL)
  && Number(page.status) === 404
  && /404\s+Not\s+Found|requested URL was not found on this server/i.test(String(page.html ?? ''))
  && !hasPublicJobsSignal(page.html)

const isSucuriAccessChallengePage = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(page.status) === 307
    && isFirstPartyUrl(page.url || HOMEPAGE_URL)
    && /you are being redirected/i.test(html)
    && normalized.includes('javascript is required')
    && html.toLowerCase().includes('sucuri_cloudproxy_js')
    && !hasPublicJobsSignal(html)
}

const createAccessChallengeError = () => Object.assign(
  new Error('Nxtsync official site is blocked by an upstream Sucuri access challenge'),
  {
    code: 'NXTSYNC_ACCESS_CHALLENGE',
    failureKind: 'blocked_or_access_denied',
    upstreamOutage: true,
    softFailure: true,
    abortRetries: true,
  },
)

export const createNxtsyncScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (isSucuriAccessChallengePage(homepage)) {
      throw createAccessChallengeError()
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Nxtsync verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Nxtsync homepage now appears to expose a public jobs surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Nxtsync homepage now exposes a first-party careers or jobs link')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (isSucuriAccessChallengePage(routePage)) {
        throw createAccessChallengeError()
      }

      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error('Nxtsync careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNxtsyncScraper().run(options)

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
