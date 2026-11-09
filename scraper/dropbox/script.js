import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import DROPBOX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DROPBOX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_ENTRY_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_HOME_URL = PROVIDER_METADATA.officialCareersHomeUrl
export const JOBS_URL = PROVIDER_METADATA.officialJobsListingUrl
export const ROBOTS_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const VERIFIED_LISTING_JOB_COUNT = PROVIDER_METADATA.verifiedListingJobCount
export const VERIFIED_SAMPLE_JOB_URL = PROVIDER_METADATA.verifiedSampleJobUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DETAIL_URL_REGEX = /^https:\/\/www\.dropbox\.jobs\/en\/jobs\/(\d+)\/([^/?#]+)\/?$/i
const ACRONYM_TOKENS = new Map([
  ['ai', 'AI'],
  ['api', 'API'],
  ['hr', 'HR'],
  ['it', 'IT'],
  ['ml', 'ML'],
  ['qa', 'QA'],
  ['sre', 'SRE'],
  ['svp', 'SVP'],
  ['ui', 'UI'],
  ['ux', 'UX'],
  ['vp', 'VP'],
])

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/^\uFEFF/, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeSlugToken = (value) => normalizeWhitespace(String(value ?? '').replace(/-/g, ' '))

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.split(' ')
  .filter(Boolean)
  .map((token) => {
    const lowered = token.toLowerCase()
    return ACRONYM_TOKENS.get(lowered)
      || `${lowered.charAt(0).toUpperCase()}${lowered.slice(1)}`
  })
  .join(' ')
  || null

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const hasOfficialJobsLandingSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*It starts with your ideas, then scales to the world \| Dropbox Careers\s*<\/title>/i.test(page)
    && />\s*Search jobs\s*</i.test(page)
    && />\s*Displaying 1 to 20 of 39 matching jobs\s*</i.test(page)
}

export const extractSitemapUrlFromRobots = (robotsTxt = '') =>
  normalizeWhitespace(String(robotsTxt ?? '').match(/^\s*sitemap\s*:\s*(\S+)/im)?.[1])

export const hasVerifiedRobotsSitemapSignal = (robotsTxt = '') => {
  const text = String(robotsTxt ?? '')

  return /^User-agent:\s*\*/im.test(text)
    && /^Allow:\s*\/\s*$/im.test(text)
    && extractSitemapUrlFromRobots(text) === SITEMAP_URL
}

export const sitemapIncludesVerifiedJobsSurface = (xml = '') => {
  const text = String(xml ?? '')

  return new RegExp(`<loc>${CAREERS_HOME_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/loc>`, 'i').test(text)
    && new RegExp(`<loc>${JOBS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/loc>`, 'i').test(text)
}

export const extractEnglishJobEntriesFromSitemap = (xml = '') => {
  const entries = []
  const seenJobIds = new Set()

  for (const match of String(xml ?? '').matchAll(/<url>\s*<loc>([\s\S]*?)<\/loc>(?:\s*<lastmod>([\s\S]*?)<\/lastmod>)?[\s\S]*?<\/url>/gi)) {
    const sourceUrl = normalizeWhitespace(match[1])
    const postingDate = normalizeWhitespace(match[2]) || null
    const detailMatch = sourceUrl?.match(DETAIL_URL_REGEX)

    if (!sourceUrl || !detailMatch) continue

    const jobId = normalizeWhitespace(detailMatch[1])
    const title = toTitleCase(decodeSlugToken(detailMatch[2]))
    if (!jobId || !title || seenJobIds.has(jobId)) continue

    seenJobIds.add(jobId)
    entries.push({
      jobId,
      requisitionId: jobId,
      title,
      sourceUrl,
      applyUrl: sourceUrl,
      postingDate,
    })
  }

  return entries.sort((left, right) => {
    const leftDate = left.postingDate || ''
    const rightDate = right.postingDate || ''

    if (leftDate !== rightDate) {
      return rightDate.localeCompare(leftDate)
    }

    return left.sourceUrl.localeCompare(right.sourceUrl)
  })
}

export const buildJobFromSitemapEntry = (entry, scrapedAt) => {
  if (!entry?.jobId || !entry?.title || !entry?.sourceUrl) {
    throw new Error('Dropbox verified careers sitemap entry changed materially')
  }

  return {
    jobId: entry.jobId,
    title: entry.title,
    company: COMPANY,
    department: null,
    location: null,
    city: null,
    country: 'Global',
    sourceUrl: entry.sourceUrl,
    applyUrl: entry.applyUrl || entry.sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: entry.postingDate,
    closingDate: null,
    jobDescription: 'Official Dropbox opening published on the verified first-party careers sitemap.',
    remoteStatus: null,
    requisitionId: entry.requisitionId || entry.jobId,
    source: SOURCE,
    link: entry.applyUrl || entry.sourceUrl,
    scrapedAt,
    companyCareerPage: CAREERS_ENTRY_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
  }
}

export const createDropboxScraper = ({
  maxJobs = Number.POSITIVE_INFINITY,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasVerifiedRobotsSitemapSignal(robotsTxt)) {
      throw new Error('Dropbox verified robots.txt no longer advertises the public careers sitemap')
    }

    const sitemapUrl = extractSitemapUrlFromRobots(robotsTxt)
    if (sitemapUrl !== SITEMAP_URL) {
      throw new Error('Dropbox verified robots.txt sitemap URL changed materially')
    }

    const sitemapXml = await fetchText(sitemapUrl)
    if (!sitemapIncludesVerifiedJobsSurface(sitemapXml)) {
      throw new Error('Dropbox verified careers sitemap no longer advertises the public jobs surface')
    }

    const entries = extractEnglishJobEntriesFromSitemap(sitemapXml)
    if (entries.length === 0) {
      throw new Error('Dropbox verified careers sitemap no longer exposes English public job detail URLs')
    }

    const scrapedAt = now()
    const selectedEntries = Number.isFinite(maxJobs) ? entries.slice(0, maxJobs) : entries

    return selectedEntries.map((entry) => buildJobFromSitemapEntry(entry, scrapedAt))
  },
})

export const run = async (options = {}) => createDropboxScraper(options).run(options)

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
