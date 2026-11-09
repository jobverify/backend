import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'saintgobain'
export const COMPANY = 'Saint-Gobain'
export const CAREERS_URL = 'https://in.saint-gobain-glass.com/careers'
export const APPLY_PORTAL_URL = 'https://apply.in.saint-gobain-glass.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_CAREERS_PATTERNS = [
  /Explore Career Opportunities at Saint-Gobain Glass\s*\|\s*Saint-Gobain Glass/i,
  /\bCareers at Saint-Gobain\b/i,
  /\bWhy Saint-Gobain\?/i,
  /Saint-Gobain is the worldwide leader in light and sustainable construction/i,
]

const VERIFIED_PORTAL_HANDOFF_PATTERN = new RegExp(
  APPLY_PORTAL_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  'i',
)

const FIRST_PARTY_JOBS_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bpublished\s*:\s*\d{2}\/\d{2}\/\d{4}\b/i,
  /\breference\s*:\s*[A-Z0-9-]+\b/i,
  /href=["'][^"']*\/job\//i,
  /https?:\/\/[^"' ]*\/job\//i,
]

const LOGIN_ONLY_PORTAL_PATTERNS = [
  /<title>\s*Login\s*<\/title>/i,
  /\bSG Careers\b/i,
  /\bRegistration\b/i,
  /Forgot your password/i,
]

const PUBLIC_PORTAL_JOBS_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bsee the opening\b/i,
  /\bjob title\b/i,
  /href=["'][^"']*\/job\//i,
]

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_CAREERS_PATTERNS.every((pattern) => pattern.test(page))
}

export const hasVerifiedPortalHandoff = (html) => {
  const page = String(html ?? '')
  return VERIFIED_PORTAL_HANDOFF_PATTERN.test(page)
}

export const hasFirstPartyJobsSignal = (html) =>
  FIRST_PARTY_JOBS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasBrowserVerificationBlockSignal = (html) => {
  const page = String(html ?? '')
  return (
    /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    || /checking your browser before allowing access/i.test(page)
    || /cdn-cgi\/challenge-platform/i.test(page)
    || /__cf_chl_[a-z_]+/i.test(page)
  )
}

export const hasLoginOnlyPortalSignal = (html) =>
  LOGIN_ONLY_PORTAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasPublicPortalJobsSignal = (html) =>
  PUBLIC_PORTAL_JOBS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
  signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
})

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createSaintGobainScraper = () => ({
  async run({ fetchPage, fetchText } = {}) {
    const effectiveFetchPage = fetchPage
      || (fetchText
        ? async (url) => ({ status: 200, url, html: await fetchText(url) })
        : defaultFetchPage)

    const [careersPage, portalPage] = await Promise.all([
      effectiveFetchPage(CAREERS_URL),
      effectiveFetchPage(APPLY_PORTAL_URL),
    ])

    const careersHtml = careersPage?.html ?? ''
    const portalHtml = portalPage?.html ?? ''

    if (hasPublicPortalJobsSignal(portalHtml)) {
      throw new Error('Saint-Gobain apply portal now appears to expose public guest-visible jobs')
    }

    if (!hasLoginOnlyPortalSignal(portalHtml)) {
      throw new Error('Saint-Gobain apply portal no longer matches the verified login-only public surface')
    }

    if (
      Number(careersPage?.status) === 403
      && hasBrowserVerificationBlockSignal(careersHtml)
      && !hasFirstPartyJobsSignal(careersHtml)
    ) {
      return []
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Official Saint-Gobain India careers surface changed; refusing to assume the verified portal handoff still applies')
    }

    if (!hasVerifiedPortalHandoff(careersHtml)) {
      throw new Error('Saint-Gobain India careers handoff changed; refusing to assume the verified portal still applies')
    }

    if (hasFirstPartyJobsSignal(careersHtml)) {
      throw new Error('Saint-Gobain India careers page now appears to expose a first-party public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createSaintGobainScraper().run(options)

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
