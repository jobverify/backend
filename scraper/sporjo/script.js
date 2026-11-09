import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sporjo'
export const COMPANY = 'Sporjo'
export const CAREERS_URL = 'https://www.sporjo.com/'
export const LANDER_URL = new URL('/lander', CAREERS_URL).toString()
export const DISPOSITION = 'verified-exact-name-public-surface-fail-closed-sentinel'

const ROOT_REDIRECT_PATTERNS = [
  /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i,
]

const PARKED_LANDER_PATTERNS = [
  /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i,
  /_trfd\.push\(\{ap:["']parking["']\}\)/i,
  /parking-lander\/static\/js\/main/i,
  /<div id=["']root["']><\/div>/i,
]

const TRUSTED_ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /trakstar\.com/i,
  /teamtailor\.com/i,
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/careers(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
]

const normalizeText = (value = '') =>
  String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )
  const urls = []

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(rawValue, pageUrl))
    } catch {
      // Ignore malformed URLs and keep the sentinel fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const assertVerifiedRootRedirectShell = (html = '') => {
  if (ROOT_REDIRECT_PATTERNS.every((pattern) => pattern.test(String(html)))) return

  throw new Error(
    'Sporjo verified public domain shell changed: expected the root page to redirect visitors to /lander.',
  )
}

const assertVerifiedParkedLanderShell = (html = '') => {
  if (PARKED_LANDER_PATTERNS.every((pattern) => pattern.test(String(html)))) return

  throw new Error(
    'Sporjo verified parked-domain shell changed materially on the exact company domain.',
  )
}

const assertNoPublicListingsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Sporjo public company surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsBoardUrl = linkedUrls.find((url) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )

  if (atsBoardUrl) {
    throw new Error(
      `Sporjo public company surface now exposes a public listings surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  if (sameOriginJobUrl) {
    throw new Error(
      `Sporjo public company surface now exposes a public listings surface via ${sameOriginJobUrl.toString()}.`,
    )
  }
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createSporjoScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const rootHtml = await fetchHtml(CAREERS_URL)
    assertVerifiedRootRedirectShell(rootHtml)
    assertNoPublicListingsSurface(rootHtml, CAREERS_URL)

    const landerHtml = await fetchHtml(LANDER_URL)
    assertVerifiedParkedLanderShell(landerHtml)
    assertNoPublicListingsSurface(landerHtml, LANDER_URL)

    return []
  },
})

export const run = async (options = {}) => createSporjoScraper().run(options)

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
