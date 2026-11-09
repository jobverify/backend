import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ZIFO_RND_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ZIFO_RND_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const WORKABLE_API_URL = 'https://www.workable.com/api/accounts/zifo?details=true'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers')
    && normalized.includes('zifo india')
    && normalized.includes('assistant manager - finance, chennai')
}

export const hasNoCurrentVacanciesSignal = (html = '') =>
  /do not have any vacancies at this moment/i.test(normalizeWhitespace(html))

export const extractStaleIndiaRoleTitles = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

export const extractIndiaRoleLinks = (html = '') => {
  const page = String(html ?? '')
  if (!/<title>\s*Careers\s*-\s*Zifo RnD Solutions\s*<\/title>/i.test(page)) {
    throw new Error('Zifo official careers page no longer matches the verified surface')
  }
  const section = page.match(/<h4[^>]*>\s*Zifo India\s*<\/h4>([\s\S]*?)(?=<h4\b|<footer\b)/i)?.[1]
  if (!section) throw new Error('Zifo India careers section is unavailable')
  const links = [...section.matchAll(/<a\b[^>]*\bhref=["'](https:\/\/apply\.workable\.com\/j\/([A-Za-z0-9]+))["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: match[1], shortcode: match[2], title: normalizeWhitespace(match[3]) }))
  if (new Set(links.map((link) => link.shortcode)).size !== links.length || links.some((link) => !link.title)) {
    throw new Error('Zifo India careers inventory has invalid or duplicate links')
  }
  return links
}

export const extractCurrentIndiaJobs = (payload, links, now = () => new Date().toISOString()) => {
  if (payload?.name !== 'Zifo' || !Array.isArray(payload.jobs)) {
    throw new Error('Zifo Workable published jobs inventory is unavailable')
  }
  const indiaJobs = payload.jobs.filter((job) => job?.country === 'India')
  const linkIds = new Set(links.map((link) => link.shortcode))
  const feedIds = new Set(indiaJobs.map((job) => job.shortcode))
  if (linkIds.size !== feedIds.size || [...linkIds].some((id) => !feedIds.has(id))) {
    throw new Error('Zifo India careers links and Workable inventory disagree')
  }
  if (feedIds.size !== indiaJobs.length) {
    throw new Error('Zifo Workable India inventory contains duplicate IDs')
  }
  return indiaJobs.map((job) => {
    const title = normalizeWhitespace(job.title)
    const city = normalizeWhitespace(job.city) || null
    const state = normalizeWhitespace(job.state) || null
    const location = [city, state, 'India'].filter(Boolean).join(', ')
    const sourceUrl = `https://apply.workable.com/j/${job.shortcode}`
    const applyUrl = `${sourceUrl}/apply`
    const linkedTitle = links.find((link) => link.shortcode === job.shortcode)?.title
    if (!title || !city || !state || job.url !== sourceUrl || job.application_url !== applyUrl
      || !linkedTitle?.startsWith(title)) {
      throw new Error(`Zifo Workable inventory has invalid India role ${job.shortcode}`)
    }
    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(job.department) || null,
      location,
      city,
      state,
      country: 'India',
      jobId: job.shortcode,
      requisitionId: job.shortcode,
      sourceUrl,
      applyUrl,
      employmentType: normalizeWhitespace(job.employment_type) || null,
      postingDate: normalizeWhitespace(job.published_on) || null,
      jobDescription: normalizeWhitespace(job.description) || null,
      remoteStatus: job.telecommuting ? 'Remote' : 'On-site',
      source: SOURCE,
      link: applyUrl,
      scrapedAt: now(),
    }
  })
}

export const createZifoScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    const links = extractIndiaRoleLinks(careersHtml)
    const payload = await fetchJson(WORKABLE_API_URL)
    return extractCurrentIndiaJobs(payload, links, now)
  },
})

export const run = async (options = {}) => createZifoScraper().run(options)

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
