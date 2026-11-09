import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.cms.com/careers'
export const FOUNTAIN_BOARD_URL = 'https://careers.ap-1.fountain.com/cms/a9218256-8fbf-40ab-936b-49ff5ff7c900'

const FOUNTAIN_HOST = new URL(FOUNTAIN_BOARD_URL).hostname
const FOUNTAIN_BOARD_PATH = new URL(FOUNTAIN_BOARD_URL).pathname.replace(/\/$/, '')
const FOUNTAIN_ACCOUNT_SLUG = 'cms'
const FOUNTAIN_BRAND_ID = 'a9218256-8fbf-40ab-936b-49ff5ff7c900'
const FOUNTAIN_API_ORIGIN = 'https://ap-1.fountain.com'
const FOREIGN_LOCATION_PATTERN =
  /\b(dubai|united arab emirates|uae|united states|usa|singapore|germany|france|australia|canada|united kingdom|uk)\b/i

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const defaultFetchPortalForm = async (jobId) => {
  const response = await fetch(buildFountainPortalApplicationFormUrl(jobId), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
      Accept: 'application/json',
    },
  })

  const bodyText = await response.text()
  let payload = null

  try {
    payload = JSON.parse(bodyText)
  } catch {
    payload = null
  }

  return {
    status: response.status,
    payload,
    bodyText,
  }
}

export const buildFountainOpeningsApiUrl = (page = 1) => {
  const url = new URL('/internal_api/career_site/openings', FOUNTAIN_API_ORIGIN)
  url.searchParams.set('career_site[account_slug]', FOUNTAIN_ACCOUNT_SLUG)
  url.searchParams.set('career_site[brand_id]', FOUNTAIN_BRAND_ID)
  url.searchParams.set('career_site[is_jobs_from_current_location]', 'true')
  url.searchParams.set('page', String(page))
  url.searchParams.set('radius', 'any')
  url.searchParams.set('sort_by', 'distance')
  url.searchParams.set('category', 'any')
  url.searchParams.set('compensation_type', 'any')
  url.searchParams.set('location', 'current_location')
  url.searchParams.set('locale', 'en-US')
  return url.toString()
}

export const buildFountainPortalApplicationFormUrl = (jobId) => {
  const url = new URL(`/internal_api/portal/${FOUNTAIN_ACCOUNT_SLUG}/application_forms/new`, FOUNTAIN_API_ORIGIN)
  url.searchParams.set('funnel_id', String(jobId))
  url.searchParams.set('try_new_ui', 'true')
  url.searchParams.set('brand_id', FOUNTAIN_BRAND_ID)
  return url.toString()
}

export const hasCmsCareersSignal = (html) => {
  const source = String(html ?? '')
  const visibleText = normalizeVisibleText(source)
  const boardUrlPattern = new RegExp(
    FOUNTAIN_BOARD_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/'),
    'i',
  )

  return /<title>\s*Business Services Company \| Careers \| CMS Info Systems\s*<\/title>/i.test(source)
    && /Where talent meets\s+Passion\.\s+Performance\.\s+Pride\./i.test(visibleText || '')
    && boardUrlPattern.test(source)
}

const isSafeFountainJobUrl = (value) => {
  try {
    const url = new URL(value, FOUNTAIN_BOARD_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== FOUNTAIN_HOST) return null
    if (!url.pathname.startsWith(`${FOUNTAIN_BOARD_PATH}/`)) return null
    return url.href.split('#')[0]
  } catch {
    return null
  }
}

const getJobId = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1)) || null
  } catch {
    return null
  }
}

const getCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const isIndiaLocation = (location) => /\bindia\b/i.test(location || '')

export const extractFountainJobs = (cards) => {
  const seenUrls = new Set()

  return (Array.isArray(cards) ? cards : [])
    .map((card) => {
      const title = normalizeWhitespace(card?.title)
      const location = normalizeWhitespace(card?.location)
      const sourceUrl = isSafeFountainJobUrl(card?.href)
      const jobId = sourceUrl ? getJobId(sourceUrl) : null

      if (!title || !location || !isIndiaLocation(location) || !sourceUrl || !jobId || seenUrls.has(sourceUrl)) {
        return null
      }

      seenUrls.add(sourceUrl)
      return {
        title,
        company: 'CMS Info Systems',
        department: normalizeWhitespace(card?.department),
        location,
        city: getCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
}

const getSafeFountainApplyUrl = (value) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (url.origin !== FOUNTAIN_API_ORIGIN) return null
    if (!url.pathname.startsWith(`/${FOUNTAIN_ACCOUNT_SLUG}/apply/`)) return null
    return url.href.split('#')[0]
  } catch {
    return null
  }
}

const findCanonicalCity = (value) => {
  const normalized = ` ${String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  const match = Object.entries(CANONICAL_CITIES)
    .sort(([left], [right]) => right.length - left.length)
    .find(([alias]) => normalized.includes(` ${alias.toLowerCase()} `))
  return match?.[1] || null
}

const getCityFromApiOpening = (opening) => findCanonicalCity(opening?.title)

const normalizeHtmlText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const inferExperienceFromDescription = (description) => {
  const normalized = normalizeWhitespace(description)
  if (!normalized) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const isFountainPortalNotApproved = (portalResponse = {}) => (
  portalResponse?.status === 401
  && /funnel not approved/i.test(String(
    portalResponse?.payload?.message
    || portalResponse?.bodyText
    || '',
  ))
)

export const extractFountainPortalJob = (job, portalResponse = {}) => {
  if (isFountainPortalNotApproved(portalResponse)) {
    return {
      ...job,
      publicExperienceChecked: true,
    }
  }

  const funnel = portalResponse?.payload?.funnel
  if (!funnel || portalResponse?.status !== 200) {
    return job
  }

  const jobDescription = normalizeHtmlText(funnel.position_description_html)

  return {
    ...job,
    title: normalizeWhitespace(funnel.title) || job.title,
    location: normalizeWhitespace(job.location),
    city: job.city || getCity(job.location),
    sourceUrl: normalizeWhitespace(job.sourceUrl),
    applyUrl: normalizeWhitespace(job.applyUrl),
    jobDescription: jobDescription || job.jobDescription,
    experienceRequired: inferExperienceFromDescription(jobDescription) || job.experienceRequired,
    publicExperienceChecked: true,
  }
}

export const extractFountainApiJobs = (payload = {}) => (Array.isArray(payload.openings) ? payload.openings : [])
  .map((opening) => {
    const title = normalizeWhitespace(opening?.title)
    const region = normalizeWhitespace(opening?.location)
    const city = getCityFromApiOpening(opening, payload)
    const applyUrl = getSafeFountainApplyUrl(opening?.apply_url)
    const jobId = normalizeWhitespace(opening?.id)

    if (!title || !region || !applyUrl || !jobId || FOREIGN_LOCATION_PATTERN.test(`${city || ''} ${region}`)) {
      return null
    }

    const locationParts = [city, region, 'India'].filter(Boolean).filter(
      (part, index, parts) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index,
    )

    return {
      title,
      company: 'CMS Info Systems',
      department: normalizeWhitespace(opening?.job_type),
      location: locationParts.join(', '),
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

const fetchAllFountainApiJobs = async (fetchJson) => {
  const jobs = []
  let page = 1

  while (page) {
    const payload = await fetchJson(buildFountainOpeningsApiUrl(page))
    jobs.push(...extractFountainApiJobs(payload))
    page = Number.isInteger(payload?.pagination?.next_page)
      ? payload.pagination.next_page
      : null
  }

  return jobs
}

const mapWithConcurrency = async (items, mapper, concurrency = 6) => {
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 0) }, () => worker()),
  )

  return results
}

export const createCmsComputersScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson
    const fetchPortalForm = options.fetchPortalForm || defaultFetchPortalForm
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasCmsCareersSignal(careersHtml)) {
      throw new Error('CMS careers page does not match the expected official CMS careers page structure')
    }

    const jobs = await fetchAllFountainApiJobs(fetchJson)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    const portalEnrichedJobs = await mapWithConcurrency(
      selectedJobs,
      async (job) => extractFountainPortalJob(job, await fetchPortalForm(job.jobId)),
    )

    return portalEnrichedJobs.map((job) => ({
      ...job,
      source: 'cmscomputers',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCmsComputersScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running CMS Computers scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cmscomputers')
    console.log('DB result:', result)
    process.exit(0)
  }
}
