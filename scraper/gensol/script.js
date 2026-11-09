import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const HOMEPAGE_URL = 'https://www.gensol.in/'
export const CAREERS_URL = 'https://www.gensol.in/careers'
export const JOBS_URL = 'https://www.gensol.in/jobs'

const HOMEPAGE_PATTERN_SETS = [
  [
    /<title>\s*gensol\.in\s*<\/title>/i,
    /Something amazing will be constructed here/i,
    /upload your website into the public_html directory/i,
    /directadmin/i,
  ],
  [
    /<title>\s*Website Under Development\s*<\/title>/i,
    /Under Development/i,
    /This website is coming soon!/i,
    /HorizonWebinfo Pvt Ltd/i,
    /ERP\s*\|\s*CRM\s*\|\s*Mobile Application\s*\|\s*Website\s*\|\s*HRMS/i,
  ],
]

const MISSING_ROUTE_PATTERNS = [
  /404\s+Not\s+Found/i,
  /resource requested could not be found on this server/i,
]

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'gensol',
  timeoutMs: 15000,
})

const fetchRouteText = async (fetchText, url) => {
  try {
    return await fetchText(url)
  } catch (error) {
    if (/HTTP 404\b/i.test(String(error?.message ?? error))) {
      return '404 Not Found The resource requested could not be found on this server!'
    }

    throw error
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_PATTERN_SETS.some((patterns) => patterns.every((pattern) => pattern.test(page)))
}

export const isMissingCareerRoute = (html) => {
  const page = String(html ?? '')
  return MISSING_ROUTE_PATTERNS.every((pattern) => pattern.test(page))
}

export const createGensolScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchRouteText(fetchText, HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Gensol official homepage changed; refusing to assume the careers surface is still empty')
    }

    const careersHtml = await fetchRouteText(fetchText, CAREERS_URL)
    const jobsHtml = await fetchRouteText(fetchText, JOBS_URL)

    if (isMissingCareerRoute(careersHtml) && isMissingCareerRoute(jobsHtml)) {
      return []
    }

    throw new Error('Gensol official careers/jobs surface changed or now exposes public job content')
  },
})

export const run = async (options = {}) => createGensolScraper().run(options)
