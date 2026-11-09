import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import AZIRO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AZIRO_CATALOG.source
export const COMPANY = AZIRO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AZIRO_CATALOG.officialBrandName
export const CAREERS_URL = AZIRO_CATALOG.companyCareerPage
export const VERIFIED_ON = AZIRO_CATALOG.verifiedOn
export const COMPANY_DOMAIN = AZIRO_CATALOG.companyDomain
export const PROVIDER_METADATA = AZIRO_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialAziroCareersSignal = (html) =>
  /Aziro Careers \| Join Our Team of Innovators Driving Technology Forward/i.test(String(html))
  && /formerly MSys Technologies/i.test(String(html))
  && /Current Openings/i.test(String(html))

export const extractAziroJobs = (html) => {
  const matches = String(html).matchAll(
    /<tr class="[^"]*cursor-pointer[^"]*"[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<\/tr>/gi,
  )

  const jobs = []

  for (const match of matches) {
    const title = normalizeWhitespace(match[1])
    const experience = normalizeWhitespace(match[2])
    const location = normalizeWhitespace(match[3])
    if (!title || !experience || !location) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: /bangalore/i.test(location) ? 'Bangalore' : null,
      country: /bangalore|india/i.test(location) ? 'India' : 'Global',
      jobId: slugify(`${title}-${experience}-${location}`),
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: experience,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `${title} - ${experience} - ${location}`,
      remoteStatus: /any location/i.test(location) ? 'Unspecified' : null,
    })
  }

  return jobs
}

export const createAziroScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialAziroCareersSignal(careersHtml)) {
      throw new Error('Aziro verified official careers surface changed')
    }

    const jobs = extractAziroJobs(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Aziro careers table no longer yields jobs')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createAziroScraper().run(options)

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
