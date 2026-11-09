import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import SNYK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = SNYK_CATALOG.source
export const COMPANY = SNYK_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SNYK_CATALOG.officialBrandName
export const VERIFIED_ON = SNYK_CATALOG.verifiedOn
export const PROVIDER_METADATA = SNYK_CATALOG
export const CAREERS_URL = SNYK_CATALOG.officialCareersLandingUrl
export const JOBS_PAGE_URL = SNYK_CATALOG.companyCareerPage
export const ASHBY_BOARD_TOKEN = SNYK_CATALOG.ashbyBoardToken
export const ASHBY_BOARD_URL = SNYK_CATALOG.ashbyBoardUrl
export const ASHBY_JOBS_API_URL = SNYK_CATALOG.ashbyJobsApiUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

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
    Referer: JOBS_PAGE_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title[^>]*>\s*Careers\s*\|\s*Snyk\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/snyk\.io\/careers\/["']/i.test(page)
    && normalized.includes('join us on our mission')
    && /href=["']\/careers\/all-jobs\/["']/i.test(page)
}

export const hasVerifiedJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title[^>]*>\s*Open jobs\s*\|\s*Snyk\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/snyk\.io\/careers\/all-jobs\/["']/i.test(page)
    && /id=["']all-jobs["']/i.test(page)
    && normalized.includes('open security')
    && page.includes(`${ASHBY_BOARD_URL}/`)
}

export const extractVisibleJobIds = (html = '') => new Set(
  [...String(html).matchAll(new RegExp(
    `${ASHBY_BOARD_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/([a-f0-9-]{36})`,
    'gi',
  ))].map((match) => match[1].toLowerCase()),
)

const chooseIndiaLocation = (job) => {
  const primaryCountry = normalizeWhitespace(job?.address?.postalAddress?.addressCountry)
  if (primaryCountry === 'India' || /\bIndia\b/i.test(job?.location || '')) {
    return normalizeWhitespace(job.location)
  }
  const secondary = (Array.isArray(job?.secondaryLocations) ? job.secondaryLocations : [])
    .find((item) => normalizeWhitespace(item?.address?.postalAddress?.addressCountry) === 'India')
  return normalizeWhitespace(secondary?.location)
}

const validateAshbyInventory = (payload, pageIds) => {
  const jobs = payload?.jobs
  if (payload?.apiVersion !== '1' || !Array.isArray(jobs) || jobs.length === 0) {
    throw new Error('Snyk Ashby inventory changed materially')
  }
  const apiIds = new Set()
  for (const job of jobs) {
    const id = normalizeWhitespace(job?.id)?.toLowerCase()
    if (
      !/^[a-f0-9-]{36}$/.test(id || '')
      || !normalizeWhitespace(job?.title)
      || !normalizeWhitespace(job?.location)
      || job?.isListed !== true
      || job?.jobUrl !== `${ASHBY_BOARD_URL}/${id}`
      || job?.applyUrl !== `${ASHBY_BOARD_URL}/${id}/application`
      || apiIds.has(id)
    ) {
      throw new Error('Snyk Ashby inventory changed materially')
    }
    apiIds.add(id)
  }
  if (apiIds.size !== pageIds.size || [...apiIds].some((id) => !pageIds.has(id))) {
    throw new Error('Snyk Ashby inventory differs from official jobs page')
  }
  return jobs
}

export const extractIndiaJobsFromPayload = (payload) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => chooseIndiaLocation(job))
    .map((job) => ({
      title: normalizeWhitespace(job.title),
      company: COMPANY,
      location: chooseIndiaLocation(job),
      country: 'India',
      link: job.jobUrl,
      applyUrl: job.applyUrl,
      sourceUrl: job.jobUrl,
      source: SOURCE,
      jobId: job.id,
      requisitionId: job.id,
      department: normalizeWhitespace(job.department),
      employmentType: normalizeWhitespace(job.employmentType),
      postingDate: normalizeWhitespace(job.publishedAt),
      jobDescription: normalizeWhitespace(job.descriptionPlain),
      remoteStatus: normalizeWhitespace(job.workplaceType),
      requiredSkills: [],
    }))

export const createSnykScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Verified Snyk careers landing page changed materially')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasVerifiedJobsPageSignal(jobsPageHtml)) {
      throw new Error('Verified Snyk jobs page changed materially')
    }

    const payload = await fetchJson(ASHBY_JOBS_API_URL)
    const listedJobs = validateAshbyInventory(payload, extractVisibleJobIds(jobsPageHtml))
    const jobs = extractIndiaJobsFromPayload(payload)
    return attachInventoryEvidence(jobs, {
      status: 'complete-inventory',
      surface: JOBS_PAGE_URL,
      firstParty: true,
      listingComplete: true,
      pagesFetched: 1,
      reportedTotal: listedJobs.length,
      indiaFacetCount: jobs.length,
      verifiedAt: new Date().toISOString(),
      reason: 'official-snyk-jobs-page-matches-current-ashby-board-inventory',
    })
  },
})

export const run = async (options = {}) => createSnykScraper(options).run(options)

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
