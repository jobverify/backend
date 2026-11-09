import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TCG_DIGITAL_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TCG_DIGITAL_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
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
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Careers')
    && normalized.includes('Explore Open Roles')
    && normalized.includes('Openings')
    && /careers@tcgdigital\.com/i.test(String(html ?? ''))
}

const extractField = (block, label) => {
  const match = String(block).match(new RegExp(`${label}\\s+([\\s\\S]*?)(?=<div>|</section>|$)`, 'i'))
  return normalizeWhitespace(match?.[1] || '')
}

const locationToRemoteStatus = (location) => {
  if (/hybrid/i.test(location)) return 'Hybrid'
  if (/remote/i.test(location)) return 'Remote'
  return 'On-site'
}

export const extractJobs = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(/<section[^>]*class=["'][^"']*opening[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)) {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '')
    const location = extractField(block, 'Location')

    if (!title || !location || !/india|pune|bangalore|hyderabad|gurgaon|jaipur/i.test(location)) {
      continue
    }

    const jobId = slugify(title)
    const city = normalizeWhitespace(location.split('(')[0].split('/')[0].split(',')[0])

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${location}, India`,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      applyUrl: `mailto:careers@tcgdigital.com?subject=${encodeURIComponent(title)}`,
      employmentType: null,
      experienceRequired: extractField(block, 'Experience') || null,
      minimumQualification: extractField(block, 'Education') || null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: locationToRemoteStatus(location),
    })
  }

  return jobs
}

export const createTcgDigitalSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified TCG Digital careers page changed materially')
    }

    return extractJobs(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTcgDigitalSolutionsScraper().run(options)

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
