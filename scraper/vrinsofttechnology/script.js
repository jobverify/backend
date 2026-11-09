import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vrinsofttechnology'
export const COMPANY = 'Vrinsoft Technology'
export const CAREERS_URL = 'https://www.vrinsofts.com/career.html'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Vrinsoft',
  adapter: 'script',
  modulePath: '../../scraper/vrinsofttechnology/script.js',
  homepageUrl: 'https://www.vrinsofts.com/',
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'verified-first-party-careers-page+same-page-job-cards+apply-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'vrinsofts.com',
  verifiedOn: '2026-07-17',
  verifiedSurfaceSummary:
    'Verified on Friday, July 17, 2026 that https://www.vrinsofts.com/career.html was the live first-party Vrinsoft careers page, and that the page exposed public developer and engineer hiring signals plus first-party Apply Now job links.',
  dryRunFile: 'vrinsofttechnology/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const defaultFetchText = (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => fetchTextWithRetry(url, {
  fetchImpl,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Vrinsoft Careers \| Jobs in AI, Web &amp; Software Development/i.test(page)
    && /Apply Now/i.test(page)
    && /career-hiring-heading1/i.test(page)
    && /Apply Now On\s*<a href="mailto:hr@vrinsofts\.com">/i.test(page)
}

export const extractJobCards = (html) => {
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(
    /<div class="accordion-item accordion-item-career"[\s\S]*?<div class="accordion-header" id="([^"]+)"[\s\S]*?<p class="heading-four blue-text">([\s\S]*?)<\/p>[\s\S]*?<div class="career-hiring-details">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<a[^>]*class="[^"]*apply-btn[^"]*"[^>]*data-id="([^"]+)"[^>]*>/gi,
  )) {
    const headingId = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const details = normalizeWhitespace(match[3])
    const jobId = normalizeWhitespace(match[4])

    const detailsMatch = details.match(/^(.*?\byears?)\s+([A-Za-z][A-Za-z\s]+)$/i)
    const experienceRequired = normalizeWhitespace(detailsMatch?.[1] || null)
    const city = normalizeWhitespace(detailsMatch?.[2] || null)

    if (!title || !city || !jobId) continue

    const sourceUrl = `${CAREERS_URL}#${headingId || `job-${jobId}`}`
    jobs.push({
      title,
      location: `${city}, India`,
      city,
      sourceUrl,
      applyUrl: sourceUrl,
      jobId,
      requisitionId: jobId,
      experienceRequired,
    })
  }

  return jobs
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  const page = await fetchText(CAREERS_URL)

  if (!hasOfficialCareersSignal(page)) {
    throw new Error('Vrinsoft Technology verified first-party careers page changed materially')
  }

  const jobs = extractJobCards(page)
  if (!jobs.length) {
    throw new Error('Vrinsoft Technology verified first-party careers page no longer exposes trusted job cards')
  }

  return jobs.map((job) => ({
    ...job,
    company: COMPANY,
    country: 'India',
    city: job.city || null,
    employmentType: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    link: job.applyUrl || job.sourceUrl,
    source: SOURCE,
    scrapedAt: now(),
  }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}

