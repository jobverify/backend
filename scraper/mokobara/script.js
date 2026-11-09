import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MOKOBARA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = MOKOBARA_CATALOG
export const SOURCE = MOKOBARA_CATALOG.source
export const COMPANY = MOKOBARA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MOKOBARA_CATALOG.officialBrandName
export const VERIFIED_ON = MOKOBARA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MOKOBARA_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = MOKOBARA_CATALOG.homepageUrl
export const FAQ_URL = MOKOBARA_CATALOG.faqUrl
export const CAREERS_URL = 'https://mokobara.com/careers'
export const PAGES_CAREERS_URL = 'https://mokobara.com/pages/careers'
export const APPLICATION_EMAIL = MOKOBARA_CATALOG.applicationEmail
export const APPLICATION_URL = MOKOBARA_CATALOG.applicationUrl
export const NO_PUBLIC_CAREER_ROUTE_URLS = [...MOKOBARA_CATALOG.noPublicCareerRouteUrls]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

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

export const pageExposesPublicJobListings = (html = '') => [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
].some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /#GoingPlaces/i.test(normalized)
    && /Join our team! - careers@mokobara\.com/i.test(normalized)
    && /support@mokobara\.com/i.test(page)
    && /bulkorders@mokobara\.com/i.test(page)
    && /Mokobara Lifestyle Private Limited/i.test(normalized)
    && !pageExposesPublicJobListings(page)
}

export const hasOfficialFaqSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /How do I join the Mokobara team\?/i.test(normalized)
    && /Shoot your shot with us at careers@mokobara\.com/i.test(normalized)
    && /Join our team! - careers@mokobara\.com/i.test(normalized)
    && !pageExposesPublicJobListings(page)
}

export const isVerifiedMissingCareerRoute = ({ status, html } = {}) =>
  Number(status) === 404 && !pageExposesPublicJobListings(html)

export const isVerifiedHomepageRedirect = ({ status, url, html } = {}) =>
  Number(status) === 200
  && normalizeComparableUrl(url) === normalizeComparableUrl(HOMEPAGE_URL)
  && hasOfficialHomepageSignal(html)

export const createMokobaraScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage?.status) !== 200
      || normalizeComparableUrl(homepage?.url) !== normalizeComparableUrl(HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage?.html)
    ) {
      throw new Error('The verified Mokobara homepage changed materially')
    }

    const faqPage = await fetchPage(FAQ_URL)
    if (
      Number(faqPage?.status) !== 200
      || normalizeComparableUrl(faqPage?.url) !== normalizeComparableUrl(FAQ_URL)
    ) {
      throw new Error('The verified Mokobara faq page changed materially')
    }

    if (pageExposesPublicJobListings(faqPage?.html)) {
      throw new Error('Mokobara faq page now appears to expose public job listings')
    }

    if (!hasOfficialFaqSignal(faqPage?.html)) {
      throw new Error('The verified Mokobara faq page changed materially')
    }

    const pagesCareersRoute = await fetchPage(PAGES_CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(pagesCareersRoute)) {
      throw new Error(`The verified no-public-careers route changed for Mokobara: ${PAGES_CAREERS_URL}`)
    }

    const careersRoute = await fetchPage(CAREERS_URL)
    if (!isVerifiedHomepageRedirect(careersRoute)) {
      throw new Error('The verified Mokobara careers redirect changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createMokobaraScraper().run(options)

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
