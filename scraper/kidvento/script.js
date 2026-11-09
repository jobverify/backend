import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runNativeInventory } from './native.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kidvento'
export const COMPANY = 'Kidvento Education and Research Private Limited'
export const HOMEPAGE_URL = 'https://www.kidvento.com/'
export const CAREERS_URL = 'https://www.kidvento.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'shaping the future of learning through innovative products',
  'transforming education through innovation',
  'kidvento is a leading ed-tech company on a mission to transform k-12 education',
  '850+ schools',
  '500,000 students',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bjob posting\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
]

const SUSPICIOUS_HOST_PATTERN =
  /(greenhouse|job-boards\.greenhouse|lever|workday|myworkdayjobs|smartrecruiters|ashby|workable|darwinbox|icims|successfactors|taleo|jobvite|recruitcrm|teamtailor|oraclecloud|dayforce|jobs\.)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
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
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
    && /<title>\s*home\s*<\/title>/i.test(String(html ?? ''))
    && /og:url"\s+content="https:\/\/www\.kidvento\.com\/"/i.test(String(html ?? ''))
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const hasStableCareersChrome =
    rawHtml.toLowerCase().includes('aria-selected="true" href="/careers"')
    && /<title>\s*careers\s*<\/title>/i.test(rawHtml)
    && /og:url"\s+content="https:\/\/www\.kidvento\.com\/careers"/i.test(rawHtml)
  const hasVerifiedOfficeMarkers =
    normalized.includes('bengaluru')
    && normalized.includes('mysuru')
    && (normalized.includes('global skill-ed conclave') || normalized.includes('dubai'))

  return hasStableCareersChrome
    && normalized.includes('kidvento')
    && hasVerifiedOfficeMarkers
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isSamePage = absoluteUrl === CAREERS_URL || `${absoluteUrl}/` === CAREERS_URL
    const exposesFirstPartyJobPath =
      (url.hostname === 'www.kidvento.com' || url.hostname === 'kidvento.com')
      && /\/(jobs?|job-openings?|openings?|vacanc(?:y|ies))(\/|$)/i.test(pathname)
      && !isSamePage

    if (SUSPICIOUS_HOST_PATTERN.test(url.hostname) || exposesFirstPartyJobPath) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const createKidventoScraper = () => ({
  async run(options = {}) { return runNativeInventory(options) },
})

export const run = async (options = {}) => createKidventoScraper().run(options)

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
