import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'redballoonaerospace'
export const COMPANY = 'Red Balloon Aerospace Private Limited'
export const HOMEPAGE_URL = 'https://www.red-balloon.space/'
export const JOBS_URL = 'https://www.red-balloon.space/jobs/'
export const CONTACT_URL = 'https://www.red-balloon.space/contact/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
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

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'red-balloon.space' || hostname === 'www.red-balloon.space'
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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('red balloon aerospace')
    && (
      normalized.includes('near-space infrastructure')
      || normalized.includes('high altitude stratospheric platforms')
    )
    && /href=["'][^"']*\/about\/?["']/i.test(page)
    && /href=["'][^"']*\/team\/?["']/i.test(page)
    && /href=["'][^"']*\/jobs\/?["']/i.test(page)
    && /href=["'][^"']*\/contact\/?["']/i.test(page)
}

export const hasOfficialJobsSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers')
    && normalized.includes('join us')
    && normalized.includes('submit')
    && (
      normalized.includes('loading jobs')
      || normalized.includes('select a position')
      || normalized.includes('choose one')
    )
    && (
      normalized.includes('upload resume / cv')
      || normalized.includes('resume/cv upload')
      || normalized.includes('upload resume')
    )
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('red balloon aerospace private limited')
    && normalized.includes('vijayawada')
    && normalized.includes('andhra pradesh')
}

export const isVerifiedSiteNotFoundShell = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()
  return Number(page?.status) === 404
    && normalizeWhitespace(String(page?.html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') === 'Site Not Found'
    && normalized.includes('site not found')
    && normalized.includes("you haven't deployed an app yet")
    && normalized.includes('you may have deployed an empty directory')
    && normalized.includes("we haven't finished setting it up yet")
}

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) {
      continue
    }

    const absoluteUrl = toAbsoluteUrl(href)
    if (!absoluteUrl || seen.has(absoluteUrl.toString())) {
      continue
    }

    const isSameHost = isFirstPartyUrl(absoluteUrl)
    const pathname = absoluteUrl.pathname.replace(/\/+$/, '') || '/'
    const isVerifiedJobsPage = absoluteUrl.toString() === JOBS_URL.replace(/\/+$/, '/')

    if (
      PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl.toString()))
      || (
        isSameHost
        && !isVerifiedJobsPage
        && (
          pathname.startsWith('/jobs/')
          || /\/(careers?|openings|vacanc(?:y|ies)|positions?)(\/|$)/i.test(pathname)
        )
      )
    ) {
      seen.add(absoluteUrl.toString())
      suspiciousLinks.push(absoluteUrl.toString())
    }
  }

  return suspiciousLinks
}

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || extractSuspiciousPublicJobLinks(html).length > 0

export const createRedBalloonAerospaceScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (isVerifiedSiteNotFoundShell(homepage)) {
      const jobsPage = await fetchPage(JOBS_URL)
      const contactPage = await fetchPage(CONTACT_URL)

      if (!isVerifiedSiteNotFoundShell(jobsPage) || !isVerifiedSiteNotFoundShell(contactPage)) {
        throw new Error('Red Balloon Aerospace verified site-not-found shell no longer matches across the first-party surface')
      }

      return []
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Red Balloon Aerospace verified official homepage no longer matches the known first-party surface')
    }

    const jobsPage = await fetchPage(JOBS_URL)
    if (jobsPage.status !== 200 || !hasOfficialJobsSignal(jobsPage.html)) {
      throw new Error('Red Balloon Aerospace verified jobs page no longer matches the known first-party surface')
    }
    if (hasUnexpectedPublicJobsSignal(jobsPage.html)) {
      throw new Error('Red Balloon Aerospace jobs page now exposes public jobs')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Red Balloon Aerospace verified contact page no longer matches the known first-party surface')
    }
    if (hasUnexpectedPublicJobsSignal(contactPage.html)) {
      throw new Error('Red Balloon Aerospace contact page now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createRedBalloonAerospaceScraper().run(options)

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
