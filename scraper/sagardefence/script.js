import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sagardefence'
export const COMPANY = 'Sagar Defence Engineering'
export const HOMEPAGE_URL = 'https://www.sagardefence.com/'
export const CAREERS_URL = 'https://www.sagardefence.com/careers/'
export const CONTACT_URL = 'https://www.sagardefence.com/contact/'

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
  /linkedin\.com\/jobs/i,
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
  return hostname === 'sagardefence.com' || hostname === 'www.sagardefence.com'
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

export const extractApplicationEmail = (html) => {
  const match = String(html ?? '').match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return match?.[0]?.toLowerCase() ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('sagar defence engineering')
    && /href=["'][^"']*\/careers\/["']/i.test(page)
    && /href=["'][^"']*\/about-us\/["']/i.test(page)
    && /href=["'][^"']*\/contact\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers')
    && normalized.includes('careers@sagardefence.com')
    && (
      normalized.includes('send your resume and your goals to careers@sagardefence.com')
      || normalized.includes("send us your resume and goals to careers@sagardefence.com")
    )
    && (
      normalized.includes('next-generation defence systems')
      || normalized.includes('challenging and conducive work environment')
      || normalized.includes('strength of a company lies in its human resources')
    )
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('contact')
    && normalized.includes('info@sagardefence.com')
    && normalized.includes('pune')
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
    const isVerifiedCareersPage = absoluteUrl.toString() === CAREERS_URL.replace(/\/+$/, '/')

    if (
      PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(absoluteUrl.toString()))
      || (
        isSameHost
        && !isVerifiedCareersPage
        && (
          pathname.startsWith('/careers/')
          || /\/(jobs?|openings|vacanc(?:y|ies)|positions?)(\/|$)/i.test(pathname)
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

export const createSagarDefenceScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Sagar Defence verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Sagar Defence verified careers page no longer matches the known first-party surface')
    }
    if (extractApplicationEmail(careersPage.html) !== 'careers@sagardefence.com') {
      throw new Error('Sagar Defence verified email-only careers surface changed')
    }
    if (hasUnexpectedPublicJobsSignal(careersPage.html)) {
      throw new Error('Sagar Defence careers page now exposes public jobs')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Sagar Defence verified contact page no longer matches the known first-party surface')
    }
    if (hasUnexpectedPublicJobsSignal(contactPage.html)) {
      throw new Error('Sagar Defence contact page now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createSagarDefenceScraper().run(options)

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
