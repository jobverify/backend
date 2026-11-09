import { fileURLToPath } from 'node:url'

export const SOURCE = 'bplgroup'
export const COMPANY = 'BPL Group'
export const HOMEPAGE_URL = 'https://www.bpl.in/'
export const CAREERS_ROUTE_URLS = [
  'https://www.bpl.in/careers',
  'https://www.bpl.in/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bjob opportunities\b/i,
  /\bcareer opportunities\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /\bvacan(?:cy|cies)\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const lower = normalized.toLowerCase()

  return /<title>\s*BPL:\s*Buy Electronics Products\s*<\/title>/i.test(page)
    && lower.includes('bpl')
    && (
      lower.includes('air conditioners')
      || lower.includes('washing machines')
      || lower.includes('refrigerators')
      || lower.includes('electronics')
    )
}

const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  const url = String(page.url || '')
  if (!/^https:\/\/www\.bpl\.in\/(?:careers|jobs)\/?$/i.test(url)) {
    return false
  }

  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /available_page_slug"\s*:\s*"not-found-page/i.test(html)
    || (
      /<title>\s*BPL\s*<\/title>/i.test(html)
      && normalized.includes('bpl')
      && (
        normalized.includes('tv & audio')
        || normalized.includes('refrigerators')
        || normalized.includes('washing machines')
        || normalized.includes('electronics product')
      )
    )
}

export const createBplGroupScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('BPL Group homepage no longer matches the verified official surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('BPL Group careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createBplGroupScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`BPL Group jobs scraped: ${jobs.length}`)
}
