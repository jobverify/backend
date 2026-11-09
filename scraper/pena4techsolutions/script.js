import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'pena4techsolutions'
export const COMPANY = 'Pena4 Tech Solutions'
export const JOBS_URL = 'https://www.pena4.com/jobs.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Pena4',
  adapter: 'script',
  modulePath: '../../scraper/pena4techsolutions/script.js',
  homepageUrl: 'https://www.pena4.com/',
  companyCareerPage: JOBS_URL,
  atsPlatform: 'official-first-party-jobs-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-region-tabs',
  extractionStrategy: 'verified-first-party-jobs-page+india-region-filter+same-page-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'pena4.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://www.pena4.com/jobs.php was the live first-party Pena4 jobs page, that it publicly exposed the Inpatient Medical Coder listing while older Pena4 job cards remained only inside commented HTML, and that the page included a first-party application form plus outbound Indeed and LinkedIn job links.',
  dryRunFile: 'pena4techsolutions/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const stripHtmlComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
const stripHtml = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialJobsPageSignal = (html) => {
  const page = stripHtmlComments(html)

  return /<title>\s*Jobs at Pena4 \| Join Our Team\s*<\/title>/i.test(page)
    && /Submit your resume and become a part of our team/i.test(page)
    && /View jobs on indeed/i.test(page)
    && /View jobs on linkedin/i.test(page)
    && /Job Application Form|Apply Now/i.test(page)
}

export const extractJobCards = (html) => {
  const page = stripHtmlComments(html)
  const cards = []

  for (const match of page.matchAll(/<h3>(.*?)<\/h3>[\s\S]{0,1200}?<div class="job-desc">([\s\S]*?)<\/div>/gi)) {
    const section = match[0]
    const title = stripHtml(match[1])
    const descriptionHtml = match[2]
    const description = stripHtml(
      descriptionHtml.match(/<span>\s*Description:\s*<\/span>\s*&nbsp;\s*([\s\S]*?)<\/p>/i)?.[1]
        || descriptionHtml.match(/Description:\s*([^<]+)/i)?.[1]
        || '',
    )

    if (!title || !description) continue

    cards.push({
      title,
      location: 'India',
      employmentType: /full time and part time/i.test(section) ? 'Full Time or Part Time' : null,
      remoteType: /100%\s*remote/i.test(section) ? 'Remote' : null,
      sourceUrl: JOBS_URL,
      applyUrl: JOBS_URL,
      jobDescription: description,
    })
  }

  return cards
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  const page = await fetchText(JOBS_URL)

  if (!hasOfficialJobsPageSignal(page)) {
    throw new Error('Pena4 Tech Solutions verified first-party jobs page changed materially')
  }

  const jobs = extractJobCards(page)
  if (!jobs.length) {
    throw new Error('Pena4 Tech Solutions verified first-party jobs page no longer exposes trusted openings')
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

