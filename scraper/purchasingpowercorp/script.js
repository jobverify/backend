import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'purchasingpowercorp'
export const COMPANY = 'Purchasing Power Corp'
export const HOMEPAGE_URL = 'https://www.purchasingpower.com/'
export const ROBOTS_URL = 'https://www.purchasingpower.com/robots.txt'
export const SITEMAP_URL = 'https://www.purchasingpower.com/sitemap.xml'
export const LEGACY_CAREERS_HOST_URL = 'https://careers.purchasingpower.com/'
export const LEGACY_CAREERS_TARGET_URL = 'https://www.purchasingpower.com/?domain=careers'
export const CHECKED_ROUTE_URLS = [
  'https://www.purchasingpower.com/careers',
  'https://www.purchasingpower.com/careers/',
  'https://www.purchasingpower.com/career',
  'https://www.purchasingpower.com/career/',
  'https://www.purchasingpower.com/jobs',
  'https://www.purchasingpower.com/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])
const LEGACY_CAREERS_REDIRECT_CANDIDATES = [
  'https://purchasingpower.com/?domain=careers',
  LEGACY_CAREERS_TARGET_URL,
]
const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob search\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /icims\.com/i,
]
const CAREER_LIKE_URL_PATTERN = /\b(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)\b/i

const normalizeWhitespace = (value) =>
  String(value ?? '')
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
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Purchasing Power\s*<\/title>/i.test(page)
    && /<html[^>]+lang=["']en["'][^>]*data-beasties-container/i.test(page)
    && /<base[^>]+href=["']\/["']/i.test(page)
    && /<app-root>\s*<\/app-root>/i.test(page)
    && /https:\/\/ui\.purchasingpower\.com\/spartacus\/styles-[^"']+\.css/i.test(page)
    && /https:\/\/ui\.purchasingpower\.com\/spartacus\/main-[^"']+\.js/i.test(page)
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRobotsPage = (page = {}) =>
  Number(page?.status) === 404

export const sitemapHasCareerLikeUrl = (xml = '') => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => CAREER_LIKE_URL_PATTERN.test(entry))
}

export const isVerifiedRouteFallbackShell = (pageHtml = '', homepageHtml = '') =>
  hasOfficialHomepageSignal(pageHtml)
  && !hasPublicJobsSignal(pageHtml)
  && (
    normalizeWhitespace(pageHtml) === normalizeWhitespace(homepageHtml)
    || hasOfficialHomepageSignal(homepageHtml)
  )

export const isVerifiedLegacyCareersRedirect = (page = {}) =>
  REDIRECT_STATUS_CODES.has(Number(page?.status))
  && LEGACY_CAREERS_REDIRECT_CANDIDATES.some(
    (candidate) =>
      normalizeComparableUrl(page?.headers?.location) === normalizeComparableUrl(candidate),
  )

export const createPurchasingPowerCorpScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error(
        'Purchasing Power Corp verified official homepage shell no longer matches the known first-party surface',
      )
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Purchasing Power Corp homepage shell now appears to expose a public jobs surface')
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (!isVerifiedMissingRobotsPage(robots)) {
      throw new Error(
        'Purchasing Power Corp robots surface no longer matches the verified no-public-careers baseline',
      )
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error(
        'Purchasing Power Corp sitemap no longer matches the verified no-public-careers baseline',
      )
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (routePage.status !== 200 || !isVerifiedRouteFallbackShell(routePage.html, homepage.html)) {
        throw new Error(
          `Purchasing Power Corp route fallback changed materially or now exposes public jobs: ${routeUrl}`,
        )
      }
    }

    const legacyCareersRedirect = await fetchPage(LEGACY_CAREERS_HOST_URL, { manualRedirect: true })
    if (!isVerifiedLegacyCareersRedirect(legacyCareersRedirect)) {
      throw new Error(
        'Purchasing Power Corp legacy careers redirect no longer matches the verified first-party handoff',
      )
    }

    const legacyCareersTarget = await fetchPage(LEGACY_CAREERS_TARGET_URL)
    if (
      legacyCareersTarget.status !== 200
      || !isVerifiedRouteFallbackShell(legacyCareersTarget.html, homepage.html)
    ) {
      throw new Error(
        'Purchasing Power Corp legacy careers target no longer resolves to the verified homepage shell',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createPurchasingPowerCorpScraper().run(options)

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
