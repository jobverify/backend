import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MONEYCONTROL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MONEYCONTROL_CATALOG.source
export const COMPANY = MONEYCONTROL_CATALOG.companyName
export const VERIFIED_AT = MONEYCONTROL_CATALOG.verifiedOn
export const CONTACT_PAGE_URL = MONEYCONTROL_CATALOG.officialContactPageUrl
export const BLOCKED_CAREERS_ROUTE_URLS = MONEYCONTROL_CATALOG.blockedCareersRouteUrls
export const PROVIDER_METADATA = MONEYCONTROL_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialContactCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Current jobs at Moneycontrol/i.test(page)
    && /href=["']https:\/\/www\.moneycontrol\.com\/career\/\?classic=true["']/i.test(page)
    && normalized.includes('Looking for a job?')
    && normalized.includes('Careers')
}

export const hasPublicJobBoardSignal = (html = '') =>
  /\b(Current Openings|Open Positions|Job Openings|Open Roles|Vacancies)\b/i.test(String(html ?? ''))
  || /href=["'][^"']*\/career(?:s)?\/[^"']+["'][^>]*>[\s\S]*?(Apply|View\s+Job|Know\s+More|Read\s+More)/i.test(String(html ?? ''))

export const isVerifiedBlockedCareersRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 503
    && /<title>\s*Error\s*<\/title>/i.test(html)
    && normalized.includes('An error occurred while processing your request.')
    && /errors\.edgesuite\.net/i.test(normalized)
    && !hasPublicJobBoardSignal(html)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createMoneycontrolScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const contactPage = await fetchPage(CONTACT_PAGE_URL)

    if (contactPage.status !== 200 || !hasOfficialContactCareersSignal(contactPage.html)) {
      throw new Error('Moneycontrol verified official contact page no longer matches the trusted first-party surface')
    }

    for (const routeUrl of BLOCKED_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedBlockedCareersRoute(routePage)) {
        throw new Error(`Moneycontrol careers route changed materially or now exposes a public jobs surface: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMoneycontrolScraper().run(options)

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
