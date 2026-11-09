import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const COMPANY_NAME = 'Clootrack'
export const CAREERS_URL = 'https://www.clootrack.com/careers'

export const PROVIDER_METADATA = {
  source: 'clootrack',
  companyName: COMPANY_NAME,
  companyCareerPage: CAREERS_URL,
  companyDomain: 'clootrack.com',
  adapter: 'script',
  atsPlatform: 'official-company-careers',
  modulePath: '../../scraper/clootrack/script.js',
  dryRunFile: 'clootrack/jobs.json',
}

const USER_AGENT = 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)'
const OFFICIAL_TITLE_PATTERN = /<title>\s*Careers\s*<\/title>/i
const OFFICIAL_HEADING_PATTERN = /Join our team at Clootrack to be at the forefront of AI-driven customer experience analytics\./i
const REMOTE_WORK_PATTERN = /organizational culture can thrive regardless of physical office locations/i
const REMOTE_PRACTICES_PATTERN = /remote work practices/i
const REACH_OUT_PATTERN = /Think you(?:'|\u2019|\u00e2\u20ac\u2122)?re a fit\?\s*Reach out and let(?:'|\u2019|\u00e2\u20ac\u2122)s explore\./i
const PUBLIC_LISTING_PATTERN = /\bjob[-\s_]?(?:card|listing|result)s?\b|\bcurrent\s+openings?\b|\bopen\s+positions?\b|<article[^>]+class=["'][^"']*job[^"']*["'][^>]*>|<a[^>]+href=["'][^"']*\/careers\/[^"']+["'][^>]*>\s*(?:apply|view)\s+(?:now|job)s?\s*<\/a>/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_HEADING_PATTERN.test(page)
    && REMOTE_WORK_PATTERN.test(page)
    && REMOTE_PRACTICES_PATTERN.test(page)
    && REACH_OUT_PATTERN.test(page)
}

export const pageExposesPublicJobListings = (html) => PUBLIC_LISTING_PATTERN.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'clootrack',
  timeoutMs: 15000,
})

export const createClootrackScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Clootrack official careers surface changed; refusing to assume no public listings')
    }

    if (pageExposesPublicJobListings(careersHtml)) {
      throw new Error('Clootrack careers page now exposes public job listings and needs a structured scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createClootrackScraper().run(options)

