import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'softprodigysystemsolutions'
export const COMPANY = 'SoftProdigy System Solutions'
export const HOMEPAGE_URL = 'https://softprodigy.com/'
export const KEKA_BOARD_URL = 'https://softprodigy.keka.com/careers/'
export const KEKA_ACTIVE_JOBS_API_URL = 'https://softprodigy.keka.com/careers/api/jobs/default/active'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'SoftProdigy',
  adapter: 'script',
  modulePath: '../../scraper/softprodigysystemsolutions/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: KEKA_BOARD_URL,
  atsPlatform: 'official-homepage-plus-keka-board',
  countryFilter: 'India',
  paginationStrategy: 'homepage-handoff-plus-keka-board-shell-plus-active-jobs-api',
  extractionStrategy: 'verified-homepage-keka-link+verified-keka-board-shell+keka-active-jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'softprodigy.com',
  verifiedOn: '2026-07-27',
  verifiedSurfaceSummary:
    'Verified on Monday, July 27, 2026 that https://softprodigy.com/ linked candidates to the public board at https://softprodigy.keka.com/careers/, that the live Keka shell still rendered the SoftProdigy System Solutions Pvt. Ltd. hiring surface with a Browse all jobs prompt, and that the public active-jobs API at https://softprodigy.keka.com/careers/api/jobs/default/active exposed three openings including Software Developer, Internship cum Job Opportunity - Hiring Interns (2025 & 2026 Batch), and PPC Analyst.',
  dryRunFile: 'softprodigysystemsolutions/jobs.json',
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: KEKA_BOARD_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /SoftProdigy \| AI/i.test(page)
    && /Agentic AI Consulting[\s\S]{0,120}?that Simplifies Smart Decisions/i.test(page)
    && /Start Your AI Strategy Session/i.test(page)
    && /Digital Transformation[\s\S]{0,120}?Engineered for Impact/i.test(page)
    && /Become a Smarter Business/i.test(page)
}

export const extractKekaBoardUrl = (html) => {
  const href = String(html ?? '').match(/href=["'](https:\/\/softprodigy\.keka\.com\/careers\/)["']/i)?.[1]
  return href ?? null
}

export const hasKekaBoardSignal = (html) => {
  const page = String(html ?? '')
  return /Browse all jobs/i.test(page)
    && /SoftProdigy System Solutions Pvt\. Ltd\./i.test(page)
    && /Powered by/i.test(page)
    && /https:\/\/www\.keka\.com/i.test(page)
}

const buildKekaJobDetailsUrl = (jobId) => `${KEKA_BOARD_URL}jobdetails/${jobId}`

const normalizeEmploymentType = (jobType) => {
  switch (Number(jobType)) {
    case 2:
      return 'Full-Time'
    default:
      return null
  }
}

const buildJobLocation = (jobLocations = []) => {
  const primary = Array.isArray(jobLocations) ? jobLocations[0] : null
  if (!primary) {
    return {
      location: 'India',
      city: null,
    }
  }

  const city = normalizeWhitespace(primary.city || primary.name)
  const country = normalizeWhitespace(primary.countryName || 'India')

  return {
    location: city && country ? `${city}, ${country}` : city || country,
    city: city || null,
  }
}

export const extractJobCards = (payload) => {
  const jobs = Array.isArray(payload) ? payload : null
  if (!jobs) return []

  return jobs
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const jobId = Number.isFinite(job?.id) ? job.id : Number.parseInt(job?.id, 10)
      if (!title || !Number.isFinite(jobId)) return null

      const { location, city } = buildJobLocation(job?.jobLocations)
      const sourceUrl = buildKekaJobDetailsUrl(jobId)

      return {
        title,
        location,
        city,
        employmentType: normalizeEmploymentType(job?.jobType),
        sourceUrl,
        applyUrl: sourceUrl,
        jobId,
      }
    })
    .filter(Boolean)
}

export const run = async ({
  fetchText = defaultFetchText,
  fetchJson = defaultFetchJson,
  now = () => new Date().toISOString(),
} = {}) => {
  const homepageHtml = await fetchText(HOMEPAGE_URL)

  if (!hasOfficialHomepageSignal(homepageHtml) || extractKekaBoardUrl(homepageHtml) !== KEKA_BOARD_URL) {
    throw new Error('SoftProdigy System Solutions verified homepage careers handoff changed materially')
  }

  const boardHtml = await fetchText(KEKA_BOARD_URL)
  if (!hasKekaBoardSignal(boardHtml)) {
    throw new Error('SoftProdigy System Solutions verified Keka board shell changed materially')
  }

  const jobs = extractJobCards(await fetchJson(KEKA_ACTIVE_JOBS_API_URL))
  if (!jobs.length) {
    throw new Error('SoftProdigy System Solutions public Keka jobs API no longer exposes active jobs')
  }

  return jobs.map((job) => ({
    ...job,
    company: COMPANY,
    country: 'India',
    link: job.applyUrl || job.sourceUrl,
    source: SOURCE,
    scrapedAt: now(),
  }))
}

