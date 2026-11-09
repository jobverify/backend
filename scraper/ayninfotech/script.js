import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ayninfotech'
export const COMPANY = 'AYN InfoTech'
export const VERIFIED_ON = '2026-08-07'
export const HOMEPAGE_URL = 'https://www.ayninfotech.com/'
export const CHECKED_ROUTE_URLS = [
  'https://www.ayninfotech.com/careers',
  'https://www.ayninfotech.com/careers/',
  'https://www.ayninfotech.com/career',
  'https://www.ayninfotech.com/jobs',
  'https://www.ayninfotech.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

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

export const hasCompromisedHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '').toLowerCase()
  const normalized = normalizeWhitespace(html)

  const hasSlotBaitCopy = normalized.includes('deposit pulsa indosat')
    && normalized.includes('slot pulsa')
  const hasVerifiedCompromisedHostSignal = normalized.includes('powered by team')
    || rawHtml.includes('bigskyworldview')
    || rawHtml.includes('view.bigskyworldview.org')
  const hasCurrentBigSkySignal = rawHtml.includes('big sky worldview forum | billings, mt')
    && rawHtml.includes('traditional, orthodox approach based upon the bible')
    && rawHtml.includes('https://www.bigskyworldview.org')

  return (hasSlotBaitCopy && hasVerifiedCompromisedHostSignal)
    || hasCurrentBigSkySignal
}

export const isVerifiedFirstParty404Route = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && !redirectsOutsideOfficialDomain(page?.url || HOMEPAGE_URL)
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && normalized.includes('the resource requested could not be found on this server!')
    && normalized.includes('proudly powered by litespeed web server')
    && normalized.includes('please be advised that litespeed technologies inc. is not a web hosting company')
}

const redirectsOutsideOfficialDomain = (url) => {
  try {
    return new URL(url).hostname !== 'www.ayninfotech.com'
  } catch {
    return false
  }
}

export const isVerifiedUntrustedRoute = (page = {}) =>
  Number(page?.status) === 200
  && redirectsOutsideOfficialDomain(page?.url)
  && hasCompromisedHomepageSignal(page?.html)

export const createAynInfotechScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!isVerifiedUntrustedRoute(homepage) && !isVerifiedFirstParty404Route(homepage)) {
      throw new Error('AYN InfoTech verified untrusted domain state changed on the first-party homepage')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedUntrustedRoute(routePage) && !isVerifiedFirstParty404Route(routePage)) {
        throw new Error(`AYN InfoTech verified untrusted domain state changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAynInfotechScraper().run(options)

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
