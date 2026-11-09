import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vglenceenterprises'
export const COMPANY = 'VGLENCE ENTERPRISES'
export const HOMEPAGE_URL = 'https://vglence.com/'
export const CANONICAL_HOMEPAGE_URL = 'https://www.vglence.com/'
export const BUNDLE_URL = 'https://www.vglence.com/assets/index-CXKv6uBB.js'
export const CAREERS_ROUTE_URLS = [
  'https://www.vglence.com/careers/',
  'https://www.vglence.com/career/',
  'https://www.vglence.com/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_SHELL_PATTERNS = [
  /<title>\s*VGLENCE \| sales booster\s*<\/title>/i,
  /<link\s+rel=["']stylesheet["']\s+href=["']\/montserrat\.css["']/i,
  /<script[^>]+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["'][^>]*><\/script>/i,
  /<link\s+rel=["']modulepreload["']\s+crossorigin\s+href=["']\/assets\/vendor-react-[^"']+\.js["']>/i,
  /<link\s+rel=["']stylesheet["']\s+crossorigin\s+href=["']\/assets\/index-[^"']+\.css["']>/i,
  /<div\s+id=["']root["']><\/div>/i,
]

const VERIFIED_BUNDLE_PATTERNS = [
  /path:"\/"/,
  /path:"\/what"/,
  /path:"\/who"/,
  /path:"\/how-much"/,
  /path:"\/contribute"/,
  /path:"\/where"/,
  /path:"\/add-up"/,
  /path:"\/vglencers"/,
  /path:"\/book-a-demo"/,
  /path:"\/deal-driver"/,
  /path:"\/troubleshooter"/,
  /path:"\/code-commander"/,
  /path:"\/apex"/,
  /path:"\/coach"/,
  /path:"\/lineup\/:role"/,
  /path:"\/dashboard\/:role"/,
  /path:"\/login"/,
  /path:"\/lo\/dashboard"/,
]

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'|’)re hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
  /hiring\.workable\.com/i,
  /linkedin\.com\/jobs/i,
  /path:"\/careers?(?:\/|")/i,
]

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
    html: await response.text(),
  }
}

const defaultFetchBundle = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/javascript,application/javascript;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    },
  })

  if (!response.ok) {
    throw new Error(`VGLENCE ENTERPRISES bundle request failed with status ${response.status}`)
  }

  return response.text()
}

export const hasVerifiedShell = (html) => {
  const page = String(html ?? '')
  return VERIFIED_SHELL_PATTERNS.every((pattern) => pattern.test(page))
}

export const extractBundleUrl = (html) => {
  const match = String(html ?? '')
    .match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*><\/script>/i)

  if (!match) return null

  try {
    return new URL(match[1], CANONICAL_HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

export const hasVerifiedBundle = (bundle) => {
  const source = String(bundle ?? '')

  return VERIFIED_BUNDLE_PATTERNS.every((pattern) => pattern.test(source))
    && !PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(source))
  }

export const hasPublicJobSignals = (value) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

const hasExpectedFinalUrl = (actualUrl, expectedUrl) => String(actualUrl ?? '') === expectedUrl

export const createVglenceEnterprisesScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBundle = defaultFetchBundle } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (
      homepage.status !== 200
      || !hasExpectedFinalUrl(homepage.url, CANONICAL_HOMEPAGE_URL)
      || !hasVerifiedShell(homepage.html)
    ) {
      throw new Error('VGLENCE ENTERPRISES verified official homepage no longer matches the trusted redirect and SPA shell')
    }

    if (hasPublicJobSignals(homepage.html)) {
      throw new Error('VGLENCE ENTERPRISES homepage now exposes public jobs')
    }

    const bundle = await fetchBundle(extractBundleUrl(homepage.html) || BUNDLE_URL)
    if (!hasVerifiedBundle(bundle)) {
      throw new Error('VGLENCE ENTERPRISES verified first-party bundle no longer matches the trusted non-jobs route map')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (
        routePage.status !== 200
        || !hasExpectedFinalUrl(routePage.url, routeUrl)
        || !hasVerifiedShell(routePage.html)
      ) {
        throw new Error('VGLENCE ENTERPRISES verified careers-like route no longer matches the trusted first-party fallback shell')
      }

      if (hasPublicJobSignals(routePage.html)) {
        throw new Error('VGLENCE ENTERPRISES verified careers-like route now exposes public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createVglenceEnterprisesScraper().run(options)

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
