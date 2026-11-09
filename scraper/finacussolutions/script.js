import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { runNativeFinacus } from './nativeCurrent.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { FINACUS_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FINACUS_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const DETAIL_AJAX_URL = 'https://www.finacus.co.in/wp-admin/admin-ajax.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFieldValue = (html, label) => normalizeWhitespace(
  String(html ?? '').match(
    new RegExp(`<li>\\s*<strong>\\s*${label}\\s*<\\/strong>\\s*:?\\s*([\\s\\S]*?)<\\/li>`, 'i'),
  )?.[1] ?? null,
)

const normalizeExperience = (value) => normalizeWhitespace(value)
  ?.replace(/\s+years?/i, ' years')
  || null

const normalizeLocation = (value) => normalizeWhitespace(value) || 'India'

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

export const extractJobDetail = (html = '', listing = {}) => {
  const title = normalizeWhitespace(
    String(html ?? '').match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? listing.title,
  ) || listing.title || null
  const location = normalizeLocation(extractFieldValue(html, 'Location') || listing.location)
  const description = stripTags(
    String(html ?? '').match(/<div class="career-offset-content[\s\S]*?>([\s\S]*?)<\/div>/i)?.[1]
      ?? html,
  )

  return {
    ...listing,
    title,
    department: extractFieldValue(html, 'Department') || listing.department || null,
    location,
    city: extractCity(location),
    experienceRequired: normalizeExperience(
      extractFieldValue(html, 'Work Experience') || listing.experienceRequired,
    ),
    jobDescription: description || listing.jobDescription || null,
    description: description || listing.jobDescription || null,
    publicExperienceChecked: true,
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(rawHtml) || ''

  return text.includes('Current Openings')
    && text.includes('Apply Now')
    && text.includes('Finacus Solutions Private Limited')
    && extractOpeningCards(rawHtml).length > 0
}

const extractOpeningCards = (html = '') => [...String(html ?? '').matchAll(
  /<a\b[^>]*data-id="([^"]+)"[^>]*data-career-position="([^"]+)"[^>]*>/gi,
)]
  .map((match) => ({
    jobId: normalizeWhitespace(match[1]),
    title: normalizeWhitespace(match[2]),
  }))
  .filter((card) => card.jobId && card.title)

export const extractSearchResults = (html = '') => {
  const seenJobIds = new Set()

  return extractOpeningCards(html)
    .filter((card) => {
      if (seenJobIds.has(card.jobId)) return false
      seenJobIds.add(card.jobId)
      return true
    })
    .map((card) => ({
      title: card.title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: card.jobId,
      requisitionId: card.jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: CAREERS_PAGE_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchDetailText = (jobId) => {
  const form = new FormData()
  form.append('action', 'finacus_careers_position_ajax_request')
  form.append('get_position_id', String(jobId ?? ''))

  return fetchTextWithRetry(DETAIL_AJAX_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
    },
    body: form,
    label: `${SOURCE}-detail`,
    timeoutMs: 15000,
  })
}

const createLegacyFinacusSolutionsScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchDetailText = defaultFetchDetailText,
    now: overrideNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Finacus Solutions verified official careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractSearchResults(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Finacus Solutions verified careers page no longer exposes the expected first-party role cards')
    }

    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = (overrideNow || now)()
    const jobsWithDetails = await Promise.all(selectedJobs.map(async (job) => {
      try {
        const detailHtml = await fetchDetailText(job.jobId)
        return extractJobDetail(detailHtml, job)
      } catch {
        return job
      }
    }))

    return jobsWithDetails.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createFinacusSolutionsScraper(options).run(options)

export const createFinacusSolutionsScraper = (defaults = {}) => ({
  async run(options = {}) {
    const combined = {...defaults,...options}
    if (!options.fetchText && !options.fetchDetailText) return runNativeFinacus(combined)
    const jobs = await createLegacyFinacusSolutionsScraper(defaults).run(options)
    return attachInventoryEvidence(jobs.map(job=>({...job,nativeLocation:job.nativeLocation||job.location,country:null,city:null,location:null,locations:[],sourceScopeComplete:false,lifecycleCleanupAllowed:false,sourceListingComplete:false,sourceDetailComplete:false,sourceDetailFailureKind:'native-country-unqualified-legacy',sourceDetailStatus:'legacy-native-contract-unqualified'})),{status:'discovery-only',surface:CAREERS_PAGE_URL,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'legacy-unreconciled-native-contract'})
  },
})

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
