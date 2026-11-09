import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readAdaniNativeJobs } from './nativeJobs.js'
import { withCallerSignal } from './callerSignal.js'

export const CAREERS_URL = 'https://www.adani.com/careers'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Careers at Adani Group:\s*Explore Job Opportunities and Vacancies\s*<\/title>/i
const CANONICAL_URL_PATTERN = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.adani\.com\/careers\/?["']/i
const ADANI_GROUP_PATTERN = /Adani Group/i
const OPENINGS_HANDOFF_PATTERN = /https:\/\/www\.adani\.com\/opportunity\/#en\/sites\/CX_\d+\/requisitions/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && CANONICAL_URL_PATTERN.test(page)
    && ADANI_GROUP_PATTERN.test(page)
    && OPENINGS_HANDOFF_PATTERN.test(page)
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'adani',
  timeoutMs: 15000,
  signal: options.signal,
  includeResponseMetadata: true,
})

export const createAdaniScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, maxPages, maxJobs, now, onAudit } = {}) {
    const read = async url => {
      signal?.throwIfAborted()
      const response = await withCallerSignal(() => fetchText(url, { signal }), signal)
      signal?.throwIfAborted()
      if (typeof response === 'string') return response
      if (response?.status !== 200 || response.url !== url || typeof response.html !== 'string'
        || Buffer.byteLength(response.html) > 16 * 1024 * 1024) throw new Error('Adani current first-party response identity changed')
      return response.html
    }
    const careersHtml = await read(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Adani Group official careers surface changed; refusing to assume no public listings')
    }

    return readAdaniNativeJobs({ read, careersHtml, signal, maxPages, maxJobs, now, onAudit })
  },
})

export const run = async (options = {}) => createAdaniScraper().run(options)
