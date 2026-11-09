import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kaizeninstitute'
export const COMPANY = 'Kaizen Institute'
export const HOMEPAGE_URL = 'https://kaizen.com/in/'
export const CAREERS_URL = 'https://kaizen.com/in/careers-in/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'Excellence And Lean Consulting KI India| Kaizen',
  'Kaizen Institute India provides lean consulting services to boost business performance',
  'Operational Excellence Consulting | Kaizen Institute',
]

const CAREERS_PAGE_SIGNALS = [
  'Career Opportunities At Kaizen Institute India',
  'Find your place at Kaizen Institute',
  'Send us an e-mail to join our team',
  'in@kaizen.com',
  'Who works with Kaizen Institute',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
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
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/gi, "'")
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
      // The careers server can send a malformed gzip body. Its identity
      // response serves the same official page without decompression errors.
      'Accept-Encoding': 'identity',
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
  const normalized = normalizeWhitespace(html)
  return HOMEPAGE_SIGNALS.every((signal) => normalized.includes(signal))
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return CAREERS_PAGE_SIGNALS.every((signal) => normalized.includes(signal))
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
    const isHomepage = absoluteUrl === HOMEPAGE_URL || `${absoluteUrl}/` === HOMEPAGE_URL
    const isCareersPage = absoluteUrl === CAREERS_URL || `${absoluteUrl}/` === CAREERS_URL
    const isKnownFirstPartyPage = isHomepage || isCareersPage
    const exposesFirstPartyJobPath =
      url.hostname === 'kaizen.com'
      && /\/(jobs?|job-openings?|openings?|vacanc(?:y|ies))(\/|$)/i.test(pathname)
      && !isKnownFirstPartyPage

    if (SUSPICIOUS_HOST_PATTERN.test(url.hostname) || exposesFirstPartyJobPath) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

const assertStablePage = ({
  page,
  hasOfficialSignal,
  label,
}) => {
  if (page.status !== 200 || !hasOfficialSignal(page.html)) {
    throw new Error(`Kaizen Institute verified official ${label} no longer matches the known public surface`)
  }

  if (hasPublicJobsSignal(page.html)) {
    throw new Error(`Kaizen Institute ${label} now appears to expose a public jobs surface`)
  }

  const suspiciousLinks = extractSuspiciousPublicJobLinks(page.html)
  if (suspiciousLinks.length > 0) {
    throw new Error(`Kaizen Institute ${label} now exposes public job links`)
  }
}

export const createKaizenInstituteScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertStablePage({
      page: homepage,
      hasOfficialSignal: hasOfficialHomepageSignal,
      label: 'homepage',
    })

    const careersPage = await fetchPage(CAREERS_URL)
    assertStablePage({
      page: careersPage,
      hasOfficialSignal: hasOfficialCareersSignal,
      label: 'careers page',
    })

    return []
  },
})

export const run = async (options = {}) => createKaizenInstituteScraper().run(options)

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
