import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STANZA_LIVING_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bsearch jobs\b/i,
  /\bvacancies\b/i,
  /\blever\.co\b/i,
  /\bgreenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bworkdayjobs\.com\b/i,
  /\bmyworkdayjobs\.com\b/i,
  /\bsmartrecruiters\.com\b/i,
]

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Stanza Living/i.test(page)
    && text.includes('Your second home in a new city.')
    && text.includes('Experience the new era of shared living at our professionally managed spaces.')
    && text.includes("India's most trusted managed living provider")
    && text.includes('About Us')
    && text.includes('Partner With Us')
  }

export const hasAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>.*Stanza Living/i.test(page)
    && text.includes('About Us')
    && text.includes("We didn't find it for us, so we created it for you")
    && text.includes('It was 2015. Two erstwhile IIM-A hostel roomies')
    && text.includes('450+ residences')
  }

export const hasContactPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>.*Stanza Living/i.test(page)
    && text.includes('Contact Us')
    && text.includes('STANZA LIVING CORPORATE OFFICE')
    && text.includes('Good Earth Trade Tower')
    && text.includes('Gurugram')
  }

export const isVerifiedMisdirectedCareersRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeWhitespace(html)

  return Number(page?.status) === 200
    && /PG near Careers Department, Mall Road, Dehradun/i.test(text)
    && /[1-9]\d* PGs near Careers Department, Mall Road, Dehradun/i.test(text)
    && text.includes('Schedule a Visit')
    && text.includes('Request a callback')
    && text.includes('What our residents say')
    && !hasPublicJobsSignal(html)
}

export const createStanzaLivingScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasHomepageSignal(homepage.html)) {
      throw new Error('Stanza Living verified homepage no longer matches the trusted first-party surface')
    }

    const aboutPage = await fetchPage(ABOUT_PAGE_URL)
    if (aboutPage.status !== 200 || !hasAboutPageSignal(aboutPage.html)) {
      throw new Error('Stanza Living verified about page no longer matches the trusted first-party surface')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)
    if (contactPage.status !== 200 || !hasContactPageSignal(contactPage.html)) {
      throw new Error('Stanza Living verified contact page no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Stanza Living careers route now appears to expose public jobs')
    }

    if (!isVerifiedMisdirectedCareersRoute(careersPage)) {
      throw new Error(`Stanza Living verified no-public-careers surface changed: ${careersPage.url || CAREERS_URL}`)
    }

    return []
  },
})

export const run = async (options = {}) => createStanzaLivingScraper().run(options)

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
