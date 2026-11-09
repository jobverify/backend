import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { inspectCurrentCementHandoffs } from './currentHandoffs.js'

export const CAREERS_URL = 'https://www.adani.com/careers'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Careers at Adani Group:\s*Explore Job Opportunities and Vacancies\s*<\/title>/i
const CANONICAL_URL_PATTERN = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.adani\.com\/careers\/?["']/i
const ADANI_GROUP_PATTERN = /Adani Group/i
const CEMENT_BUSINESS_PATTERN = /href=["'][^"']*\/businesses\/materials\/cement\/?["'][^>]*>\s*Cement\s*</i
const OPENINGS_HANDOFF_PATTERN = /https:\/\/www\.adani\.com\/opportunity\/#en\/sites\/CX_\d+\/requisitions/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && CANONICAL_URL_PATTERN.test(page)
    && ADANI_GROUP_PATTERN.test(page)
    && CEMENT_BUSINESS_PATTERN.test(page)
    && OPENINGS_HANDOFF_PATTERN.test(page)
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'adanicement',
  timeoutMs: 15000,
  signal: options.signal,
  includeResponseMetadata: true,
})

export const createAdaniCementScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, onAudit, now } = {}) {
    const read = async url => {
      signal?.throwIfAborted()
      const response = await fetchText(url, { signal })
      signal?.throwIfAborted()
      if (typeof response === 'string') return response
      if (response?.status !== 200 || response.url !== url || typeof response.html !== 'string') throw new Error('Adani Cement current first-party response identity changed')
      return response.html
    }
    const careersHtml = await read(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Adani Cement official careers surface changed; refusing to assume no public listings')
    }

    return inspectCurrentCementHandoffs({ read, signal, onAudit, now })
  },
})

export const run = async (options = {}) => createAdaniCementScraper().run(options)
