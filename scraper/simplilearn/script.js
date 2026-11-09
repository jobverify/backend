import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.simplilearn.com/careers'
export const JOB_OPENINGS_URL = 'https://www.simplilearn.com/job-openings'
export const CAREERS_API_URL = 'https://www.simplilearn.com/wp-json/wp/v2/awsm_job_openings'
export const PAGE_SIZE = 100
export const CEIPAL_API_KEY = 'NDlYd05RTlF2REZhaHVnTEdjT294dz09'
export const CEIPAL_PORTAL_ID = 'Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09'
const CEIPAL_API_BASE = 'https://careerapi.ceipal.com/' + CEIPAL_API_KEY + '/CareerPortalJobPostings/'

const COMPANY = 'Simplilearn'
const SOURCE = 'simplilearn'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => {
  const normalized = decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const titleCase = (value) => normalizeText(value)
  ?.split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ') || null

const classSlugToLabel = (slug) => titleCase(String(slug ?? '').replace(/-/g, ' '))

const getClassSlug = (classList, prefix) => {
  const match = (Array.isArray(classList) ? classList : [])
    .find((className) => String(className).startsWith(prefix))

  return match ? String(match).slice(prefix.length) : null
}

const toLocationLabel = (city) => (city ? `${city}, India` : null)

const toRemoteStatus = (employmentType, city) => {
  const combined = `${employmentType || ''} ${city || ''}`.toLowerCase()
  if (combined.includes('remote')) return 'Remote'
  if (combined.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

export const hasOfficialCareersSignal = (html) =>
  /simplilearn/i.test(html || '')
  && /careers/i.test(html || '')
  && /href=['"][^'"]*\/job-openings[^'"]*['"]/i.test(html || '')

export const hasOfficialJobOpeningsSignal = (html) =>
  /simplilearn/i.test(html || '')
  && /job openings/i.test(html || '')

const assertVerifiedFeed = (records) => {
  if (!Array.isArray(records)) {
    throw new Error('Simplilearn feed no longer matches the verified WP Job Openings feed')
  }

  return records
}

export const buildSearchUrl = (page, pageSize = PAGE_SIZE) => {
  const url = new URL(CAREERS_API_URL)
  url.searchParams.set('_fields', 'id,link,title,content,class_list')
  url.searchParams.set('per_page', String(pageSize))
  url.searchParams.set('page', String(page))
  return url.toString()
}

export const extractSearchResults = (records) => assertVerifiedFeed(records)
  .map((record) => {
    const classList = Array.isArray(record?.class_list) ? record.class_list : []
    const title = normalizeText(record?.title?.rendered)
    const jobId = record?.id == null ? null : String(record.id)
    const sourceUrl = normalizeText(record?.link)
    const city = classSlugToLabel(getClassSlug(classList, 'job-location-'))
    const department = classSlugToLabel(getClassSlug(classList, 'job-category-'))
    const employmentType = classSlugToLabel(getClassSlug(classList, 'job-type-'))
    const remoteStatus = toRemoteStatus(employmentType, city)

    return {
      title,
      company: COMPANY,
      department,
      location: toLocationLabel(city),
      city,
      country: city ? 'India' : null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeText(record?.content?.rendered),
      remoteStatus,
    }
  })
  .filter((job) => job.title && job.jobId && job.sourceUrl)

const fetchSimplilearnResponse = async (url, options) => {
  const response = await fetch(url, options)
  if (String(url).startsWith(CEIPAL_API_BASE) && response.status === 400) {
    let payload
    try { payload = await response.clone().json() } catch { /* Other 400s remain contract failures. */ }
    if (payload?.status === 400 && /^Your? request is invalid\.\s*Please send the request from the Career Portal\.?$/i.test(payload.message || '')) {
      throw Object.assign(new Error('Simplilearn CEIPAL HTTP 400: provider rejected its verified Career Portal request; current inventory is unavailable.'), {
        status: 400, softFailure: true, upstreamOutage: true,
        failureKind: 'blocked_or_access_denied', abortRetries: true,
      })
    }
  }
  return response
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  fetchImpl: fetchSimplilearnResponse,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 30000,
})

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 30000,
})


const hasCeipalMigrationSurface = html => /<iframe\b[^>]*id=["']careers_api_source["']|jobsapi\.ceipal\.com|Explore Job Opportunities/i.test(String(html))

const extractCeipalHandoff = html => {
  const page = String(html)
  const iframes = [...page.matchAll(/<iframe\b[^>]*>/gi)].filter(match => /\bid=["']careers_api_source["']/i.test(match[0]))
  const embed = iframes[0]?.[0]
  const src = decodeHtml(embed?.match(/\bsrc=["']([^"']+)["']/i)?.[1])
  try {
    const url = new URL(src)
    if (!/<title[^>]*>\s*Job Openings\s*<\/title>/i.test(page)
      || !/<h1\b[^>]*>\s*Explore Job Opportunities\s*<\/h1>/i.test(page)
      || !/<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.simplilearn\.com\/job-openings["']/i.test(page)
      || !/<img\b[^>]*alt=["']Simplilearn["']/i.test(page)
      || iframes.length !== 1 || !/\btitle=["']Job openings at Simplilearn["']/i.test(embed)
      || url.origin !== 'https://jobsapi.ceipal.com' || url.pathname !== '/APISource/v1/index.html'
      || url.username || url.password || url.hash
      || url.searchParams.get('api_key') !== CEIPAL_API_KEY || url.searchParams.get('cp_id') !== CEIPAL_PORTAL_ID
      || url.searchParams.get('job_id') !== '' || url.searchParams.get('bgcolor') !== '1179ef'
      || [...url.searchParams.keys()].length !== 4) throw new Error('Changed branded portal or board identifiers')
    return url.toString()
  } catch (cause) { throw new Error('Simplilearn verified CEIPAL employer handoff identity changed', { cause }) }
}

export const buildCeipalListingUrl = page => CEIPAL_API_BASE + '?page=' + page
export const buildCeipalDetailUrl = id => CEIPAL_API_BASE + encodeURIComponent(id)
  + '/?from_career_portal=1&cp_id=' + CEIPAL_PORTAL_ID
const ceipalHeaders = widgetUrl => ({ Accept: 'application/json', Origin: 'https://jobsapi.ceipal.com', Referer: widgetUrl })
const listingBody = page => {
  const body = new FormData()
  for (const [key, value] of Object.entries({ page: String(page), api_key: CEIPAL_API_KEY,
    method: 'CareerPortalJobPostings', cp_id: CEIPAL_PORTAL_ID, from_career_portal: '1' })) body.set(key, value)
  return body
}

const validateCeipalListing = listing => {
  if (!listing || typeof listing.id !== 'string' || !/^[a-z0-9_-]+={0,2}$/i.test(listing.id)
    || !normalizeText(listing.public_job_title) || !normalizeText(listing.job_code)
    || typeof listing.country !== 'string' || !normalizeText(listing.country)) {
    throw new Error('Simplilearn CEIPAL listing identity or country contract changed')
  }
}

const validateCeipalPage = (payload, page) => {
  if (!payload || !Number.isInteger(payload.count) || payload.count < 0
    || !Number.isInteger(payload.num_pages) || payload.num_pages < 0
    || !Number.isInteger(payload.limit) || payload.limit <= 0
    || payload.page_number !== page || !Array.isArray(payload.results)
    || payload.page_count !== payload.results.length
    || payload.num_pages !== Math.ceil(payload.count / payload.limit)
    || payload.results.length !== Math.min(payload.limit, Math.max(0, payload.count - (page - 1) * payload.limit))
    || payload.next !== (page < payload.num_pages ? buildCeipalListingUrl(page + 1) : null)
    || payload.previous !== (page > 1 ? buildCeipalListingUrl(page - 1) : null)) {
    throw new Error('Simplilearn CEIPAL inventory count or pagination page contract changed')
  }
}

const collectCeipalJobs = async ({ widgetUrl, fetchText, fetchJson, now, signal }) => {
  signal?.throwIfAborted()
  const widgetHtml = await fetchText(widgetUrl, { signal })
  signal?.throwIfAborted()
  if (!/<title>\s*Careers\s*<\/title>/i.test(widgetHtml)
    || !/id=['"]list-of-jobs['"]/i.test(widgetHtml)
    || !/js\/app\.min\.js/i.test(widgetHtml)) throw new Error('Simplilearn CEIPAL public widget contract changed')
  const headers = ceipalHeaders(widgetUrl)
  const listings = []
  const seen = new Set()
  let expectedCount, expectedPages, expectedLimit
  for (let page = 1; page <= (expectedPages || 1); page++) {
    signal?.throwIfAborted()
    const payload = await fetchJson(buildCeipalListingUrl(page), { signal, method: 'POST', headers, body: listingBody(page) })
    signal?.throwIfAborted()
    validateCeipalPage(payload, page)
    if (page === 1) { expectedCount = payload.count; expectedPages = payload.num_pages; expectedLimit = payload.limit }
    else if (payload.count !== expectedCount || payload.num_pages !== expectedPages || payload.limit !== expectedLimit) {
      throw new Error('Simplilearn CEIPAL inventory count changed during pagination')
    }
    for (const listing of payload.results) {
      validateCeipalListing(listing)
      if (seen.has(listing.id)) throw new Error('Simplilearn CEIPAL inventory contains duplicate identity')
      seen.add(listing.id)
      listings.push(listing)
    }
  }
  if (listings.length !== expectedCount) throw new Error('Simplilearn CEIPAL inventory is incomplete')
  const jobs = []
  const scrapedAt = now()
  for (const listing of listings) {
    signal?.throwIfAborted()
    const detail = await fetchJson(buildCeipalDetailUrl(listing.id), { signal, method: 'GET', headers })
    signal?.throwIfAborted()
    if (detail?.company_url !== 'www.simplilearn.net'
      || normalizeText(detail.job_code) !== normalizeText(listing.job_code)
      || normalizeText(detail.public_job_title) !== normalizeText(listing.public_job_title)
      || normalizeText(detail.country) !== normalizeText(listing.country)) {
      throw new Error('Simplilearn CEIPAL detail employer, requisition, title, or country conflict')
    }
    if (normalizeText(detail.country) !== 'India') continue
    const source = new URL(widgetUrl)
    source.searchParams.set('job_id', listing.id)
    const sourceUrl = source.toString()
    const publishedLocations = normalizeText(listing.multpile_job_location)?.split(/\)\s*,\s*\(/)
      .map(value => value.replace(/[()]/g, '').trim()).filter(Boolean) || []
    const city = normalizeCity(normalizeText(listing.city) || publishedLocations[0]?.split(',')[0]?.trim())
    const state = normalizeText(listing.state)
    const locations = publishedLocations.map(value => value + ', India')
    const location = locations.join('; ') || [city, state, 'India'].filter(Boolean).join(', ')
    const employmentType = normalizeText(detail.pay_rates?.find(rate => normalizeText(rate.pay_rate_employment_type))?.pay_rate_employment_type)
      || normalizeText(listing.tax_terms)
    jobs.push({
      title: normalizeText(detail.public_job_title), company: COMPANY, source: SOURCE,
      jobId: listing.id, requisitionId: normalizeText(detail.job_code), sourceUrl,
      applyUrl: sourceUrl, link: sourceUrl, location, ...(locations.length ? { locations } : {}), city, state, country: 'India',
      department: normalizeText(detail.custom_fields?.sub_department), employmentType,
      experienceRequired: /^N\/A$/i.test(normalizeText(detail.experience) || '') ? null : normalizeText(detail.experience),
      minimumQualification: null, preferredQualification: null,
      requiredSkills: normalizeText(detail.primary_skills) ? [normalizeText(detail.primary_skills)] : [],
      jobDescription: normalizeText(detail.public_job_desc), postingDate: null, closingDate: null,
      remoteStatus: Number(detail.remote_opportunities) === 1 ? 'Remote' : Number(detail.remote_opportunities) === 2 ? 'Hybrid' : 'On-site',
      publicExperienceChecked: true, scrapedAt,
    })
  }
  return jobs
}

export const createSimplilearnScraper = ({
  pageSize = PAGE_SIZE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Simplilearn careers page no longer matches the verified official careers surface')
    }

    const jobOpeningsHtml = await fetchText(JOB_OPENINGS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialJobOpeningsSignal(jobOpeningsHtml)) {
      throw new Error('Simplilearn job openings page no longer matches the verified official job openings surface')
    }

    if (hasCeipalMigrationSurface(jobOpeningsHtml)) {
      return collectCeipalJobs({ widgetUrl: extractCeipalHandoff(jobOpeningsHtml), fetchText, fetchJson, now, signal })
    }

    const jobs = []

    for (let page = 1; ; page += 1) {
      signal?.throwIfAborted()
      const pageRecords = assertVerifiedFeed(await fetchJson(buildSearchUrl(page, pageSize), { signal }))
      signal?.throwIfAborted()

      jobs.push(...extractSearchResults(pageRecords).map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })))

      if (pageRecords.length < pageSize) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createSimplilearnScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Simplilearn scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
