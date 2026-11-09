import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nativeorange'
export const COMPANY = 'Native orange'
export const VERIFIED_ON = '2026-08-13'
export const HOMEPAGE_URL = 'https://nativeorange.ai/'
export const ABOUT_URL = 'https://nativeorange.ai/about/'
export const CONTACT_URL = 'https://nativeorange.ai/contact/'
export const CAREERS_PAGE_URL = 'https://nativeorange.ai/careers/'
export const JOBS_PAGE_URL = 'https://nativeorange.ai/jobs/'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  CAREERS_PAGE_URL,
  JOBS_PAGE_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_JOB_PATH_PATTERN =
  /(?:^|\/)(careers?|jobs?|job|openings?|vacancies?|join-us|work-with-us)(?:\/|$)/i

const RAW_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitee/i,
  /breezy\.hr/i,
  /linkedin\.com\/jobs/i,
]

const VISIBLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
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

const toComparableUrl = (value) => {
  const absoluteUrl = value instanceof URL ? value : toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  const normalizedPathname = absoluteUrl.pathname.replace(/\/+$/, '') || '/'
  return `${absoluteUrl.origin}${normalizedPathname}`
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'nativeorange.ai' || hostname.endsWith('.nativeorange.ai')
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

const hasLegacyOfficialHomepageSignal = (normalized) =>
  /Nativeorange - AI-Powered Insurance Solutions \| Automated Underwriting/i.test(normalized)
  && normalized.includes('AI-Powered Insurance Technology')
  && normalized.includes('The Future of Insurance AI')
  && normalized.includes('Google Scale Partner')
  && normalized.includes('GUIDEWIRE Vanguard Program')

const hasCurrentOfficialHomepageSignal = (normalized) =>
  /Nativeorange - Agentic Underwriting to Claims on One Platform/i.test(normalized)
  && normalized.includes('One platform for the entire insurance lifecycle')
  && normalized.includes('AI-powered solutions for carriers and agencies')
  && normalized.includes('A connected suite of agentic-AI products across the value chain')
  && normalized.includes('Google Scale Startup')
  && normalized.includes('GUIDEWIRE Insurtech Vanguard')

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return hasLegacyOfficialHomepageSignal(normalized)
    || hasCurrentOfficialHomepageSignal(normalized)
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About Nativeorange')
    && normalized.includes('Pioneering intelligent AI solutions')
    && normalized.includes('Join Our Team')
    && normalized.includes('leverage Agentic AI tools')
    && normalized.includes('AWS, Google, and Microsoft')
    && normalized.includes('Apply Now')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Contact Nativeorange')
    && normalized.includes('Contact Us')
    && normalized.includes('Schedule a Demo')
    && normalized.includes('sales@nativeorange.ai')
    && normalized.includes('+1 (925) 399-6005')
    && normalized.includes('Our team is ready to help you transform your business with cutting-edge technologies.')
    && normalized.includes('Fill out the form below')
}

export const hasFirstPartyJobsPathLink = (html, { currentUrl = null } = {}) => {
  const currentComparableUrl = toComparableUrl(currentUrl)

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (currentComparableUrl && toComparableUrl(absoluteUrl) === currentComparableUrl) {
      continue
    }

    if (FIRST_PARTY_JOB_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const extractApplyHandoffUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, text] = match
    const normalizedText = normalizeWhitespace(text).toLowerCase()
    if (!normalizedText.includes('apply now')) {
      continue
    }

    const absoluteUrl = toAbsoluteUrl(href)
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    return absoluteUrl.toString()
  }

  return null
}

export const hasPublicJobsSignal = (html, options = {}) =>
  hasFirstPartyJobsPathLink(html, options)
  || RAW_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || VISIBLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizeWhitespace(html)))

export const isVerifiedNoJobsRoute = (page = {}) =>
  Number(page.status) === 200
  && NO_PUBLIC_JOB_ROUTE_URLS.includes(page.url)
  && hasOfficialHomepageSignal(page.html)
  && !hasPublicJobsSignal(page.html, { currentUrl: page.url })

export const createNativeOrangeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Native orange verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html, { currentUrl: homepage.url })) {
      throw new Error('Native orange homepage now exposes public jobs')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('Native orange verified about page no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(about.html, { currentUrl: about.url })) {
      throw new Error('Native orange about page now exposes public jobs')
    }
    if (extractApplyHandoffUrl(about.html) !== CONTACT_URL) {
      throw new Error('Native orange about page no longer hands candidates to the verified contact surface')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Native orange verified contact page no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(contact.html, { currentUrl: contact.url })) {
      throw new Error('Native orange contact page now exposes public jobs')
    }

    for (const url of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(url)
      if (!isVerifiedNoJobsRoute(routePage)) {
        throw new Error('Native orange verified no-jobs route no longer matches the known marketing shell')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createNativeOrangeScraper().run(options)

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
