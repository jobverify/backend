import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { runHiringChannel } from './nativeHiringChannel.js'

export const CAREERS_URL = 'https://corporate.bighaat.com/careers/'

const PUBLIC_LISTING_PATTERN = /<(?:article|li|div)[^>]+(?:job[-_ ]?(?:card|listing|result)|open[-_ ]?position|career[-_ ]?listing)[^>]*>[\s\S]*?<a[^>]+href=["'][^"']+[^>]*>\s*(?:apply|view|details)/i

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')
  const text = page
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/corporate\.bighaat\.com\/careers\/["']/i.test(page)
    && /(?:BigHaat Careers|Careers\s*\|\s*Bighaat)/i.test(page)
    && /Join BigHaat/i.test(text)
    && (
      /Why work with BigHaat/i.test(text)
      || /applying your experience and knowledge/i.test(text)
    )
}

export const pageExposesPublicJobListings = (html) => (
  PUBLIC_LISTING_PATTERN.test(String(html ?? ''))
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'bighaat',
  timeoutMs: 15000,
})

export const createBigHaatScraper = () => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    return runHiringChannel({
      fetchText: fetchText === defaultFetchText ? undefined : fetchText,
      signal,
      hasHistoricalProfile: hasOfficialCareersSurface,
      hasPublicListings: pageExposesPublicJobListings,
    })
  },
})

export const run = async (options = {}) => createBigHaatScraper().run(options)
