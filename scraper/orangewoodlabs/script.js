import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'orangewoodlabs'
export const COMPANY = 'Orangewood Labs'
export const HOMEPAGE_URL = 'https://orangewood.co/'
export const CHECKED_ROUTE_URLS = [
  'https://orangewood.co/careers',
  'https://orangewood.co/career',
  'https://orangewood.co/jobs',
  'https://orangewood.co/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bview jobs?\b/i,
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
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const extractPageBundlePath = (html) =>
  /\/_next\/static\/chunks\/app\/page-[^"']+\.js/i.exec(String(html ?? ''))?.[0] ?? null

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Orangewood Labs - Democratizing Robots\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Orangewood Labs builds affordable robotic arms\./i.test(page)
    && normalized.includes('robots are here!')
    && normalized.includes('democratizing robots')
    && normalized.includes('orangewood builds ai-powered robotic arms that are simple to operate.')
    && normalized.includes('book a demo')
    && normalized.includes('join the community')
    && normalized.includes('hellorobot@orangewood.co')
    && normalized.includes('orangewood labs inc.')
    && normalized.includes('2 marina blvd, building b, 2nd floor, san francisco, ca 94123')
    && normalized.includes('orangewood research and advancement private limited')
    && normalized.includes('second floor, a-48, sector-67, noida, gautam buddha nagar, uttar pradesh, 201301')
    && normalized.includes('contact number: +91 79769 97082')
    && extractPageBundlePath(page) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedRouteFallbackShell = (html, expectedBundlePath) =>
  hasOfficialHomepageSignal(html)
  && !hasPublicJobsSignal(html)
  && extractPageBundlePath(html) === expectedBundlePath

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createOrangewoodLabsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(
        'Orangewood Labs verified official homepage no longer matches the known public surface',
      )
    }

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('Orangewood Labs homepage now appears to expose a public jobs surface')
    }

    const homepageBundlePath = extractPageBundlePath(homepageHtml)
    if (!homepageBundlePath) {
      throw new Error('Orangewood Labs homepage no longer exposes the verified Next.js marketing shell')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)

      if (!isVerifiedRouteFallbackShell(routeHtml, homepageBundlePath)) {
        throw new Error(
          `Orangewood Labs checked first-party route changed materially or now exposes public jobs: ${routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOrangewoodLabsScraper().run(options)

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
