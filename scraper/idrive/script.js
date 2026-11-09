import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IDRIVE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IDRIVE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_JOBS_WIDGET_URL = PROVIDER_METADATA.officialJobsWidgetUrl
export const WIDGET_FEED_URL = PROVIDER_METADATA.jobsFeedUrl
export const WIDGET_SETTINGS_URL = PROVIDER_METADATA.widgetSettingsUrl
export const WIDGET_EMBED_INFO_URL = PROVIDER_METADATA.widgetEmbedInfoUrl
export const WIDGET_EMBED_ID = PROVIDER_METADATA.widgetEmbedId

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const EMPLOYMENT_TYPE_TAGS = new Set([
  'Part-time',
  'Full-time',
  'Internship',
  'Contract',
  'Temporary',
  'Freelance',
  'Volunteer',
])

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#174;|&reg;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul)\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')

  return normalizeWhitespace(normalized)
}

const toArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []

export const extractWidgetEmbedId = (html = '') => {
  const page = String(html ?? '')

  return (
    page.match(/widgets\.sociablekit\.com\/indeed-jobs\/iframe\/(\d+)/i)?.[1]
    || page.match(/data-embed-id=["'](\d+)["']/i)?.[1]
    || null
  )
}

export const hasOfficialIDriveCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()

  return /<title>\s*Careers at IDrive(?:\s|&reg;|®)*<\/title>/i.test(page)
    && normalized.includes('current job openings')
    && /jobs@idrive\.com/i.test(page)
    && extractWidgetEmbedId(page) === WIDGET_EMBED_ID
  }

export const hasExpectedWidgetFeedIdentity = (feed = {}) => {
  const bio = feed?.bio || {}
  const settings = feed?.settings || {}
  const userInfo = feed?.user_info || {}
  const fullName = normalizeWhitespace(bio.full_name)
  const profileDescription = normalizeWhitespace(bio.profile_description)
  const profileLink = normalizeWhitespace(bio.link)
  const embedIds = [bio.embed_id, settings.embed_id, userInfo.embed_id]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)

  return fullName === 'IDrive'
    && profileDescription?.includes('IDrive jobs')
    && /indeed\.com\/cmp\/Idrive-2\/jobs/i.test(profileLink || '')
    && embedIds.every((value) => value === WIDGET_EMBED_ID)
  }

export const extractWidgetPosts = (feed = {}) =>
  Array.isArray(feed?.posts)
    ? feed.posts.filter((post) => post && typeof post === 'object')
    : []

const extractEmploymentType = (tags = []) =>
  toArray(tags).find((tag) => EMPLOYMENT_TYPE_TAGS.has(tag)) || null

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeUrl = (value) => {
  try {
    return new URL(String(value ?? '')).toString()
  } catch {
    return null
  }
}

export const mapWidgetPostToJob = (post = {}, { now = () => new Date().toISOString() } = {}) => {
  const link = normalizeUrl(post.job_link || post.link)
  const title = normalizeWhitespace(post.job_title || post.title)
  const company = normalizeWhitespace(post.company) || COMPANY
  const location = normalizeWhitespace(post.location)
  const tags = toArray(post.tags)
  const jobId = normalizeWhitespace(post.job_id) || null

  return {
    jobId,
    requisitionId: jobId,
    title,
    company,
    location,
    city: extractCity(location),
    link,
    applyUrl: link,
    sourceUrl: link,
    source: SOURCE,
    atsPlatform: ATS_PLATFORM,
    employmentType: extractEmploymentType(tags),
    jobDescription: stripTags(post.description),
    postingDate: normalizeWhitespace(post.date_time || post.date),
    tags,
    scrapedAt: now(),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'idrive-official',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: 'idrive-widget',
  timeoutMs: 15000,
})

export const createIDriveScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (!hasOfficialIDriveCareersSignals(careersHtml)) {
      throw new Error('IDrive official careers page no longer matches the verified public surface')
    }

    const widgetEmbedId = extractWidgetEmbedId(careersHtml)
    if (widgetEmbedId !== WIDGET_EMBED_ID) {
      throw new Error('IDrive official careers page no longer points to the verified widget embed')
    }

    const feed = await fetchJson(WIDGET_FEED_URL)
    if (!hasExpectedWidgetFeedIdentity(feed)) {
      throw new Error('IDrive widget feed identity no longer matches the verified official embed')
    }

    return extractWidgetPosts(feed)
      .map((post) => mapWidgetPostToJob(post, { now }))
      .filter((job) => job.title && job.location && job.applyUrl)
  },
})

export const run = async (options = {}) => createIDriveScraper().run(options)

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
