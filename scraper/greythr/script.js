import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'

import { GREYTHR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GREYTHR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_URL = 'https://greytip.greythr.com/hire/jobs/'
export const JOBS_API_URL = 'https://greytip.greythr.com/hire/api/career/published_jobs/'
export const CATEGORIES_API_URL = 'https://greytip.greythr.com/hire/api/greythr/emp-category/'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal: options.signal,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method || 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
  signal: options.signal,
})

const fail = message => { throw new Error(`GreytHR ${message}`) }
const text = value => typeof value === 'string' ? value.trim() : ''
const assertListing = payload => {
  if (!Array.isArray(payload?.data) || payload.error || payload.success === false) fail('listing inventory is unavailable or malformed')
  const seen = new Set()
  for (const job of payload.data) {
    if (!job || !text(job.id) || !text(job.req_id) || !text(job.title) || !/^[a-z0-9-]+$/i.test(job.slug || '')
      || job.apply_url !== JOBS_URL + job.slug || seen.has(job.id)) fail('listing identity or application URL does not match the official tenant')
    seen.add(job.id)
  }
  return payload.data
}

const indiaLocations = (job, categories) => {
  const locationCategory = categories?.cat_extfield?.location
  if (!locationCategory || !categories?.value || !Array.isArray(job.locations) || !job.locations.length) fail('location dictionary or listing locations are missing')
  return [...new Set(job.locations.map(id => {
    const entry = categories.value[id]
    if (!entry || String(entry.cat_id) !== String(locationCategory) || !text(entry.name)) fail('listing location ID cannot be resolved by the official dictionary')
    return entry.name.trim()
  }))].filter(location => {
    const city = getValidIndiaCityForJob({ location })
    return city && city !== 'Remote'
  })
}

export const buildJobDetailsApiUrl = slug => `https://greytip.greythr.com/hire/api/sourcing/get_job/${encodeURIComponent(slug)}/`

const assertDetail = (listing, payload) => {
  const detail = payload?.job
  if (payload?.job_status !== 'published' || !detail || ['id', 'req_id', 'slug', 'title', 'apply_url'].some(key => detail[key] !== listing[key])
    || !Array.isArray(detail.locations) || [...detail.locations].sort().join('|') !== [...listing.locations].sort().join('|')) {
    fail('detail identity, published status or location conflicts with the listing')
  }
  if (!extractActiveDescription(detail.description)) fail('detail published description is missing')
  return detail
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = String(html).replace(/\s+/g, ' ')

  return normalized.includes('Career and Job Opportunities - Greytip Software')
    && normalized.includes('Begin the journey of your success here')
    && /Come,.{0,120}grow with us/i.test(normalized)
    && normalized.includes(JOBS_URL)
}

export const extractGreytHrJobs = (payload = {}, categories = {}) => {
  if (!categories?.cat_extfield?.location || !categories.value || typeof categories.value !== 'object'
    || categories.error || categories.success === false) fail('official location dictionary is unavailable or malformed')
  return assertListing(payload)
    .map((job) => {
      const locations = indiaLocations(job, categories)
      if (!locations.length) return null
      const description = extractActiveDescription(job.description)
      // The native client displays stored month counts as years for this unit.
      const experience = value => value == null || value === '' || !Number.isFinite(Number(value))
        ? null : Number(value) / (job.experience_units === 'years' ? 12 : 1)
      return {
        title: job.title.trim(),
        location: locations.join(', '),
        country: 'India',
        jobId: job.id,
        requisitionId: job.req_id,
        sourceUrl: job.apply_url,
        applyUrl: job.apply_url,
        jobType: job.job_type || null,
        minExperience: experience(job.min_exp),
        maxExperience: experience(job.max_exp),
        experienceUnits: job.experience_units || null,
        postedDate: job.published_on_career_page || job.created_at || null,
        postingDate: job.published_on_career_page || job.created_at || null,
        jobDescription: description,
        sourceDescription: description,
        jobDescriptionHtml: description ? job.description : null,
      }
    }).filter(Boolean)
}

export const createGreytHrScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified GreytHR careers surface no longer matches the trusted first-party jobs API')
    }

    const payload = await fetchJson(JOBS_API_URL, { method: 'POST', body: '{}', signal })
    assertListing(payload)
    const categories = await fetchJson(CATEGORIES_API_URL, { method: 'GET', signal })
    signal?.throwIfAborted()
    const jobs = extractGreytHrJobs(payload, categories)
    for (const job of jobs) {
      if (!job.jobDescription) {
        const listing = payload.data.find(row => row.id === job.jobId)
        const detail = assertDetail(listing, await fetchJson(buildJobDetailsApiUrl(listing.slug), { method: 'GET', signal }))
        signal?.throwIfAborted()
        job.jobDescription = job.sourceDescription = extractActiveDescription(detail.description)
        job.jobDescriptionHtml = detail.description
      }
      job.sourceListingComplete = true
    }
    return attachInventoryEvidence(jobs, {
      status: payload.data.length ? 'complete-inventory' : 'verified-empty',
      surface: JOBS_API_URL, firstParty: true, listingComplete: true,
      pagesFetched: 1, reportedTotal: payload.data.length, indiaFacetCount: jobs.length,
      verifiedAt: new Date().toISOString(),
      reason: 'Employer-linked published inventory; native descriptions and job identities validated; India locations resolved through the official employee-category dictionary.',
    })
  },
})

export const run = async (options = {}) => createGreytHrScraper().run(options)

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
