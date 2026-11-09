import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'suprdaily'
export const COMPANY = 'Supr Daily'
export const CAREERS_URL = 'https://www.suprdaily.com/'
export const VERIFIED_REDIRECT_HOST = 'www.keluarantotomacau.it.com'
export const DISPOSITION = 'verified-company-domain-redirect-drift-sentinel'

const VERIFIED_REDIRECT_TITLE_PATTERN = /Keluaran Toto Macau 2026/i

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
]

const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/careers?(?:\/|$)/i,
  /^\/jobs?(?:\/|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/join-us(?:\/|$)/i,
  /^\/work-with-us(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeText = (value = '') =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
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
      urls.push(new URL(decodeEntities(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the contract fail-closed.
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

const isVerifiedOffDomainRedirect = (page = {}) => {
  if (Number(page.status) !== 200) return false

  try {
    const requestHost = new URL(CAREERS_URL).hostname
    const finalUrl = new URL(page.url || CAREERS_URL)
    if (finalUrl.hostname === requestHost) return false
    if (finalUrl.hostname !== VERIFIED_REDIRECT_HOST) return false
  } catch {
    return false
  }

  return VERIFIED_REDIRECT_TITLE_PATTERN.test(String(page.html ?? ''))
}

const assertVerifiedContract = (page = {}) => {
  if (isVerifiedOffDomainRedirect(page)) return

  throw new Error(
    'Supr Daily verified company-domain redirect drift changed; review for a real first-party scraper.',
  )
}

const assertNoTrustedJobsSurface = (html = '', pageUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Supr Daily redirected surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const careersOrigin = new URL(pageUrl).origin
  const careersPath = normalizePathname(new URL(pageUrl).pathname)
  const linkedUrls = extractLinkedUrls(html, pageUrl)

  const atsBoardUrl = linkedUrls.find((url) =>
    TRUSTED_ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname)),
  )

  if (atsBoardUrl) {
    throw new Error(
      `Supr Daily redirected surface now exposes a trustworthy public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const sameOriginJobUrl = linkedUrls.find((url) => {
    if (url.origin !== careersOrigin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath && !url.search && !url.hash) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  })

  if (sameOriginJobUrl) {
    throw new Error(
      `Supr Daily redirected surface now exposes a trustworthy public jobs surface via ${sameOriginJobUrl.toString()}.`,
    )
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createSuprDailyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const page = await fetchPage(CAREERS_URL)
    assertVerifiedContract(page)
    assertNoTrustedJobsSurface(page.html, page.url || CAREERS_URL)
    return []
  },
})

export const run = async (options = {}) => createSuprDailyScraper().run(options)

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
