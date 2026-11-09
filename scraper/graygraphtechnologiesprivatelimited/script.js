import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'graygraphtechnologiesprivatelimited'
export const COMPANY = 'Graygraph Technologies Private Limited'
export const HOMEPAGE_URL = 'https://www.graygraph.com/'
export const CAREERS_URL = 'https://www.graygraph.com/jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Graygraph Technologies',
  adapter: 'script',
  modulePath: '../../scraper/graygraphtechnologiesprivatelimited/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'awsm-job-archive-single-page',
  extractionStrategy: 'verified-first-party-jobs-archive+awsm-job-listing-cards+same-domain-detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'graygraph.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.graygraph.com/jobs/ was the live first-party Graygraph Technologies jobs archive and that it exposed public listing cards including Hiring for SEO Team Lead and Hiring For IT Project Manager with same-domain More Details links and Noida location text.',
  dryRunFile: 'graygraphtechnologiesprivatelimited/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Job Openings Archive - Graygraph\.com/i.test(page)
    && /awsm-jobs-archive-title/i.test(page)
    && /awsm-job-post-title/i.test(page)
}

export const extractJobCards = (html) => {
  const page = String(html ?? '')
  const jobs = []
  const titlePattern = /awsm-job-post-title">\s*<a href="([^"]+)">([^<]+)<\/a>/gi
  const titleMatches = [...page.matchAll(titlePattern)]

  for (let index = 0; index < titleMatches.length; index += 1) {
    const match = titleMatches[index]
    const sectionEnd = titleMatches[index + 1]?.index ?? page.length
    const card = page.slice(match.index, sectionEnd)
    const sourceUrl = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const terms = [...card.matchAll(/awsm-job-specification-term">([^<]+)</gi)].map((item) => normalizeWhitespace(item[1]))
    const location = terms.at(-1)

    if (!title || !sourceUrl || !location) continue

    jobs.push({
      title,
      location,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return jobs
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  const page = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(page)) {
    throw new Error('Graygraph Technologies Private Limited verified jobs archive changed materially')
  }

  const jobs = extractJobCards(page)
  if (!jobs.length) {
    throw new Error('Graygraph Technologies Private Limited jobs archive no longer exposes trusted job cards')
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

