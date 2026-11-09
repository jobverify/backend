import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import TECHILA_GLOBAL_SERVICES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TECHILA_GLOBAL_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(india|pune|mumbai|bangalore|bengaluru|bareilly|gurgaon|gurugram|noida|delhi|chennai|hyderabad|kolkata|coimbatore|ahmedabad)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')

const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|ul|ol|h[1-6]|span)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => stripTags(value) || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (normalized === 'FULL_TIME') return 'Full Time'
  if (normalized === 'PART_TIME') return 'Part Time'
  if (normalized === 'CONTRACTOR') return 'Contract'
  return normalized.replace(/-/g, ' ')
}

const splitSkills = (value) => normalizeText(value)
  ?.split(/[,\n]/)
  .map((item) => normalizeText(item))
  .filter(Boolean) ?? []

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const extractLocationRoot = (value = '') =>
  normalizeText(
    String(value)
      .replace(/\b(Onsite|Remote|Hybrid)\b.*$/i, '')
      .replace(/[^a-zA-Z0-9\s]+$/g, ''),
  )

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

  return /Current openings/i.test(page)
    && /View Open Roles/i.test(page)
    && /href="\/careers\//i.test(page)
}

export const extractJobCards = (html = '') => {
  const cards = []
  const matches = String(html ?? '').matchAll(
    /<a[^>]+href="(\/careers\/[^"]+)"[^>]*>([\s\S]*?Copy job code[\s\S]*?)<\/a>/gi,
  )

  for (const match of matches) {
    const detailUrl = toAbsoluteUrl(match[1])
    const block = match[2]
    const spanTexts = [...block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((item) => normalizeText(item[1]))
      .filter(Boolean)
    const jobCode = spanTexts.find((item) => /^JB\d+$/i.test(item)) ?? null
    const title = spanTexts.find((item) =>
      item !== jobCode
      && !/onsite|remote|hybrid/i.test(item)
      && !/full[- ]time|part[- ]time|contract|internship/i.test(item)) ?? null
    const locationLabel = spanTexts.find((item) => /onsite|remote|hybrid/i.test(item)) ?? null
    const employmentTypeLabel = spanTexts.find((item) =>
      /full[- ]time|part[- ]time|contract|internship/i.test(item)) ?? null
    const jobId = detailUrl.split('/').filter(Boolean).pop() ?? null

    if (!jobId || !jobCode || !title || !locationLabel) continue

    cards.push({
      jobId,
      jobCode,
      title,
      locationLabel,
      employmentTypeLabel,
      detailUrl,
    })
  }

  return cards
}

export const extractJobPostingJsonLd = (html = '') => {
  const matches = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )]

  for (const match of matches) {
    try {
      const payload = JSON.parse(match[1])
      const items = Array.isArray(payload) ? payload : [payload]
      const jobPosting = items.find((item) => item?.['@type'] === 'JobPosting')
      if (jobPosting) return jobPosting
    } catch {
      continue
    }
  }

  return null
}

const isIndiaLocation = ({ locality, locationLabel }) =>
  INDIA_LOCATION_PATTERN.test(`${locality ?? ''} ${locationLabel ?? ''}`)

const buildIndiaLocation = (locality) => {
  const city = normalizeText(locality)
  if (!city) return { city: null, location: null }
  return {
    city,
    location: `${city}, India`,
  }
}

const buildJobFromCardAndPosting = (card, posting) => {
  const locality = posting?.jobLocation?.address?.addressLocality ?? null
  if (!isIndiaLocation({ locality, locationLabel: card.locationLabel })) return null

  const { city, location } = buildIndiaLocation(locality || extractLocationRoot(card.locationLabel))
  return {
    title: normalizeText(posting?.title) || card.title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: 'India',
    jobId: card.jobId,
    requisitionId: card.jobCode,
    sourceUrl: card.detailUrl,
    applyUrl: card.detailUrl,
    employmentType: normalizeEmploymentType(posting?.employmentType || card.employmentTypeLabel),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: splitSkills(posting?.skills),
    postingDate: normalizeText(posting?.datePosted),
    closingDate: normalizeText(posting?.validThrough),
    jobDescription: normalizeText(posting?.description),
  }
}

export const createTechilaGlobalServicesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const listingHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(listingHtml)) {
      throw new Error('The verified Techila Global Services careers page no longer matches the trusted first-party surface')
    }

    const cards = extractJobCards(listingHtml)
    if (cards.length === 0) {
      throw new Error('Techila Global Services careers page no longer exposes the verified open-role cards')
    }

    const jobs = []
    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)
      const posting = extractJobPostingJsonLd(detailHtml)
      if (!posting) continue
      const job = buildJobFromCardAndPosting(card, posting)
      if (job) jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('Techila Global Services detail pages no longer expose verified India JobPosting data')
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createTechilaGlobalServicesScraper().run(options)

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
