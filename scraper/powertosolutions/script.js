import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'powertosolutions'
export const COMPANY = 'Power to Solutions'
export const CANDIDATE_DOMAIN_URLS = [
  'https://powertosolutions.com/',
  'https://powertosolutions.in/',
  'https://powertosolutions.co.in/',
  'https://power2solutions.com/',
]
export const SEARCH_SURFACES = {
  company: 'https://www.bing.com/search?format=rss&q=%22Power+to+Solutions%22',
  careers: 'https://www.bing.com/search?format=rss&q=%22Power+to+Solutions%22+careers',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BRAND_PATTERN = /\bpower\s+to\s+solutions\b|\bpowertosolutions\b|\bpower2solutions\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseRssItems = (xml) => [...String(xml ?? '').matchAll(
  /<item>\s*<title>([\s\S]*?)<\/title>\s*<link>([\s\S]*?)<\/link>\s*<description>([\s\S]*?)<\/description>/gi,
)]
  .map((match) => ({
    title: normalizeWhitespace(match[1]),
    link: normalizeWhitespace(match[2]),
    description: normalizeWhitespace(match[3]),
  }))

const hasExpectedSearchFeed = (xml, expectedTitle) => {
  const page = String(xml ?? '')

  return /<rss\b/i.test(page)
    && /<channel>/i.test(page)
    && new RegExp(`<title>${expectedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/title>`, 'i').test(page)
    && parseRssItems(page).length > 0
}

export const hasResolvableOfficialDomain = (checks = []) =>
  checks.some((check) =>
    Boolean(
      check
      && (
        check.ok === true
        || Number.isInteger(check.status)
        || typeof check.finalUrl === 'string'
      ),
    ))

export const hasCompanySurfaceSignal = (rssXml) =>
  parseRssItems(rssXml).some((item) =>
    BRAND_PATTERN.test(`${item.title} ${item.link} ${item.description}`))

const defaultVerifyDomain = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    return {
      url,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      error: null,
    }
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      finalUrl: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const defaultFetchSearchFeed = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,text/html;q=0.8,*/*;q=0.7',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPowerToSolutionsScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    verifyDomain = defaultVerifyDomain,
    fetchSearchFeed = defaultFetchSearchFeed,
    now = defaultNow,
  } = {}) {
    const domainChecks = []

    for (const url of CANDIDATE_DOMAIN_URLS) {
      domainChecks.push(await verifyDomain(url))
    }

    if (hasResolvableOfficialDomain(domainChecks)) {
      throw new Error('Power to Solutions candidate first-party domain now resolves; review for a real scraper')
    }

    const companyFeed = await fetchSearchFeed(SEARCH_SURFACES.company)
    if (!hasExpectedSearchFeed(companyFeed, 'Bing: "Power to Solutions"')) {
      throw new Error('Power to Solutions company search feed no longer matches the verified absent-surface signal')
    }
    if (hasCompanySurfaceSignal(companyFeed)) {
      throw new Error('Power to Solutions public company surface changed; review for a real scraper')
    }

    const careersFeed = await fetchSearchFeed(SEARCH_SURFACES.careers)
    if (!hasExpectedSearchFeed(careersFeed, 'Bing: "Power to Solutions" careers')) {
      throw new Error('Power to Solutions careers search feed no longer matches the verified absent-surface signal')
    }
    if (hasCompanySurfaceSignal(careersFeed)) {
      throw new Error('Power to Solutions public careers surface changed; review for a real scraper')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only',
      surface: SEARCH_SURFACES.company,
      firstParty: false,
      listingComplete: false,
      pagesFetched: CANDIDATE_DOMAIN_URLS.length + 2,
      reportedTotal: 0,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'power-to-solutions-no-resolvable-first-party-or-careers-surface',
    })
  },
})

export const run = async (options = {}) => createPowerToSolutionsScraper().run(options)

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
