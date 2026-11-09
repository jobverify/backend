import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'royalatlas'
export const COMPANY = 'Royal Atlas'
export const HOMEPAGE_URL = 'https://royal-atlas.com/'
export const CAREERS_URL = 'https://royal-atlas.com/careers/'
export const CONTACT_URL = 'https://royal-atlas.com/contact-us/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_CAREERS_EMAIL = 'hr@royal-atlas.com'
const VERIFIED_CONTACT_EMAIL = 'info@royal-atlas.com'

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

const decodeCloudflareEmail = (encodedValue) => {
  const encoded = String(encodedValue ?? '').trim()
  if (!/^[a-f0-9]+$/i.test(encoded) || encoded.length < 4 || encoded.length % 2 !== 0) {
    return null
  }

  try {
    const key = Number.parseInt(encoded.slice(0, 2), 16)
    let decoded = ''

    for (let index = 2; index < encoded.length; index += 2) {
      const value = Number.parseInt(encoded.slice(index, index + 2), 16)
      decoded += String.fromCharCode(value ^ key)
    }

    return decoded.toLowerCase()
  } catch {
    return null
  }
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'royal-atlas.com' || hostname === 'www.royal-atlas.com'
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
  const page = String(html ?? '')
  const cloudflareProtectedEmail = page.match(/data-cfemail=["']([a-f0-9]+)["']/i)?.[1]
  const decodedCloudflareEmail = decodeCloudflareEmail(cloudflareProtectedEmail)
  if (decodedCloudflareEmail) {
    return decodedCloudflareEmail
  }

  const match = page.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)
  return match?.[0]?.toLowerCase() ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('building a strong foundation for the future')
    && normalized.includes('about royal atlas')
    && normalized.includes('royal atlas general contracting')
    && /href=["'][^"']*\/careers\/["']/i.test(page)
    && /href=["'][^"']*\/contact-us\/["']/i.test(page)
    && normalized.includes('earthwork, aggregates supply & heavy equipment rentals')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('join our team')
    && normalized.includes('our people are our greatest asset')
    && normalized.includes('please send your resume and a cover letter to')
    && extractApplicationEmail(html) === VERIFIED_CAREERS_EMAIL
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('write to us')
    && normalized.includes('office no 604, regal tower')
    && normalized.includes('+9714 883 8384')
    && normalized.includes('jebel ali freezone - dubai')
    && extractApplicationEmail(html) === VERIFIED_CONTACT_EMAIL
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

export const createRoyalAtlasScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Royal Atlas verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Royal Atlas verified careers page no longer matches the known first-party surface')
    }
    if (extractApplicationEmail(careersPage.html) !== VERIFIED_CAREERS_EMAIL) {
      throw new Error('Royal Atlas verified email-only careers surface changed')
    }
    if (hasUnexpectedPublicJobsSignal(careersPage.html)) {
      throw new Error('Royal Atlas careers page now exposes public jobs')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Royal Atlas verified contact page no longer matches the known first-party surface')
    }
    if (hasUnexpectedPublicJobsSignal(contactPage.html)) {
      throw new Error('Royal Atlas contact page now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createRoyalAtlasScraper().run(options)

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
