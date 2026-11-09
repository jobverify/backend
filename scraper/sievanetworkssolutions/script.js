import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sievanetworkssolutions'
export const COMPANY = 'Sieva Networks Solutions'
export const HOMEPAGE_URL = 'https://www.sievanetworks.com/'
export const CANOPUS_URL = 'https://www.sievanetworks.com/canopus.html'
export const IP_PORTFOLIO_URL = 'https://www.sievanetworks.com/ipportfolio.html'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.sievanetworks.com/careers',
  'https://www.sievanetworks.com/careers/',
  'https://www.sievanetworks.com/jobs',
  'https://www.sievanetworks.com/jobs/',
  'https://www.sievanetworks.com/join-us',
  'https://www.sievanetworks.com/openings',
  'https://www.sievanetworks.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bjob openings?\b/i,
  /\bavailable positions?\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /workable\.com/i,
]

const CAREER_LINK_PATTERN = /(?:\/|^)(careers?|jobs?|join-us|work-with-us|openings?)(?:\/|$)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractHrefValues = (html) =>
  [...String(html ?? '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(([, href]) => href.trim())

const hasCareerLikeHref = (html) =>
  extractHrefValues(html).some((href) => CAREER_LINK_PATTERN.test(href)
    || PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(href)))

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
    || hasCareerLikeHref(page)
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*sievanetworks\s*::\s*company\s*<\/title>/i.test(page)
    && normalized.includes('About the Company')
    && normalized.includes('Based out of San Francisco Bay area and with locations in three continents, Sieva Networks has a global reach.')
    && normalized.includes('We are a privately held company.')
    && normalized.includes('info@sievanetworks.com.')
    && normalized.includes('Copyright')
    && normalized.includes('Sieva Networks. All rights reserved.')
    && /href\s*=\s*["']canopus\.html["']/i.test(page)
    && /href\s*=\s*["']ipportfolio\.html["']/i.test(page)
    && /href\s*=\s*["']mailto:sales@sievanetworks\.com["']/i.test(page)
}

export const hasOfficialCanopusSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*sievanetworks\s*::\s*company\s*<\/title>/i.test(page)
    && normalized.includes('CANOPUS')
    && normalized.includes("Canopus forms the core of Sieva Network's low power transceiver chipsets.")
    && normalized.includes('CANOPUS CORE')
    && normalized.includes('CANOPUS CS')
    && normalized.includes('DOWNLOAD SPEC')
    && normalized.includes('Contact Sales')
    && /mailto:sales@sievanetworks\.com/i.test(page)
}

export const hasOfficialIpPortfolioSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*sievanetworks\s*::\s*company\s*<\/title>/i.test(page)
    && normalized.includes('Ultra Low Power IP Circuit Blocks')
    && normalized.includes("Sieva Networks provides a number of blocks for RF and baseband circuitry such as LNA's, mixers, VCO's, PLL's")
    && normalized.includes('Voltage Controlled Oscillator (VCO)')
    && normalized.includes('Low Noise Amplifier (LNA)')
    && /sn040\.pdf/i.test(page)
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && normalized.includes('The requested URL was not found on this server.')
    && normalized.includes('Additionally, a 404 Not Found error was encountered while trying to use an ErrorDocument to handle the request.')
    && !hasPublicJobsSignal(html)
}

const shouldUseBrowserFallback = (page = {}) =>
  [403, 406].includes(Number(page?.status))
  && !hasPublicJobsSignal(page?.html)

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

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createSievaNetworksSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchPage(url)
    })

    const fetchVerifiedPage = async (url) => {
      const page = await fetchPage(url)
      if (!shouldUseBrowserFallback(page)) {
        return page
      }

      return browserPageFetcher(url)
    }

    try {
      const homepage = await fetchVerifiedPage(HOMEPAGE_URL)
      if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
        throw new Error('Sieva Networks Solutions official homepage no longer matches the verified first-party surface')
      }
      if (hasPublicJobsSignal(homepage.html)) {
        throw new Error('Sieva Networks Solutions homepage now appears to expose a public jobs surface')
      }

      const canopus = await fetchVerifiedPage(CANOPUS_URL)
      if (canopus.status !== 200 || !hasOfficialCanopusSignal(canopus.html)) {
        throw new Error('Sieva Networks Solutions Canopus page no longer matches the verified first-party surface')
      }
      if (hasPublicJobsSignal(canopus.html)) {
        throw new Error('Sieva Networks Solutions Canopus page now appears to expose a public jobs surface')
      }

      const ipPortfolio = await fetchVerifiedPage(IP_PORTFOLIO_URL)
      if (ipPortfolio.status !== 200 || !hasOfficialIpPortfolioSignal(ipPortfolio.html)) {
        throw new Error('Sieva Networks Solutions IP portfolio page no longer matches the verified first-party surface')
      }
      if (hasPublicJobsSignal(ipPortfolio.html)) {
        throw new Error('Sieva Networks Solutions IP portfolio page now appears to expose a public jobs surface')
      }

      for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
        const routePage = await fetchVerifiedPage(routeUrl)
        if (!isVerifiedMissingCareerRoute(routePage)) {
          throw new Error(`Sieva Networks Solutions verified no-public-careers route changed: ${routePage.url || routeUrl}`)
        }
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createSievaNetworksSolutionsScraper().run(options)

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
