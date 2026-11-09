import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREERS_URL = 'https://chemfabalkalis.com/careers/'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Careers\s*(?:\||-|&ndash;|&mdash;|&#8211;|&#8212;)\s*Chemfab\s+Alkalis\s+Limited\s*<\/title>/i
const OFFICIAL_BRAND_PATTERN = /\bChemfab\s+Alkalis\s+Limited\b/i

const CONTACT_FORM_7_PATTERN = /\bwpcf7\b/i

const PUBLIC_LISTING_PATTERN = /\bjob[-\s_]?(?:card|listing|result)s?\b|\bopen\s+(?:roles|positions|openings)\b|<article[^>]+(?:job|opening)|<a[^>]*href=["'][^"']*\/careers\/[^"']+["'][^>]*>\s*(?:view|apply)\s+job\s*<\/a>/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_BRAND_PATTERN.test(page)
}

export const hasGenericResumeFormSignal = (html) => {
  const page = String(html ?? '')

  return CONTACT_FORM_7_PATTERN.test(page)
}

export const pageExposesPublicJobListings = (html) => PUBLIC_LISTING_PATTERN.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'chemfabalkalislimited',
  timeoutMs: 15000,
})

export const createChemfabAlkalisLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Chemfab Alkalis Limited official careers surface changed; refusing to assume no public listings')
    }

    if (!hasGenericResumeFormSignal(careersHtml)) {
      throw new Error('Chemfab Alkalis Limited generic resume form changed; refusing to assume the verified apply-only flow still applies')
    }

    if (pageExposesPublicJobListings(careersHtml)) {
      throw new Error('Chemfab Alkalis Limited careers page now exposes public job listings and needs a structured scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createChemfabAlkalisLimitedScraper().run(options)
