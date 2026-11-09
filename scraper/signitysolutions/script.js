import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'signitysolutions'
export const COMPANY = 'Signity Solutions'
export const HOMEPAGE_URL = 'https://www.signitysolutions.com/'
export const CAREERS_URL = 'https://www.signitysolutions.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Signity Solutions',
  adapter: 'script',
  modulePath: '../../scraper/signitysolutions/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-page-current-openings-accordion',
  extractionStrategy: 'verified-careers-page+inline-opening-sections+career-form-anchor',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'signitysolutions.com',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that https://www.signitysolutions.com/careers was the live first-party Signity Solutions careers page and that it exposed inline public openings including Assistant Digital Marketing Manager, QA Lead, and Senior SEO Specialist with posting dates, Mohali location text, and the first-party #career-form apply anchor.',
  dryRunFile: 'signitysolutions/jobs.json',
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
  return /Job Openings &amp; Career Opportunities at Signity Solutions/i.test(page)
    && /Current Openings/i.test(page)
    && /Apply for this job/i.test(page)
}

export const extractJobCards = (html) => {
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(/<div class="opening">([\s\S]*?)<\/div>/gi)) {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<h3>([^<]+)<\/h3>/i)?.[1])
    const location = normalizeWhitespace(block.match(/<span>Location<\/span>\s*<span>([^<]+)<\/span>/i)?.[1])

    if (!title || !location) continue

    jobs.push({
      title,
      location,
      sourceUrl: CAREERS_URL,
      applyUrl: `${CAREERS_URL}#career-form`,
    })
  }

  if (jobs.length) return jobs

  for (const match of page.matchAll(
    /<div class="list-area"[^>]*id="Job\d+"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<span>\s*Location\s*<\/span>\s*<strong>([^<]+)<\/strong>[\s\S]*?<a[^>]+href=["']#career-form["'][^>]*>\s*Apply for this job\s*<\/a>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const location = normalizeWhitespace(match[2])

    if (!title || !location) continue

    jobs.push({
      title,
      location,
      sourceUrl: CAREERS_URL,
      applyUrl: `${CAREERS_URL}#career-form`,
    })
  }

  return jobs
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  const page = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(page)) {
    throw new Error('Signity Solutions verified careers page changed materially')
  }

  const jobs = extractJobCards(page)
  if (!jobs.length) {
    throw new Error('Signity Solutions careers page no longer exposes trusted openings')
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

