import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'bankaiinfotech'
export const COMPANY = 'Bankai Infotech'
export const HOMEPAGE_URL = 'https://bankaiinfotech.com/'
export const CONTACT_URL = 'https://bankaiinfotech.com/contact-us/'
export const SITEMAP_INDEX_URL = 'https://bankaiinfotech.com/sitemap_index.xml'
export const PAGE_SITEMAP_URL = 'https://bankaiinfotech.com/page-sitemap.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Bankai Infotech Private Limited',
  adapter: 'script',
  modulePath: '../../scraper/bankaiinfotech/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CONTACT_URL,
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-contact-page-plus-page-sitemap-validation',
  extractionStrategy: 'verified-homepage+verified-contact-page+verified-page-sitemap-without-careers-route+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'bankaiinfotech.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://bankaiinfotech.com/ remained the live first-party homepage, that https://bankaiinfotech.com/contact-us/ remained the first-party contact route, and that https://bankaiinfotech.com/page-sitemap.xml published product and resource pages but no official careers, jobs, join-us, or work-with-us route. There is no trustworthy public first-party jobs surface for Bankai Infotech on the verified date, so this provider remains fail-closed.',
  dryRunFile: 'bankaiinfotech/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /Bankai Infotech/i.test(text)
}

export const hasOfficialContactPageSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /Contact Us/i.test(text)
    && /Bankai Infotech/i.test(text)
}

export const hasPageSitemapIndexSignal = (xml = '') =>
  /https:\/\/bankaiinfotech\.com\/page-sitemap\.xml/i.test(String(xml ?? ''))

export const hasCareersLikeRoute = (xml = '') =>
  /https:\/\/bankaiinfotech\.com\/[^<]*(careers?|jobs?|join-us|joinus|work-with-us|workwithus)[^<]*/i
    .test(String(xml ?? ''))

export const hasExpectedPageSitemapSurface = (xml = '') => {
  const page = String(xml ?? '')
  return /https:\/\/bankaiinfotech\.com\/<\/loc>/i.test(page)
    && /https:\/\/bankaiinfotech\.com\/contact-us\/<\/loc>/i.test(page)
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const homepageHtml = await fetchText(HOMEPAGE_URL)
  if (!hasOfficialHomepageSignal(homepageHtml)) {
    throw new Error('Bankai Infotech verified homepage no-public-careers surface changed materially')
  }

  const contactHtml = await fetchText(CONTACT_URL)
  if (!hasOfficialContactPageSignal(contactHtml)) {
    throw new Error('Bankai Infotech verified contact page surface changed materially')
  }

  const sitemapIndexXml = await fetchText(SITEMAP_INDEX_URL)
  if (!hasPageSitemapIndexSignal(sitemapIndexXml)) {
    throw new Error('Bankai Infotech verified sitemap index no longer references the page sitemap')
  }

  const pageSitemapXml = await fetchText(PAGE_SITEMAP_URL)
  if (!hasExpectedPageSitemapSurface(pageSitemapXml)) {
    throw new Error('Bankai Infotech verified page sitemap changed materially')
  }

  if (hasCareersLikeRoute(pageSitemapXml)) {
    throw new Error('Bankai Infotech public jobs surface changed materially; replace the fail-closed sentinel with a verified scraper')
  }

  return []
}

