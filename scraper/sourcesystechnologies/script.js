import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sourcesystechnologies'
export const COMPANY = 'Sourcesys Technologies'
export const HOMEPAGE_URL = 'https://www.sourcesys.co/'
export const CAREERS_URL = 'https://www.sourcesys.co/careers'
export const CHECKED_NO_JOBS_ROUTE_URLS = [
  'https://www.sourcesys.co/career',
  'https://www.sourcesys.co/jobs',
  'https://www.sourcesys.co/current-openings',
  'https://www.sourcesys.co/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BASIC_ENTITY_MAP = new Map([
  ['&amp;', '&'],
  ['&nbsp;', ' '],
  ['&#x27;', "'"],
  ['&#39;', "'"],
  ['&rsquo;', "'"],
  ['&#8217;', "'"],
  ['&#x2019;', "'"],
])

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bjob openings?\b/i,
  /\bavailable positions?\b/i,
  /\bavailable roles?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /freshteam/i,
  /zohorecruit/i,
  /href=["'][^"']*\/careers\/[a-z0-9-]{3,}[^"']*["']/i,
]

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const decodeBasicEntities = (value) => {
  let decoded = String(value ?? '')

  for (const [entity, replacement] of BASIC_ENTITY_MAP.entries()) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), replacement)
  }

  return decoded
}

const normalizeWhitespace = (value) => decodeBasicEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractVisibleText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '')

const defaultFetchPage = async (url) =>
  withRetry(async () => {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: createTimeoutSignal(15000),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }, {
    attempts: 3,
    baseDelayMs: 2000,
    label: SOURCE,
  })

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = extractVisibleText(page)
  const title = extractTitle(page)

  return title === 'Sourcesys – Global Software, Engineering & Workforce Solutions'
    && (
      (
        /<meta name="description" content="Sourcesys delivers end-to-end software, engineering, and workforce solutions worldwide\. Innovate, automate, and scale your business with our expert teams"\/?>/i.test(page)
        && /<meta name="keywords" content="Sourcesys, global IT services, software solutions, engineering outsourcing, workforce solutions, AI, ML, cloud, RPA, embedded systems"\/?>/i.test(page)
      )
      || (
        visibleText.includes('Empowering Businesses to Innovate, Transform, and Scale Globally')
        && visibleText.includes('About Sourcesys')
        && visibleText.includes('Sourcesys is a global technology and engineering company delivering innovative software, embedded systems, and workforce solutions.')
      )
    )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = extractVisibleText(page)
  const title = extractTitle(page)

  return title === 'Careers at Sourcesys | Join Our Global Tech & Engineering Team'
    && (
      (
        /<meta name="description" content="Explore career opportunities at Sourcesys\. Join our global software, electronics, and engineering teams to innovate, grow, and make an impact\."\/?>/i.test(page)
        && /Why Work at Sourcesys/i.test(page)
        && /Innovation-Driven Environment/i.test(page)
        && /Global Opportunities/i.test(page)
        && /Benefits of Working at Sourcesys/i.test(page)
        && /Competitive compensation and performance bonuses/i.test(page)
        && /Health insurance and wellness programs/i.test(page)
      )
      || (
        visibleText.includes('Join Us. Innovate. Make an Impact.')
        && visibleText.includes('At Sourcesys, we believe people drive innovation.')
        && visibleText.includes('Why Work at Sourcesys')
        && visibleText.includes('Innovation-Driven Environment')
        && visibleText.includes('Global Opportunities')
        && visibleText.includes('Benefits of Working at Sourcesys')
        && visibleText.includes('Competitive compensation and performance bonuses')
        && visibleText.includes('Health insurance and wellness programs')
      )
    )
}

export const pageExposesPublicJobListings = (html) => {
  const haystacks = [String(html ?? ''), extractVisibleText(html)]
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) =>
    haystacks.some((haystack) => pattern.test(haystack)),
  )
}

export const isVerifiedMissingJobsRoute = (page = {}) => page.status === 404

export const createSourcesysTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Sourcesys verified official homepage no longer matches the known public surface')
    }

    if (pageExposesPublicJobListings(homepage.html)) {
      throw new Error('Sourcesys homepage now exposes public job listings and needs a structured scraper')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200) {
      throw new Error('Sourcesys verified official careers surface no longer matches the known public page')
    }

    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('Sourcesys official careers surface now exposes public job listings and needs a structured scraper')
    }

    if (!hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Sourcesys verified official careers surface no longer matches the known public page')
    }

    for (const routeUrl of CHECKED_NO_JOBS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedMissingJobsRoute(routePage)) {
        throw new Error(
          `Sourcesys checked alternate first-party jobs route changed materially: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSourcesysTechnologiesScraper().run(options)

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
