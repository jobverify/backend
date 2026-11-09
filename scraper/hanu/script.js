import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hanu'
export const COMPANY = 'Hanu'
export const HOMEPAGE_URL = 'https://www.hanu.com/'
export const HOMEPAGE_REDIRECT_URL = 'https://www.insight.com/en_US/home.html/'
export const CAREERS_ROUTE_URLS = [
  'https://www.hanu.com/careers',
  'https://www.hanu.com/careers/',
  'https://www.hanu.com/jobs',
  'https://www.hanu.com/jobs/',
  'https://www.hanu.com/company/careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])
const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob search\b/i,
  /\bapply now\b/i,
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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  const input = String(value ?? '').trim()
  if (!input) return ''

  try {
    const url = new URL(input)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return input.replace(/\/$/, '')
  }
}

const defaultFetchPage = async (url, { manualRedirect = false } = {}) => {
  const response = await fetch(url, {
    redirect: manualRedirect ? 'manual' : 'follow',
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
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Insight\s*\|\s*Insight Enterprises\s*\|\s*Insight\s*<\/title>/i.test(rawHtml)
    && /Insight Enterprises,\s*Inc\./i.test(normalized)
    && /NASDAQ:\s*NSIT/i.test(normalized)
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const getExpectedCareersRedirectTarget = (routeUrl) => {
  switch (routeUrl) {
    case 'https://www.hanu.com/careers':
      return 'https://www.insight.com/en_US/home.html/careers'
    case 'https://www.hanu.com/careers/':
      return 'https://www.insight.com/en_US/home.html/careers/'
    case 'https://www.hanu.com/jobs':
      return 'https://www.insight.com/en_US/home.html/jobs'
    case 'https://www.hanu.com/jobs/':
      return 'https://www.insight.com/en_US/home.html/jobs/'
    case 'https://www.hanu.com/company/careers':
      return 'https://www.insight.com/en_US/home.html/company/careers'
    default:
      return null
  }
}

export const isVerifiedHomepageRedirect = (page = {}) =>
  REDIRECT_STATUS_CODES.has(Number(page?.status))
  && normalizeComparableUrl(page?.headers?.location) === normalizeComparableUrl(HOMEPAGE_REDIRECT_URL)

export const isVerifiedCareersRouteRedirect = ({ routeUrl, page = {} } = {}) => {
  const expectedTarget = getExpectedCareersRedirectTarget(routeUrl)
  if (!expectedTarget) return false

  return REDIRECT_STATUS_CODES.has(Number(page?.status))
    && normalizeComparableUrl(page?.headers?.location) === normalizeComparableUrl(expectedTarget)
}

export const createHanuScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepageRedirect = await fetchPage(HOMEPAGE_URL, { manualRedirect: true })
    if (!isVerifiedHomepageRedirect(homepageRedirect)) {
      throw new Error('Hanu homepage redirect no longer matches the verified first-party surface')
    }

    const redirectedHomepage = await fetchPage(HOMEPAGE_REDIRECT_URL)
    if (redirectedHomepage.status !== 200 || !hasOfficialHomepageSignal(redirectedHomepage.html)) {
      throw new Error('Hanu redirected official homepage no longer matches the verified public surface')
    }

    if (hasPublicJobsSignal(redirectedHomepage.html)) {
      throw new Error('Hanu redirected official homepage now appears to expose a public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRedirect = await fetchPage(careersRouteUrl, { manualRedirect: true })
      if (!isVerifiedCareersRouteRedirect({ routeUrl: careersRouteUrl, page: careersRedirect })) {
        throw new Error('Hanu careers route redirect no longer matches the verified first-party surface')
      }

      const careersTargetUrl = getExpectedCareersRedirectTarget(careersRouteUrl)
      const careersTarget = await fetchPage(careersTargetUrl)

      if (careersTarget.status !== 200 || !hasOfficialHomepageSignal(careersTarget.html)) {
        throw new Error('Hanu careers route target no longer resolves to the verified public homepage shell')
      }

      if (hasPublicJobsSignal(careersTarget.html)) {
        throw new Error('Hanu careers route target now appears to expose a public jobs surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createHanuScraper().run(options)

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
