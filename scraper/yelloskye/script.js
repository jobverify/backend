import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'yelloskye'
export const COMPANY = 'YelloSKYE'
export const HOMEPAGE_URL = 'https://yelloskye.com/'
export const CAREERS_URL = 'https://yelloskye.com/careers/'
export const CAREERS_ROUTE_URLS = [
  CAREERS_URL,
  'https://yelloskye.com/career/',
  'https://yelloskye.com/jobs/',
]
export const CANONICAL_HOMEPAGE_URL = 'https://www.yelloskye.ai/'
export const CANONICAL_CAREERS_ROUTE_URLS = [
  'https://www.yelloskye.ai/careers/',
  'https://www.yelloskye.ai/career/',
  'https://www.yelloskye.ai/jobs/',
]
export const OFFICIAL_URLS = [
  HOMEPAGE_URL,
  ...CAREERS_ROUTE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_APP_SHELL_PATTERNS = [
  /<title>\s*YelloSKYE \| AI-Powered Site Intelligence & Digital Twin Platform\s*<\/title>/i,
  /<meta\s+property=["']og:url["']\s+content=["']https:\/\/yelloskye\.com\/["']/i,
  /Command your construction projects with total certainty\./i,
  /YelloSKYE transforms reality capture into actionable site intelligence(?: and live digital twins)?\./i,
  /<script\s+src=["']https:\/\/cdn\.tailwindcss\.com["']/i,
  /fonts\.googleapis\.com\/css2\?family=Montserrat/i,
  /<script\s+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["']/i,
  /<link\s+rel=["']stylesheet["'][^>]+href=["']\/assets\/index-[^"']+\.css["']/i,
  /<div\s+id=["']root["']><\/div>/i,
]

const hasCurrentAppIdentity = (page) =>
  /<title>\s*YelloSKYE \| Drone Survey &(?:amp;)? Inspection Company India \| AI Construction Monitoring\s*<\/title>/i.test(page)
  && /<meta\s+property=["']og:url["']\s+content=["']https:\/\/www\.yelloskye\.ai\/?["']/i.test(page)
  && /<meta\s+property=["']og:site_name["']\s+content=["']YelloSKYE["']/i.test(page)

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
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

export const hasVerifiedAppShell = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return (VERIFIED_APP_SHELL_PATTERNS.every((pattern) => pattern.test(rawHtml))
    && normalized.includes('YelloSKYE')
    && normalized.includes('AI-Powered Site Intelligence & Digital Twin Platform'))
    || (hasCurrentAppIdentity(rawHtml)
      && VERIFIED_APP_SHELL_PATTERNS.slice(4).every(pattern => pattern.test(rawHtml)))
}

export const hasPublicJobSignals = (html) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

const hasExpectedFinalUrl = (actualUrl, expectedUrl) => String(actualUrl ?? '') === expectedUrl

export const createYelloSkyeScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const read = async url => { signal?.throwIfAborted(); const value = await fetchPage(url, { signal }); signal?.throwIfAborted(); return value }
    const homepage = await read(HOMEPAGE_URL)

    if (
      homepage.status !== 200
      || !hasExpectedFinalUrl(homepage.url, CANONICAL_HOMEPAGE_URL)
      || !hasVerifiedAppShell(homepage.html)
    ) {
      throw new Error('YelloSKYE verified official homepage no longer matches the trusted redirect and first-party app shell')
    }

    if (hasPublicJobSignals(homepage.html)) {
      throw new Error('YelloSKYE official homepage now exposes public jobs')
    }

    for (const [index, routeUrl] of CAREERS_ROUTE_URLS.entries()) {
      const routePage = await read(routeUrl)
      const expectedCanonicalUrl = CANONICAL_CAREERS_ROUTE_URLS[index]

      if (
        routePage.status !== 200
        || !hasExpectedFinalUrl(routePage.url, expectedCanonicalUrl)
        || !hasVerifiedAppShell(routePage.html)
      ) {
        throw new Error('YelloSKYE verified careers-like route no longer matches the trusted redirect and first-party app shell')
      }

      if (hasPublicJobSignals(routePage.html)) {
        throw new Error('YelloSKYE verified careers-like route now exposes public jobs')
      }
    }

    // Current Vite routes render on the client; inspect their actual public bundle.
    if (hasCurrentAppIdentity(homepage.html)) {
      const assetPath = homepage.html.match(/<script\b[^>]*type=["']module["'][^>]*src=["'](\/assets\/index-[^"']+\.js)["']/i)?.[1]
      if (!assetPath) throw new Error('YelloSKYE public application bundle is missing')
      const assetUrl = new URL(assetPath, CANONICAL_HOMEPAGE_URL).href
      const asset = await read(assetUrl)
      const bundle = String(asset.html ?? '')
      if (asset.status !== 200 || asset.url !== assetUrl
        || !bundle.includes('YelloSKYE') || !/\.HOME=["']\/["']/.test(bundle)
        || !/\.ABOUT=["']\/about["']/.test(bundle)
        || !/\.BOOK_DEMO=["']\/book-demo["']/.test(bundle)
        || !bundle.includes('/solutions/construction-monitoring')
        || !/document\.getElementById\(["']root["']\)/.test(bundle)) {
        throw new Error('YelloSKYE public application bundle changed materially')
      }
      if (hasPublicJobSignals(bundle) || /["']\/(?:careers?|jobs?|join-us)(?:[\/?#"'])/i.test(bundle)) {
        throw new Error('YelloSKYE public application bundle now exposes public jobs')
      }
    }
    return []
  },
})

export const run = async (options = {}) => createYelloSkyeScraper().run(options)

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
