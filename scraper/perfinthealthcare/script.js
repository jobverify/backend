import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'perfinthealthcare'
export const COMPANY = 'Perfint Healthcare'
export const HOMEPAGE_URL = 'https://www.perfinthealthcare.com/'
export const CAREERS_URL = 'https://www.perfinthealthcare.com/careers.php'
export const MISSING_ROUTE_URLS = [
  'https://www.perfinthealthcare.com/careers',
  'https://www.perfinthealthcare.com/careers/',
  'https://www.perfinthealthcare.com/career.php',
  'https://www.perfinthealthcare.com/jobs',
  'https://www.perfinthealthcare.com/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\bposition title\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&#39;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/[â€˜â€™]/g, "'")
    .replace(/[â€“â€”]/g, '-')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) =>
  withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }, {
    attempts: 3,
    baseDelayMs: 2000,
    label: SOURCE,
  })

export const extractApplicationEmail = (html) => {
  const match = String(html ?? '').match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  )

  return match?.[0]?.toLowerCase() ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*PERFINT HEALTHCARE\s*<\/title>/i.test(page)
    && /href=["']careers\.php["']/i.test(page)
    && normalized.includes('perfint healthcare is a world leader in planning and targeting solutions for image guided interventional procedures')
    && normalized.includes('plot no.78, annai indira nagar 1st street')
    && normalized.includes('info@perfinthealthcare.com')
}

export const hasVerifiedCareersLink = (html) =>
  /href=["']careers\.php["']/i.test(String(html ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*PERFINT HEALTHCARE\s*<\/title>/i.test(page)
    && normalized.includes('careers')
    && normalized.includes('why perfint?')
    && normalized.includes('rising leader in medical technology')
    && normalized.includes('global culture and growing opportunities')
    && normalized.includes('total rewards')
    && normalized.includes('want to work with us?')
}

export const hasEmailOnlyCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return extractApplicationEmail(html) === 'hr@perfinthealthcare.com'
    && normalized.includes('write to us at hr@perfinthealthcare.com')
    && normalized.includes('warning message')
    && normalized.includes('not recruiting for our us operations at this time')
}

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]

    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) {
      continue
    }

    let absoluteUrl
    try {
      absoluteUrl = new URL(href, CAREERS_URL).toString()
    } catch {
      continue
    }

    if (seen.has(absoluteUrl)) {
      continue
    }

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isSameHost = ['perfinthealthcare.com', 'www.perfinthealthcare.com'].includes(url.hostname)
    const isVerifiedCareersPage =
      absoluteUrl === CAREERS_URL || absoluteUrl === CAREERS_URL.replace(/\/+$/, '')
    const isSuspiciousSameHostPath =
      isSameHost
      && (
        (pathname.startsWith('/careers/') && pathname !== '/careers')
        || /\/(jobs?|current-openings|openings|vacanc(?:y|ies)|positions?)(\/|$)/i.test(pathname)
        || pathname === '/careers'
        || pathname === '/career.php'
      )

    if (
      PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl))
      || (isSuspiciousSameHostPath && !isVerifiedCareersPage)
    ) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || extractSuspiciousPublicJobLinks(html).length > 0

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return status === 404
    && /<title>\s*404 - File or directory not found\.\s*<\/title>/i.test(page)
    && normalized.includes('server error')
    && normalized.includes('404 - file or directory not found.')
    && normalized.includes('the resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.')
  }

export const createPerfintHealthcareScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Perfint Healthcare verified official homepage no longer matches the known first-party surface')
    }

    if (!hasVerifiedCareersLink(homepage.html)) {
      throw new Error('Perfint Healthcare homepage no longer links to the verified first-party careers page')
    }

    if (hasUnexpectedPublicJobsSignal(homepage.html)) {
      throw new Error('Perfint Healthcare homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Perfint Healthcare verified first-party careers surface no longer matches the known public page')
    }

    if (!hasEmailOnlyCareersSignal(careersPage.html)) {
      throw new Error('Perfint Healthcare verified email-only careers surface changed')
    }

    if (hasUnexpectedPublicJobsSignal(careersPage.html)) {
      throw new Error('Perfint Healthcare verified email-only careers surface drifted to a public jobs surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('Perfint Healthcare missing jobs routes changed materially')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPerfintHealthcareScraper().run(options)

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
