import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { COLAN_INFOTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = COLAN_INFOTECH_CATALOG
export const SOURCE = COLAN_INFOTECH_CATALOG.source
export const COMPANY = COLAN_INFOTECH_CATALOG.companyName
export const CAREERS_URL = COLAN_INFOTECH_CATALOG.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, '\'')
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&#8217;/gi, '\'')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Career - Colan Infotech/i.test(page)
    && /Build your future at Colan/i.test(text)
    && /LATEST JOBS/i.test(text)
}

const extractLegacyField = (section, label) =>
  normalizeWhitespace(
    String(section ?? '').match(new RegExp(`${escapeRegex(label)}\\s*:?\\s*([^<\\n]+)`, 'i'))?.[1] ?? '',
  )

const extractDetailField = (section, label) => {
  const source = String(section ?? '')
  const escapedLabel = escapeRegex(label)
  const structuredValue = source.match(
    new RegExp(
      `<label[^>]*>\\s*${escapedLabel}\\s*<\\/label>\\s*:?\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`,
      'i',
    ),
  )?.[1]
  const inlineValue = source.match(new RegExp(`${escapedLabel}\\s*:?\\s*([^<\\n]+)`, 'i'))?.[1]

  return normalizeWhitespace(structuredValue ?? inlineValue ?? '')
}

const extractListItems = (html) =>
  Array.from(String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const extractLegacySections = (html = '') =>
  Array.from(String(html ?? '').matchAll(/<section[^>]*class="job-detail"[^>]*>([\s\S]*?)<\/section>/gi))
    .map((match) => match[1])

const extractCurrentDetailSections = (html = '') =>
  Array.from(String(html ?? '').matchAll(/<tr[^>]*class="job_detail_description"[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((match) => match[1])

const buildJobRecord = ({
  title,
  location,
  jobId,
  employmentType,
  experienceRequired,
  minimumQualification,
  descriptionItems,
  now,
}) => {
  const city = normalizeWhitespace(location)

  return {
    title: normalizeWhitespace(title),
    company: COMPANY,
    department: null,
    location: city ? `${city}, India` : null,
    city: city || null,
    state: null,
    country: 'India',
    jobId: normalizeWhitespace(jobId),
    requisitionId: normalizeWhitespace(jobId),
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: normalizeWhitespace(employmentType) || null,
    experienceRequired: normalizeWhitespace(experienceRequired) || null,
    minimumQualification: normalizeWhitespace(minimumQualification) || null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: descriptionItems.join(' '),
    source: SOURCE,
    link: CAREERS_URL,
    scrapedAt: now(),
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

const extractJobsFromCurrentSections = (html, now) =>
  extractCurrentDetailSections(html).map((section) => buildJobRecord({
    title: extractDetailField(section, 'Designation'),
    location: extractDetailField(section, 'Location'),
    jobId: extractDetailField(section, 'Job Code'),
    employmentType: extractDetailField(section, 'Job type'),
    experienceRequired: extractDetailField(section, 'Experience'),
    minimumQualification: extractDetailField(section, 'Qualification'),
    descriptionItems: extractListItems(section),
    now,
  }))

const extractJobsFromLegacySections = (html, now) =>
  extractLegacySections(html).map((section) => buildJobRecord({
    title: extractLegacyField(section, 'Designation'),
    location: extractLegacyField(section, 'Location'),
    jobId: extractLegacyField(section, 'Job Code'),
    employmentType: extractLegacyField(section, 'Job type'),
    experienceRequired: extractLegacyField(section, 'Experience'),
    minimumQualification: extractLegacyField(section, 'Qualification'),
    descriptionItems: extractListItems(section),
    now,
  }))

export const createColanInfotechScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Colan Infotech careers page no longer matches the verified first-party surface')
    }

    const currentJobs = extractJobsFromCurrentSections(careersHtml, now)
    const legacyJobs = currentJobs.length > 0 ? [] : extractJobsFromLegacySections(careersHtml, now)
    const jobs = [...currentJobs, ...legacyJobs]
      .filter((job) => job.title && job.jobId && job.jobDescription)

    if (jobs.length === 0) {
      throw new Error('Colan Infotech careers page no longer yields inline openings')
    }

    return jobs
  },
})

export const run = async (options = {}) => createColanInfotechScraper().run(options)

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
