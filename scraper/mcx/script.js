import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mcx'
export const COMPANY = 'MCX'
export const HOMEPAGE_URL = 'https://www.mcxindia.com/'
export const CAREERS_URL = 'https://www.mcxindia.com/careers/job-openings'
export const JOBS_API_URL = 'https://www.mcxindia.com/careers/job-openings/GetFilteredAnnouncements'
export const JOB_DETAIL_URL = 'https://www.mcxindia.com/careers/job-openings/job-detail'
export const APPLY_URL = 'https://www.mcxindia.com/careers/apply-online'
export const COMPANY_DOMAIN = 'www.mcxindia.com'
export const ATS_PLATFORM = 'official-company-careers'
export const VERIFIED_ON = '2026-08-03'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeMeaningfulText = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || normalized === '-') return null
  return normalized
}

const extractResponsibilities = (html = '') => {
  const items = [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  if (items.length > 0) return items

  return String(html ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => stripTags(line))
    .filter(Boolean)
}

const buildJobDescription = ({ role, location, minimumQualification, experienceRequired, responsibilities }) => [
  role ? `Role: ${role}` : null,
  location ? `Location: ${location}` : null,
  minimumQualification ? `Qualification Profile: ${minimumQualification}` : null,
  experienceRequired ? `Experience: ${experienceRequired}` : null,
  responsibilities.length > 0 ? 'Job Responsibilities:' : null,
  ...responsibilities.map((item) => `- ${item}`),
].filter(Boolean).join('\n')

const buildDetailUrl = (jobRole) => {
  const url = new URL(JOB_DETAIL_URL)
  url.searchParams.set('JobRole', jobRole)
  return url.toString()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const defaultFetchJson = async (url) => JSON.parse(await fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    'X-Requested-With': 'XMLHttpRequest',
  },
  label: `${SOURCE}-json`,
  timeoutMs: 20000,
}))

export const hasVerifiedCurrentOpeningsPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Current Openings\s*<\/title>/i.test(page)
    && text.includes('Current Openings')
    && page.includes('selectJobRole')
    && page.includes('selectLocation')
    && page.includes('/careers/apply-online')
    && /careers@mcxindia\.com/i.test(page)
}

export const hasVerifiedApplyOnlineSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title[^>]*>\s*Apply Online\s*<\/title>/i.test(page)
    && text.includes('Apply Online')
    && /careers@mcxindia\.com/i.test(page)
    && page.includes('current-opening-apply')
    && page.includes('careerstoken')
    && page.includes('SubmitButton1')
}

export const hasAnnouncementsPayloadSignal = (payload = {}) => {
  const announcements = Array.isArray(payload?.Announcements) ? payload.Announcements : []
  if (announcements.length === 0) return false

  return announcements.every((item) =>
    normalizeMeaningfulText(item?.JobRole || item?.Title),
  )
}

const resolveExperience = (announcement = {}) => {
  const direct = normalizeMeaningfulText(announcement.Experience)
  if (direct) return direct

  const min = normalizeMeaningfulText(announcement.MinimumExperience)
  const max = normalizeMeaningfulText(announcement.MaximumExperience)
  if (min && max) return `${min}-${max}`
  return min || max || null
}

export const normalizeAnnouncement = (announcement = {}, scrapedAt = new Date().toISOString()) => {
  const title = normalizeMeaningfulText(announcement.JobRole || announcement.Title)
  const city = normalizeMeaningfulText(announcement.Location)
  if (!title) return null

  const minimumQualification = normalizeMeaningfulText(
    announcement.QualificationDisplay || announcement.Qualification,
  )
  const experienceRequired = resolveExperience(announcement)
  const responsibilities = extractResponsibilities(announcement.JobResponsibility)
  const jobDescription = buildJobDescription({
    role: title,
    location: city,
    minimumQualification,
    experienceRequired,
    responsibilities,
  })
  const identifier = slugify(`${title}-${city}`)

  return {
    title,
    company: COMPANY,
    department: null,
    location: city ? `${city}, India` : 'India',
    city,
    country: 'India',
    jobId: `${SOURCE}-${identifier}`,
    requisitionId: `${SOURCE}-${identifier}`,
    sourceUrl: buildDetailUrl(title),
    applyUrl: APPLY_URL,
    employmentType: null,
    workplaceType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: normalizeMeaningfulText(announcement.PublishedDate),
    closingDate: null,
    jobDescription,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: ATS_PLATFORM,
    link: APPLY_URL,
    scrapedAt,
  }
}

export const createMcxScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const currentOpeningsHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCurrentOpeningsPageSignal(currentOpeningsHtml)) {
      throw new Error('The verified MCX current openings page no longer matches the expected first-party public jobs page')
    }

    const applyOnlineHtml = await fetchText(APPLY_URL)
    if (!hasVerifiedApplyOnlineSignal(applyOnlineHtml)) {
      throw new Error('The verified MCX apply online page no longer matches the expected first-party application surface')
    }

    const payload = await fetchJson(JOBS_API_URL)
    if (!hasAnnouncementsPayloadSignal(payload)) {
      throw new Error('MCX current openings feed no longer matches the verified first-party announcements contract')
    }

    const scrapedAt = String(now())
    return payload.Announcements
      .map((announcement) => normalizeAnnouncement(announcement, scrapedAt))
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createMcxScraper(options).run(options)

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
