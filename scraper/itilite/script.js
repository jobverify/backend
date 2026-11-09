import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { ITILITE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ITILITE_CATALOG.source
export const COMPANY = ITILITE_CATALOG.companyName
export const VERIFIED_ON = ITILITE_CATALOG.verifiedOn
export const CAREERS_PAGE_URL = ITILITE_CATALOG.companyCareerPage
export const PROVIDER_METADATA = ITILITE_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  if (/^remote$/i.test(normalized)) {
    return {
      location: 'Remote, India',
      city: 'Remote',
      country: 'India',
    }
  }

  const normalizedCity = normalizeCity(normalized)

  return {
    location: `${normalizedCity}, India`,
    city: normalizedCity,
    country: 'India',
  }
}

const inferDepartment = (title) => {
  const normalized = normalizeWhitespace(title)?.toLowerCase() || ''

  if (/(sales development|account executive|sales manager)/i.test(normalized)) return 'Sales'
  if (/(software engineer|engineer\b)/i.test(normalized)) return 'Engineering'
  if (/(travel support|customer support)/i.test(normalized)) return 'Support & Resolution Center'
  if (/marketing/i.test(normalized)) return 'Marketing'
  if (/product/i.test(normalized)) return 'Product'
  if (/customer success/i.test(normalized)) return 'Customer Success'
  return null
}

export const extractLinkedInJobId = (value) =>
  String(value ?? '').match(/linkedin\.com\/jobs\/view\/(\d+)/i)?.[1] ?? null

export const pageHasOfficialItiliteSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*Careers at ITILITE India \| Join Our Team\s*<\/title>/i.test(page)
    && normalized.includes('view jobs')
    && (
      normalized.includes('open positions at itilite')
      || page.toLowerCase().includes('looking for a career in b2b saas? explore open roles at itilite india and be part of a team transforming corporate travel management.')
    )
    && /car_job-card/i.test(page)
    && /linkedin\.com\/jobs\/view\/\d+/i.test(page)
  }

const JOB_CARD_PATTERN =
  /<div[^>]+class="[^"]*car_job-card[^"]*"[^>]*>[\s\S]*?<div[^>]+class="[^"]*car_job-location[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div[^>]+class="[^"]*car_job-title[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/div>[\s\S]*?<a[^>]+href="([^"]*linkedin\.com\/jobs\/view\/\d+[^"]*)"[^>]*class="[^"]*car_job-apply[^"]*"[\s\S]*?<\/a>[\s\S]*?<\/div>/gi

export const extractJobsFromCareersPage = (html) => {
  const jobs = []
  const seenJobIds = new Set()

  for (const match of String(html ?? '').matchAll(JOB_CARD_PATTERN)) {
    const [, rawLocation, rawTitle, rawApplyUrl] = match
    const title = normalizeWhitespace(rawTitle)
    const applyUrl = normalizeWhitespace(rawApplyUrl)?.replace(/&amp;/g, '&') || null
    const jobId = extractLinkedInJobId(applyUrl)
    const locationData = parseLocation(rawLocation)

    if (!title || !applyUrl || !jobId || seenJobIds.has(jobId)) {
      continue
    }

    seenJobIds.add(jobId)

    jobs.push({
      title,
      company: COMPANY,
      department: inferDepartment(title),
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `Official ITILITE India careers page lists ${title} in ${locationData.location}. Apply via LinkedIn.`,
      publicExperienceChecked: true,
    })
  }

  return jobs
}

export const createItiliteScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_PAGE_URL)
    if (!pageHasOfficialItiliteSignals(html)) {
      throw new Error('Itilite official India careers page no longer matches the verified public surface')
    }

    const jobs = extractJobsFromCareersPage(html)
    if (jobs.length === 0) {
      throw new Error('Itilite official India careers page no longer matches the verified public surface')
    }

    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = now()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createItiliteScraper(options).run(options)

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
