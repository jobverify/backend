import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const HOMEPAGE_URL = 'https://www.aeroin.space/'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Aeroin\s+SpaceTech\s+Private\s+Limited\s*<\/title>/i
const OFFICIAL_BRAND_PATTERN = /Aeroin\s+SpaceTech/i
const OFFICIAL_SBRL_PATTERN = /Stratospheric\s+Balloon\s+Rocket\s+Launcher/i
const OFFICIAL_CONTACT_PATTERN = /info@aeroin\.space/i
const PUBLIC_LISTING_PATTERN = /<(?:article|li|div)[^>]+(?:job[-\s_]?(?:card|listing|result)|current[-\s_]?opening)[^>]*>|\b(?:open\s+positions?|current\s+openings?|job\s+openings?)\b|<a[^>]+href=["'][^"']*\/(?:jobs?|careers?)(?:\/|["'])[^>]*>[^<]*(?:apply|view|details)/i

export const hasOfficialSiteSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_BRAND_PATTERN.test(page)
    && OFFICIAL_SBRL_PATTERN.test(page)
    && OFFICIAL_CONTACT_PATTERN.test(page)
}

export const pageExposesPublicJobListings = (html) => PUBLIC_LISTING_PATTERN.test(String(html ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'aeroinspacetech',
  timeoutMs: 15000,
})

export const createAeroinSpaceTechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml)) {
      throw new Error('Aeroin SpaceTech official site no longer matches the verified public surface')
    }

    if (pageExposesPublicJobListings(homepageHtml)) {
      throw new Error('Aeroin SpaceTech official site now exposes public job listings and needs a structured scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createAeroinSpaceTechScraper().run(options)
