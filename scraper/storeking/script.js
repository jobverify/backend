import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'storeking'
export const COMPANY = 'StoreKing'
export const HOMEPAGE_URL = 'https://storeking.in/'
export const ABOUT_URL = 'https://storeking.in/about'
export const CONTACT_URL = 'https://storeking.in/contact'
export const CAREERS_URL = 'https://storeking.in/careers'
export const CAREER_URL = 'https://storeking.in/career'
export const JOBS_URL = 'https://storeking.in/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTTP_404_PATTERN = /HTTP 404\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /StoreKing\s*-\s*AI-Powered Digital Retail OS/i.test(page)
    && /Turning Kirana Stores into Bright Stores/i.test(page)
    && /AI-Powered Retail OS - For Stores\. To Consumers\./i.test(page)
    && /ANY STORE\./i.test(page)
    && /ONLINE\.5 MINUTES\./i.test(page)
    && /Localcube Commerce Pvt Ltd/i.test(page)
    && /(href=["']\/contact["']|Contact us)/i.test(page)
}

export const hasAboutPageSignal = (html) => {
  const page = String(html ?? '')

  return /StoreKing Retail OS - About Us/i.test(page)
    && /Since 2015/i.test(page)
    && /Be Part of the StoreKing Story/i.test(page)
    && /Explore Careers/i.test(page)
    && /(href=["']\/contact["']|Contact us)/i.test(page)
}

export const hasContactPageSignal = (html) => {
  const page = String(html ?? '')

  return /StoreKing Retail OS - Contact\s*&(?:amp;)?\s*Retailer Registration/i.test(page)
    && /Localcube Commerce Pvt Ltd/i.test(page)
    && /hello@storeking\.in/i.test(page)
    && /How Can We Help You Today\?/i.test(page)
    && /Job Seeker/i.test(page)
}

export const hasVerifiedMissingRouteSignal = (html) => {
  const page = String(html ?? '')

  return /Page not found/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/storeking\.in\/?["']/i.test(page)
}

export const isVerifiedMissingRouteError = (error, url) =>
  HTTP_404_PATTERN.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(url)

const validateNoPublicListings = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length !== 0) {
    throw new Error('StoreKing scraper expected no public listings from the verified official surface')
  }

  return jobs
}

const assertVerifiedMissingRoute = async (fetchText, url) => {
  try {
    const html = await fetchText(url)
    if (hasVerifiedMissingRouteSignal(html)) {
      return
    }
  } catch (error) {
    if (isVerifiedMissingRouteError(error, url)) {
      return
    }

    throw error
  }

  throw new Error('StoreKing careers routes no longer match the verified public missing-route surface')
}

export const createStoreKingScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasAboutPageSignal(aboutHtml)) {
      throw new Error('StoreKing about page no longer matches the verified careers contact handoff')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasContactPageSignal(contactHtml)) {
      throw new Error('StoreKing contact page no longer matches the verified job-seeker surface')
    }

    await assertVerifiedMissingRoute(fetchText, CAREERS_URL)
    await assertVerifiedMissingRoute(fetchText, CAREER_URL)
    await assertVerifiedMissingRoute(fetchText, JOBS_URL)

    return validateNoPublicListings([])
  },
})

export const run = async (options = {}) => createStoreKingScraper().run(options)

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
