import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'hashcashconsultants'
export const COMPANY = 'HashCash Consultants'
export const HOMEPAGE_URL = 'https://www.hashcashconsultants.com/careers/'
export const CAREERS_URL = 'https://www.hashcashconsultants.com/opportunities/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'HashCash Consultants',
  adapter: 'script',
  modulePath: '../../scraper/hashcashconsultants/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-first-party-opportunities-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-location-sections',
  extractionStrategy: 'verified-first-party-opportunities-page+india-location-groups+same-page-role-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'hashcashconsultants.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.hashcashconsultants.com/opportunities/ was the live first-party HashCash Consultants opportunities page, and that it publicly exposed India hiring sections for Mumbai and Kolkata with role links including Business Development Manager (Banking Products), Sr. Support Specialist (Banking Products), Infrastructure Software Developers, Backend Software Developers, UI/UX Software Developers, and Database Manager.',
  dryRunFile: 'hashcashconsultants/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return page.includes('Job Opportunities')
    && page.includes('OPPORTUNITIES')
    && page.includes('Mumbai, India')
    && page.includes('Kolkata, India')
}

export const extractIndiaOpenings = (html = '') => {
  const page = String(html ?? '')
  const jobs = []
  let currentLocation = null

  for (const match of page.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const headingTag = match[1]
    const headingText = normalizeWhitespace(match[2])
    const href = match[3]
    const linkText = normalizeWhitespace(match[4])

    if (headingTag && /India$/i.test(headingText)) {
      currentLocation = headingText
      continue
    }

    if (href && currentLocation && /India$/i.test(currentLocation) && linkText) {
      jobs.push({
        title: linkText,
        location: currentLocation,
        sourceUrl: new URL(href, CAREERS_URL).toString(),
        applyUrl: new URL(href, CAREERS_URL).toString(),
      })
    }

    if (headingTag && !/India$/i.test(headingText)) {
      currentLocation = null
    }
  }

  return jobs
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('HashCash Consultants verified first-party opportunities page changed materially')
  }

  const jobs = extractIndiaOpenings(careersHtml)
  if (!jobs.length) {
    throw new Error('HashCash Consultants verified first-party opportunities page no longer exposes India role links')
  }

  return jobs.map((job) => ({
    ...job,
    company: COMPANY,
    country: 'India',
    link: job.applyUrl,
    source: SOURCE,
    scrapedAt: now(),
  }))
}

